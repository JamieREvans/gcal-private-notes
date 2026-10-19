import { browser } from 'wxt/browser';
import type { EventRef } from './event-id';

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
    .filter((n) => n.calendarId === ref.calendarId && n.seriesId === ref.seriesId)
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
export async function saveNote(ref: EventRef, text: string, snapshot: EventSnapshot = {}): Promise<Note | undefined> {
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
  await putNote(note);
  return note;
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
  await browser.storage.local.remove(storageKey(key));
}

export async function deleteAllNotes(): Promise<void> {
  const all = await browser.storage.local.get(null);
  await browser.storage.local.remove(Object.keys(all).filter(isNoteKey));
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
