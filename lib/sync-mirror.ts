import { browser } from 'wxt/browser';
import { deleteNote, getAllNotes, getNote, isNoteKey, NOTE_PREFIX, putNote, type Note } from './notes-store';

/**
 * Optional mirror of local notes into `storage.sync`.
 *
 * Local storage is always the source of truth. Sync holds as many of the most
 * recently edited notes as fit in its quota; older ones are evicted from sync
 * only. A user delete is written as a small tombstone so other devices can tell
 * it apart from an eviction (a plain key removal, which they ignore).
 */

export const SYNC_PREFIX = 'n:';
// chrome.storage.sync allows 102,400 bytes / 512 items / 8,192 bytes per item.
export const BUDGET_BYTES = 90_000;
export const BUDGET_ITEMS = 480;
export const MAX_ITEM_BYTES = 7_500;
export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface Tombstone {
  deleted: true;
  updatedAt: number;
}
export type SyncValue = Note | Tombstone;

const encoder = new TextEncoder();

export const syncKey = (noteKey: string) => SYNC_PREFIX + noteKey;
export const noteKeyFromSync = (key: string) => key.slice(SYNC_PREFIX.length);

export function isTombstone(value: SyncValue | undefined): value is Tombstone {
  return !!value && 'deleted' in value && value.deleted === true;
}

/** Size as counted by chrome.storage.sync: key length + JSON of the value. */
export function itemBytes(key: string, value: unknown): number {
  return encoder.encode(key).length + encoder.encode(JSON.stringify(value)).length;
}

export function isSyncable(note: Note): boolean {
  return itemBytes(syncKey(note.key), note) <= MAX_ITEM_BYTES;
}

/**
 * Decides which sync keys to evict so `incoming` fits within the budget.
 * Only entries older than the incoming one (or expired tombstones) are
 * evicted; returns null when it cannot fit without evicting newer notes.
 */
export function planEvictions(
  existing: Record<string, SyncValue>,
  incomingKey: string,
  incoming: SyncValue,
  now = Date.now(),
): string[] | null {
  const incomingBytes = itemBytes(incomingKey, incoming);
  if (incomingBytes > MAX_ITEM_BYTES) return null;

  const others = Object.entries(existing).filter(([k]) => k !== incomingKey);
  let bytes = others.reduce((sum, [k, v]) => sum + itemBytes(k, v), 0) + incomingBytes;
  let items = others.length + 1;
  const fits = () => bytes <= BUDGET_BYTES && items <= BUDGET_ITEMS;
  if (fits()) return [];

  const expired = (v: SyncValue) => isTombstone(v) && now - v.updatedAt > TOMBSTONE_TTL_MS;
  const candidates = others
    .filter(([, v]) => expired(v) || v.updatedAt < incoming.updatedAt)
    .sort(([, a], [, b]) => Number(expired(b)) - Number(expired(a)) || a.updatedAt - b.updatedAt);

  const evict: string[] = [];
  for (const [k, v] of candidates) {
    if (fits()) break;
    evict.push(k);
    bytes -= itemBytes(k, v);
    items--;
  }
  return fits() ? evict : null;
}

async function getSyncItems(): Promise<Record<string, SyncValue>> {
  const all = await browser.storage.sync.get(null);
  return Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith(SYNC_PREFIX))) as Record<
    string,
    SyncValue
  >;
}

/** Writes one value to sync, evicting older entries as needed. Returns false if it did not fit. */
async function writeToSync(noteKey: string, value: SyncValue): Promise<boolean> {
  const key = syncKey(noteKey);
  const existing = await getSyncItems();
  const current = existing[key];
  // Already up to date (e.g. this change came from sync in the first place).
  if (current && current.updatedAt >= value.updatedAt && isTombstone(current) === isTombstone(value)) return true;

  const evict = planEvictions(existing, key, value);
  if (evict === null) {
    if (current) await browser.storage.sync.remove(key); // stale copy would be misleading
    return false;
  }
  if (evict.length) await browser.storage.sync.remove(evict);
  await browser.storage.sync.set({ [key]: value });
  return true;
}

export async function pushNote(noteKey: string): Promise<boolean> {
  const note = await getNote(noteKey);
  if (!note) return pushTombstone(noteKey);
  return writeToSync(noteKey, note);
}

export async function pushTombstone(noteKey: string, updatedAt = Date.now()): Promise<boolean> {
  const current = (await getSyncItems())[syncKey(noteKey)];
  if (isTombstone(current)) return true;
  return writeToSync(noteKey, { deleted: true, updatedAt });
}

/** Applies one incoming sync value to local storage (newest edit wins). */
export async function mergeFromSync(noteKey: string, value: SyncValue): Promise<void> {
  const local = await getNote(noteKey);
  if (isTombstone(value)) {
    if (local && local.updatedAt <= value.updatedAt) await deleteNote(noteKey);
    return;
  }
  if (!local || local.updatedAt < value.updatedAt) await putNote(value);
}

/**
 * Pulls everything from sync, then pushes local notes newest-first until the
 * budget is full. Planned in memory and written in one batch, since sync
 * limits write operations per minute.
 */
export async function fullSync(): Promise<void> {
  const working = await getSyncItems();
  for (const [k, v] of Object.entries(working)) await mergeFromSync(noteKeyFromSync(k), v);

  const toSet: Record<string, SyncValue> = {};
  const toRemove = new Set<string>();
  const local = (await getAllNotes()).sort((a, b) => b.updatedAt - a.updatedAt);
  for (const note of local) {
    const key = syncKey(note.key);
    const current = working[key];
    if (current && current.updatedAt >= note.updatedAt) continue;
    const evict = planEvictions(working, key, note);
    if (evict === null) continue;
    for (const k of evict) {
      delete working[k];
      delete toSet[k];
      toRemove.add(k);
    }
    working[key] = note;
    toSet[key] = note;
    toRemove.delete(key);
  }
  if (toRemove.size) await browser.storage.sync.remove([...toRemove]);
  if (Object.keys(toSet).length) await browser.storage.sync.set(toSet);
}

/** Removes this extension's notes from sync (other devices keep their local copies). */
export async function clearSyncMirror(): Promise<void> {
  const keys = Object.keys(await getSyncItems());
  if (keys.length) await browser.storage.sync.remove(keys);
}

/**
 * Wires the mirror up in the background script. Local edits are pushed after
 * a debounce to stay well inside sync's write-rate limits.
 */
export function startSyncMirror(isEnabled: () => Promise<boolean>, debounceMs = 5_000): () => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = (task: () => Promise<unknown>) => {
    queue = queue.then(task).catch((err) => console.warn('[Private Event Notes] sync failed', err));
    return queue;
  };

  const listener = async (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => {
    if (area !== 'local' && area !== 'sync') return;
    if (!(await isEnabled())) return;

    for (const [key, change] of Object.entries(changes)) {
      if (area === 'local' && isNoteKey(key)) {
        const noteKey = key.slice(NOTE_PREFIX.length);
        clearTimeout(timers.get(noteKey));
        timers.set(
          noteKey,
          setTimeout(() => {
            timers.delete(noteKey);
            enqueue(() => pushNote(noteKey));
          }, debounceMs),
        );
      } else if (area === 'sync' && key.startsWith(SYNC_PREFIX) && change.newValue !== undefined) {
        // Removals without a tombstone are evictions: never delete locally.
        enqueue(() => mergeFromSync(noteKeyFromSync(key), change.newValue as SyncValue));
      }
    }
  };

  browser.storage.onChanged.addListener(listener);
  return () => {
    browser.storage.onChanged.removeListener(listener);
    timers.forEach(clearTimeout);
  };
}
