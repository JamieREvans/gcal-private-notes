import { browser } from 'wxt/browser';
import {
  clearPendingDeletes,
  deleteNote,
  getAllNotes,
  getNote,
  getPendingDeletes,
  isNoteKey,
  NOTE_PREFIX,
  putNote,
  sanitizeNote,
  type Note,
} from './notes-store';

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

/**
 * Pushes local state for the given note keys (default: every note and pending
 * delete) to sync. Planned in memory and written as one remove + one set,
 * because sync limits write operations per minute. Newest edits get room first.
 */
export async function pushChanges(noteKeys?: string[]): Promise<void> {
  const working = await getSyncItems();
  const pending = await getPendingDeletes();
  const local = new Map((await getAllNotes()).map((n) => [n.key, n]));
  const keys = noteKeys ?? [...new Set([...local.keys(), ...Object.keys(pending)])];

  const changes: [string, SyncValue][] = [];
  for (const k of new Set(keys)) {
    const note = local.get(k);
    if (note) changes.push([k, note]);
    else if (pending[k] !== undefined) changes.push([k, { deleted: true, updatedAt: pending[k] }]);
  }
  changes.sort(([, a], [, b]) => b.updatedAt - a.updatedAt);

  const toSet: Record<string, SyncValue> = {};
  const toRemove = new Set<string>();
  const settledDeletes: string[] = [];
  for (const [noteKey, value] of changes) {
    const key = syncKey(noteKey);
    const current = working[key];
    const deleting = isTombstone(value);
    if (current && current.updatedAt >= value.updatedAt) {
      // Sync already has this change, or a newer one that merging will apply here.
      if (deleting) settledDeletes.push(noteKey);
      continue;
    }
    const evict = planEvictions(working, key, value);
    if (evict === null) {
      // Too big or too old to fit: drop a stale copy rather than leave it misleading.
      if (current && !isTombstone(current)) {
        delete working[key];
        toRemove.add(key);
      }
      continue;
    }
    for (const k of evict) {
      delete working[k];
      delete toSet[k];
      toRemove.add(k);
    }
    working[key] = value;
    toSet[key] = value;
    toRemove.delete(key);
    if (deleting) settledDeletes.push(noteKey);
  }
  if (toRemove.size) await browser.storage.sync.remove([...toRemove]);
  if (Object.keys(toSet).length) await browser.storage.sync.set(toSet);
  await clearPendingDeletes(settledDeletes);
}

/** Applies one incoming sync value to local storage (newest change wins). */
export async function mergeFromSync(noteKey: string, value: SyncValue): Promise<void> {
  const local = await getNote(noteKey);
  if (isTombstone(value)) {
    if (local && local.updatedAt <= value.updatedAt) await deleteNote(noteKey);
    return;
  }
  const incoming = sanitizeNote(value);
  if (!incoming || incoming.key !== noteKey) return;
  if (local && local.updatedAt >= incoming.updatedAt) return;
  // Deleted here after that copy was written: keep it deleted (the tombstone follows).
  const deletedAt = (await getPendingDeletes())[noteKey];
  if (!local && deletedAt !== undefined && deletedAt >= incoming.updatedAt) return;
  await putNote(incoming);
}

/** Pulls everything from sync, then pushes local notes and pending deletes. */
export async function fullSync(): Promise<void> {
  const remote = await getSyncItems();
  for (const [k, v] of Object.entries(remote)) await mergeFromSync(noteKeyFromSync(k), v);
  await pushChanges();
}

/**
 * Removes this extension's notes from browser sync, on request. Other synced
 * browsers keep their local copies (and re-upload them if their sync is on).
 */
export async function clearSyncMirror(): Promise<void> {
  const keys = Object.keys(await getSyncItems());
  if (keys.length) await browser.storage.sync.remove(keys);
}

/**
 * Wires the mirror up in the background script. Local changes are collected
 * and pushed in one batch after a debounce, to stay inside sync's write-rate
 * limits. Anything still pending if the worker stops is picked up by the next
 * fullSync, because deletes are recorded durably.
 */
export function startSyncMirror(isEnabled: () => Promise<boolean>, debounceMs = 5_000): () => void {
  const dirty = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = (task: () => Promise<unknown>) => {
    queue = queue.then(task).catch((err) => console.warn('[Private Event Notes] sync failed', err));
    return queue;
  };

  const flush = () =>
    enqueue(async () => {
      timer = undefined;
      const keys = [...dirty];
      dirty.clear();
      // Re-checked here, not when the change arrived: sync may have been switched off since.
      if (keys.length && (await isEnabled())) await pushChanges(keys);
    });

  const listener = async (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => {
    if (area === 'local') {
      const keys = Object.keys(changes).filter(isNoteKey);
      if (!keys.length) return;
      for (const k of keys) dirty.add(k.slice(NOTE_PREFIX.length));
      clearTimeout(timer);
      timer = setTimeout(flush, debounceMs);
    } else if (area === 'sync') {
      if (!(await isEnabled())) return;
      for (const [key, change] of Object.entries(changes)) {
        // Removals without a tombstone are evictions: never delete locally.
        if (key.startsWith(SYNC_PREFIX) && change.newValue !== undefined) {
          enqueue(() => mergeFromSync(noteKeyFromSync(key), change.newValue as SyncValue));
        }
      }
    }
  };

  browser.storage.onChanged.addListener(listener);
  return () => {
    browser.storage.onChanged.removeListener(listener);
    clearTimeout(timer);
  };
}
