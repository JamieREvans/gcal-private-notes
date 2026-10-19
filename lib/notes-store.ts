import { browser } from 'wxt/browser';
import { toEventRef, type EventRef } from './event-id';

export interface EventSnapshot {
  title?: string;
  /** Human-readable date/time as shown by Google Calendar. */
  when?: string;
  url?: string;
}

export interface Note extends EventSnapshot {
  key: string;
  calendarId: string;
  eventId: string;
  seriesId: string;
  instanceStart?: string;
  text: string;
  createdAt: number;
  updatedAt: number;
  /** 'series': a pinned note shown on every occurrence of a recurring event (Pro). */
  kind?: 'series';
}

export const isSeriesNote = (n: Pick<Note, 'kind'>) => n.kind === 'series';
export const isRecurring = (ref: Pick<EventRef, 'eventId' | 'seriesId'>) => ref.eventId !== ref.seriesId;
export const seriesNoteKey = (calendarId: string, seriesId: string) => `${calendarId}|${seriesId}|series`;

/** The identity a recurring event's pinned note is stored under. */
export function seriesRef(ref: Pick<EventRef, 'calendarId' | 'seriesId'>): EventRef {
  return {
    key: seriesNoteKey(ref.calendarId, ref.seriesId),
    calendarId: ref.calendarId,
    eventId: ref.seriesId,
    seriesId: ref.seriesId,
  };
}

export const NOTE_PREFIX = 'note:';
const storageKey = (key: string) => NOTE_PREFIX + key;

export function isNoteKey(storageKey: string): boolean {
  return storageKey.startsWith(NOTE_PREFIX);
}

export async function getNote(key: string): Promise<Note | undefined> {
  const k = storageKey(key);
  const res = await browser.storage.local.get(k);
  return res[k] as Note | undefined;
}

export async function getAllNotes(): Promise<Note[]> {
  const all = await browser.storage.local.get(null);
  return Object.entries(all)
    .filter(([k]) => isNoteKey(k))
    .map(([, v]) => v as Note);
}

export async function getSeriesNotes(ref: Pick<EventRef, 'calendarId' | 'seriesId'>): Promise<Note[]> {
  const notes = await getAllNotes();
  return notes
    .filter((n) => !isSeriesNote(n) && n.calendarId === ref.calendarId && n.seriesId === ref.seriesId)
    .sort(compareByEventTime);
}

/** Newest event first, falling back to last edit time. */
export function compareByEventTime(a: Note, b: Note): number {
  const at = a.instanceStart ?? '';
  const bt = b.instanceStart ?? '';
  if (at !== bt) return at < bt ? 1 : -1;
  return b.updatedAt - a.updatedAt;
}

/**
 * Saves a note's text. Empty text deletes the note so we never keep
 * placeholder records around.
 */
export async function saveNote(
  ref: EventRef,
  text: string,
  snapshot: EventSnapshot = {},
  kind?: Note['kind'],
): Promise<Note | undefined> {
  if (!text.trim()) {
    await deleteNote(ref.key);
    return undefined;
  }
  const existing = await getNote(ref.key);
  const now = Date.now();
  const note: Note = {
    ...existing,
    ...definedOnly(snapshot),
    key: ref.key,
    calendarId: ref.calendarId,
    eventId: ref.eventId,
    seriesId: ref.seriesId,
    instanceStart: ref.instanceStart,
    text,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (kind) note.kind = kind;
  await putNote(note);
  return note;
}

/** Saves a recurring event's pinned note. */
export function saveSeriesNote(ref: EventRef, text: string, snapshot: EventSnapshot = {}): Promise<Note | undefined> {
  // A pinned note belongs to the whole series, so don't store one occurrence's time or link.
  return saveNote(seriesRef(ref), text, { title: snapshot.title }, 'series');
}

/** Replaces a stored note's text (e.g. ticking a follow-up). Empty text deletes it. */
export async function updateNoteText(note: Note, text: string): Promise<void> {
  if (!text.trim()) return deleteNote(note.key);
  await putNote({ ...note, text, updatedAt: Date.now() });
}

/** Writes a full note record as-is (used by import and sync merge). */
export async function putNote(note: Note): Promise<void> {
  await browser.storage.local.set({ [storageKey(note.key)]: note });
}

export async function putNotes(notes: Note[]): Promise<void> {
  if (!notes.length) return;
  await browser.storage.local.set(Object.fromEntries(notes.map((n) => [storageKey(n.key), n])));
}

export async function deleteNote(key: string): Promise<void> {
  await recordDeletes([key]);
  await browser.storage.local.remove(storageKey(key));
}

export async function deleteAllNotes(): Promise<void> {
  const all = await browser.storage.local.get(null);
  const keys = Object.keys(all).filter(isNoteKey);
  await recordDeletes(keys.map((k) => k.slice(NOTE_PREFIX.length)));
  await browser.storage.local.remove(keys);
}

/**
 * Deletes are recorded durably (note key → time deleted) so the sync mirror
 * can propagate them even if the browser closes first, and never resurrects
 * a deleted note from an older synced copy.
 */
const PENDING_DELETES_KEY = 'pendingDeletes';
const PENDING_DELETE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function getPendingDeletes(): Promise<Record<string, number>> {
  const res = await browser.storage.local.get(PENDING_DELETES_KEY);
  return (res[PENDING_DELETES_KEY] as Record<string, number> | undefined) ?? {};
}

async function recordDeletes(keys: string[], at = Date.now()): Promise<void> {
  if (!keys.length) return;
  const map = await getPendingDeletes();
  for (const [k, t] of Object.entries(map)) if (at - t > PENDING_DELETE_TTL_MS) delete map[k];
  for (const k of keys) map[k] = at;
  await browser.storage.local.set({ [PENDING_DELETES_KEY]: map });
}

export async function clearPendingDeletes(keys: string[]): Promise<void> {
  if (!keys.length) return;
  const map = await getPendingDeletes();
  for (const k of keys) delete map[k];
  await browser.storage.local.set({ [PENDING_DELETES_KEY]: map });
}

/**
 * Validates a note from outside this browser (import file, other devices via
 * sync) and rebuilds its identity fields from the event id, so a malformed or
 * hostile record can't break views or point links somewhere unexpected.
 */
export function sanitizeNote(value: unknown): Note | null {
  const n = value as Partial<Note> | null;
  if (
    !n ||
    typeof n.calendarId !== 'string' ||
    typeof n.eventId !== 'string' ||
    typeof n.text !== 'string' ||
    !Number.isFinite(n.updatedAt) ||
    !n.calendarId ||
    !n.eventId
  ) {
    return null;
  }
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const url = str(n.url);
  if (n.kind === 'series') {
    const seriesId = toEventRef(n.eventId, n.calendarId).seriesId;
    return {
      ...seriesRef({ calendarId: n.calendarId, seriesId }),
      kind: 'series',
      text: n.text,
      title: str(n.title),
      createdAt: Number.isFinite(n.createdAt) ? (n.createdAt as number) : (n.updatedAt as number),
      updatedAt: n.updatedAt as number,
    };
  }
  return {
    ...toEventRef(n.eventId, n.calendarId),
    text: n.text,
    title: str(n.title),
    when: str(n.when),
    url: url?.startsWith('https://calendar.google.com/') ? url : undefined,
    createdAt: Number.isFinite(n.createdAt) ? (n.createdAt as number) : (n.updatedAt as number),
    updatedAt: n.updatedAt as number,
  };
}

/** Calls back whenever any note changes in local storage. */
export function onNotesChanged(callback: () => void): () => void {
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local' && Object.keys(changes).some(isNoteKey)) callback();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

function definedOnly<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;
}
