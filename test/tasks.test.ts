import { describe, expect, it } from 'vitest';
import { toEventRef } from '../lib/event-id';
import type { Note } from '../lib/notes-store';
import { collectFollowUps, parseTasks, setTaskDone } from '../lib/tasks';

const text = 'Updates\n- [ ] Intro to design lead\n  * [x] Send deck\n- [ ]\n- not a task\n- [X] Book room';

describe('follow-ups', () => {
  it('parses open and done checklist lines, ignoring empty ones', () => {
    expect(parseTasks(text)).toEqual([
      { line: 1, done: false, text: 'Intro to design lead' },
      { line: 2, done: true, text: 'Send deck' },
      { line: 5, done: true, text: 'Book room' },
    ]);
  });

  it('ticks and unticks one line without touching the rest', () => {
    const ticked = setTaskDone(text, 1, true);
    expect(ticked.split('\n')[1]).toBe('- [x] Intro to design lead');
    expect(setTaskDone(ticked, 1, false)).toBe(text);
    expect(setTaskDone(text, 4, true)).toBe(text); // not a task line
  });

  it('groups open items by note, pinned notes first, then newest meeting', () => {
    const mk = (id: string, t: string, extra: Partial<Note> = {}): Note => ({
      ...toEventRef(id, 'cal'),
      text: t,
      createdAt: 1,
      updatedAt: 1,
      ...extra,
    });
    const groups = collectFollowUps([
      mk('s_20261005T100000Z', '- [ ] old'),
      mk('s_20261012T100000Z', '- [ ] newer\n- [x] done'),
      mk('none', 'no tasks'),
      mk('s', '- [ ] standing', { key: 'cal|s|series', kind: 'series' }),
    ]);
    expect(groups.map((g) => g.tasks.map((t) => t.text))).toEqual([['standing'], ['newer'], ['old']]);
  });
});
