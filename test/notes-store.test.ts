import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { toEventRef } from '../lib/event-id';
import { getAllNotes, getNote, getSeriesNotes, saveNote } from '../lib/notes-store';
import { exportNotes, importNotes } from '../lib/export';

beforeEach(() => fakeBrowser.reset());

describe('notes store', () => {
  it('creates, updates and keeps createdAt', async () => {
    const ref = toEventRef('abc', 'cal');
    const first = await saveNote(ref, 'hello', { title: '1:1' });
    const second = await saveNote(ref, 'hello again');
    expect(second?.createdAt).toBe(first?.createdAt);
    expect(second?.title).toBe('1:1');
    expect((await getNote(ref.key))?.text).toBe('hello again');
  });

  it('deletes the note when text is emptied', async () => {
    const ref = toEventRef('abc', 'cal');
    await saveNote(ref, 'hello');
    await saveNote(ref, '   ');
    expect(await getNote(ref.key)).toBeUndefined();
  });

  it('finds other occurrences of a series, newest first', async () => {
    await saveNote(toEventRef('s_20261005T100000Z', 'cal'), 'week 1');
    await saveNote(toEventRef('s_20261012T100000Z', 'cal'), 'week 2');
    await saveNote(toEventRef('s_20261012T100000Z', 'other-cal'), 'not mine');
    await saveNote(toEventRef('unrelated', 'cal'), 'nope');
    const series = await getSeriesNotes({ calendarId: 'cal', seriesId: 's' });
    expect(series.map((n) => n.text)).toEqual(['week 2', 'week 1']);
  });
});

describe('export / import', () => {
  it('round-trips and keeps the newer copy', async () => {
    const ref = toEventRef('abc', 'cal');
    await saveNote(ref, 'original');
    const file = JSON.parse(JSON.stringify(await exportNotes()));

    await saveNote(ref, 'edited later');
    expect(await importNotes(file)).toEqual({ imported: 0, skipped: 1 });
    expect((await getNote(ref.key))?.text).toBe('edited later');

    await fakeBrowser.storage.local.clear();
    expect(await importNotes(file)).toEqual({ imported: 1, skipped: 0 });
    expect((await getAllNotes()).map((n) => n.text)).toEqual(['original']);
  });

  it('rejects unrelated files', async () => {
    await expect(importNotes({ hello: 'world' })).rejects.toThrow();
  });
});

describe('pinned series notes', () => {
  it('are stored per series, excluded from occurrence history and the free limit', async () => {
    const { saveSeriesNote, getSeriesNotes: series, getAllNotes: all } = await import('../lib/notes-store');
    const { lockedKeys } = await import('../lib/plan');
    const ref = toEventRef('s_20261019T100000Z', 'cal');
    await saveSeriesNote(ref, 'standing agenda', { title: '1:1', when: 'Mon 10am', url: 'https://calendar.google.com/x' });
    for (let i = 0; i < 5; i++) await saveNote(toEventRef(`e${i}`, 'cal'), `n${i}`);

    const pinned = (await all()).find((n) => n.kind === 'series')!;
    expect(pinned).toMatchObject({ key: 'cal|s|series', seriesId: 's', title: '1:1', text: 'standing agenda' });
    expect(pinned.when).toBeUndefined();
    expect(await series({ calendarId: 'cal', seriesId: 's' })).toEqual([]);
    expect(lockedKeys(await all(), false).size).toBe(0);
  });

  it('survive export and import', async () => {
    const { saveSeriesNote } = await import('../lib/notes-store');
    await saveSeriesNote(toEventRef('s_20261019T100000Z', 'cal'), 'standing agenda');
    const file = JSON.parse(JSON.stringify(await exportNotes()));
    await fakeBrowser.storage.local.clear();
    expect(await importNotes(file)).toEqual({ imported: 1, skipped: 0 });
    expect(await getNote('cal|s|series')).toMatchObject({ kind: 'series', text: 'standing agenda' });
  });
});
