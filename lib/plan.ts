import { isSeriesNote, type Note } from './notes-store';

/** Notes a free user can keep unlocked. Older notes are locked (kept, hidden), never deleted. */
export const FREE_NOTE_LIMIT = 5;

/** Occurrence notes, most recently edited first. Pinned series notes are Pro-only and don't count. */
function byMostRecentEdit(notes: Note[]): Note[] {
  return notes.filter((n) => !isSeriesNote(n)).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Keys of notes that are locked on the free plan. */
export function lockedKeys(notes: Note[], pro: boolean): Set<string> {
  if (pro) return new Set();
  return new Set(byMostRecentEdit(notes).slice(FREE_NOTE_LIMIT).map((n) => n.key));
}

/**
 * The note that would become locked if a free user creates a new note now,
 * or undefined if there's still room.
 */
export function noteLockedByNewNote(notes: Note[], pro: boolean): Note | undefined {
  if (pro) return undefined;
  const unlocked = byMostRecentEdit(notes).slice(0, FREE_NOTE_LIMIT);
  return unlocked.length >= FREE_NOTE_LIMIT ? unlocked[unlocked.length - 1] : undefined;
}
