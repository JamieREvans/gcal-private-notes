import type { EventRef } from './event-id';
import { isRecurring, isSeriesNote, seriesNoteKey, type Note } from './notes-store';

export interface PrepItem {
  ref: EventRef;
  title: string;
  /** Pinned note for the series, if any. */
  pinned?: Note;
  /** This occurrence's own note, if already written. */
  current?: Note;
  /** Notes from earlier occurrences, newest first. */
  previous: Note[];
}

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whether an occurrence starts today in the user's time zone. */
export function isToday(instanceStart: string | undefined, now = new Date()): boolean {
  if (!instanceStart) return false;
  const date = instanceStart.length === 10 ? instanceStart : localDate(new Date(instanceStart));
  return date === localDate(now);
}

/**
 * Today's recurring meetings (from the events visible in Calendar) that have
 * something to prepare from: a pinned note, earlier notes, or today's note.
 * One-off events carry no date in their id, so only recurring ones qualify.
 */
export function todaysPrep(visible: EventRef[], notes: Note[], now = new Date()): PrepItem[] {
  const seen = new Set<string>();
  const items: PrepItem[] = [];
  for (const ref of visible) {
    if (seen.has(ref.key) || !isRecurring(ref) || !isToday(ref.instanceStart, now)) continue;
    seen.add(ref.key);

    const series = notes.filter((n) => n.calendarId === ref.calendarId && n.seriesId === ref.seriesId);
    const pinned = series.find((n) => n.key === seriesNoteKey(ref.calendarId, ref.seriesId));
    const current = series.find((n) => n.key === ref.key);
    const previous = series
      .filter((n) => !isSeriesNote(n) && n.key !== ref.key && (n.instanceStart ?? '') < (ref.instanceStart ?? ''))
      .sort((a, b) => ((a.instanceStart ?? '') < (b.instanceStart ?? '') ? 1 : -1));
    if (!pinned && !current && !previous.length) continue;

    const title = series.find((n) => n.title)?.title ?? 'Recurring event';
    items.push({ ref, title, pinned, current, previous });
  }
  return items.sort((a, b) => ((a.ref.instanceStart ?? '') < (b.ref.instanceStart ?? '') ? -1 : 1));
}
