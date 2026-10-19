import { describe, expect, it } from 'vitest';
import { toEventRef } from '../lib/event-id';
import { seriesNoteKey, type Note } from '../lib/notes-store';
import { isToday, todaysPrep } from '../lib/prep';

const now = new Date(2026, 9, 19, 8, 0); // 19 Oct 2026, 08:00 local
const iso = (d: number, h: number) => new Date(2026, 9, d, h, 0).toISOString().replace(/\.\d{3}Z$/, 'Z');
const idAt = (series: string, d: number, h: number) => `${series}_${iso(d, h).replace(/[-:]/g, '')}`;
const note = (eventId: string, text: string, extra: Partial<Note> = {}): Note => ({
  ...toEventRef(eventId, 'cal'),
  text,
  title: 'Weekly 1:1',
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});

describe('isToday', () => {
  it('handles timed (UTC) and all-day occurrences in local time', () => {
    expect(isToday(iso(19, 9), now)).toBe(true);
    expect(isToday(iso(20, 9), now)).toBe(false);
    expect(isToday('2026-10-19', now)).toBe(true);
    expect(isToday(undefined, now)).toBe(false);
  });
});

describe('todaysPrep', () => {
  const today = toEventRef(idAt('oneonone', 19, 9), 'cal');
  const tomorrow = toEventRef(idAt('standup', 20, 9), 'cal');
  const oneOff = toEventRef('offsite', 'cal');

  it("lists today's recurring meetings that have history, with the latest earlier note first", () => {
    const notes = [
      note(idAt('oneonone', 5, 9), 'two weeks ago'),
      note(idAt('oneonone', 12, 9), 'last week'),
      note('oneonone', 'goals', { key: seriesNoteKey('cal', 'oneonone'), kind: 'series' }),
      note(idAt('standup', 13, 9), 'standup history'),
    ];
    const items = todaysPrep([today, tomorrow, oneOff, today], notes, now);
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe('Weekly 1:1');
    expect(items[0]!.previous.map((n) => n.text)).toEqual(['last week', 'two weeks ago']);
    expect(items[0]!.pinned?.text).toBe('goals');
  });

  it('skips meetings with nothing to prepare from, and later occurrences', () => {
    const notes = [note(idAt('oneonone', 26, 9), 'next week')];
    expect(todaysPrep([today], notes, now)).toEqual([]);
  });
});
