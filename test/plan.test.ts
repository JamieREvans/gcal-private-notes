import { describe, expect, it } from 'vitest';
import { toEventRef } from '../lib/event-id';
import type { Note } from '../lib/notes-store';
import { FREE_NOTE_LIMIT, lockedKeys, noteLockedByNewNote } from '../lib/plan';
import { notesToMarkdown } from '../lib/markdown';

const note = (id: string, updatedAt: number, extra: Partial<Note> = {}): Note => ({
  ...toEventRef(id, 'cal'),
  text: `note ${id}`,
  createdAt: updatedAt,
  updatedAt,
  ...extra,
});

describe('free plan limits', () => {
  const notes = Array.from({ length: 7 }, (_, i) => note(`e${i}`, 100 + i));

  it('locks everything beyond the most recently edited notes', () => {
    expect([...lockedKeys(notes, false)].sort()).toEqual(['cal|e0', 'cal|e1']);
    expect(lockedKeys(notes, true).size).toBe(0);
  });

  it('names the note a new note would lock', () => {
    expect(noteLockedByNewNote(notes, false)?.key).toBe('cal|e2');
    expect(noteLockedByNewNote(notes.slice(0, FREE_NOTE_LIMIT - 1), false)).toBeUndefined();
    expect(noteLockedByNewNote(notes, true)).toBeUndefined();
  });
});

describe('markdown export', () => {
  it('groups recurring occurrences under one heading, newest first', () => {
    const md = notesToMarkdown(
      [
        note('s_20261005T100000Z', 1, { title: 'Weekly 1:1' }),
        note('s_20261012T100000Z', 2, { title: 'Weekly 1:1' }),
        note('one-off', 3, { title: 'Offsite', url: 'https://calendar.google.com/x' }),
      ],
      new Date('2026-10-19T00:00:00Z'),
    );
    expect(md).toContain('# Weekly 1:1 (2 occurrences)');
    expect(md.indexOf('2026-10-12')).toBeLessThan(md.indexOf('2026-10-05'));
    expect(md).toContain('[Open in Google Calendar](https://calendar.google.com/x)');
  });
});
