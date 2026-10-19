import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { toEventRef } from '../lib/event-id';
import { deleteAllNotes, deleteNote, getNote, getPendingDeletes, putNote, type Note } from '../lib/notes-store';
import {
  BUDGET_ITEMS,
  fullSync,
  mergeFromSync,
  planEvictions,
  pushChanges,
  startSyncMirror,
  syncKey,
  TOMBSTONE_TTL_MS,
  type SyncValue,
} from '../lib/sync-mirror';

beforeEach(() => fakeBrowser.reset());

function note(id: string, updatedAt: number, text = 'x'): Note {
  const ref = toEventRef(id, 'cal');
  return { ...ref, text, createdAt: updatedAt, updatedAt };
}
const syncValue = async (key: string) => (await fakeBrowser.storage.sync.get(key))[key];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('planEvictions', () => {
  it('evicts nothing when there is room', () => {
    expect(planEvictions({}, 'n:a', note('a', 1))).toEqual([]);
  });

  it('evicts the oldest entries first when over the item budget', () => {
    const existing: Record<string, SyncValue> = {};
    for (let i = 0; i < BUDGET_ITEMS; i++) existing[syncKey(`cal|e${i}`)] = note(`e${i}`, 100 + i);
    expect(planEvictions(existing, 'n:cal|new', note('new', 10_000))).toEqual(['n:cal|e0']);
  });

  it('evicts expired tombstones before older notes', () => {
    const now = TOMBSTONE_TTL_MS * 2;
    const existing: Record<string, SyncValue> = {};
    for (let i = 0; i < BUDGET_ITEMS - 1; i++) existing[syncKey(`cal|e${i}`)] = note(`e${i}`, 100 + i);
    existing['n:cal|gone'] = { deleted: true, updatedAt: 500 };
    expect(planEvictions(existing, 'n:cal|new', note('new', now), now)).toEqual(['n:cal|gone']);
  });

  it('refuses to evict newer notes to make room for an older one', () => {
    const existing: Record<string, SyncValue> = {};
    for (let i = 0; i < BUDGET_ITEMS; i++) existing[syncKey(`cal|e${i}`)] = note(`e${i}`, 100 + i);
    expect(planEvictions(existing, 'n:cal|old', note('old', 1))).toBeNull();
  });

  it('refuses notes that exceed the per-item limit', () => {
    expect(planEvictions({}, 'n:cal|big', note('big', 1, 'x'.repeat(8_000)))).toBeNull();
  });
});

describe('push and merge', () => {
  it('evicts from sync but never from local', async () => {
    for (let i = 0; i < BUDGET_ITEMS; i++) await putNote(note(`e${i}`, 100 + i));
    await fullSync();
    await putNote(note('newest', 10_000));
    await pushChanges(['cal|newest']);

    const sync = await fakeBrowser.storage.sync.get(null);
    expect(Object.keys(sync)).toHaveLength(BUDGET_ITEMS);
    expect(sync['n:cal|e0']).toBeUndefined();
    expect(sync['n:cal|newest']).toBeDefined();
    expect(await getNote('cal|e0')).toBeDefined();
  });

  it('applies newer remote edits and ignores older ones', async () => {
    await putNote(note('a', 200, 'local'));
    await mergeFromSync('cal|a', note('a', 100, 'stale remote'));
    expect((await getNote('cal|a'))?.text).toBe('local');
    await mergeFromSync('cal|a', note('a', 300, 'fresh remote'));
    expect((await getNote('cal|a'))?.text).toBe('fresh remote');
  });

  it('honours tombstones only when newer than the local edit', async () => {
    await putNote(note('a', 200));
    await mergeFromSync('cal|a', { deleted: true, updatedAt: 100 });
    expect(await getNote('cal|a')).toBeDefined();
    await mergeFromSync('cal|a', { deleted: true, updatedAt: 300 });
    expect(await getNote('cal|a')).toBeUndefined();
  });

  it('ignores malformed or mismatched remote notes', async () => {
    await mergeFromSync('cal|a', { ...note('b', 300), title: 42 } as unknown as Note);
    expect(await getNote('cal|a')).toBeUndefined();
    await mergeFromSync('cal|a', { ...note('a', 300), url: 'https://evil.example/' });
    expect((await getNote('cal|a'))?.url).toBeUndefined();
  });

  it('writes a tombstone stamped with the delete time, then forgets the pending delete', async () => {
    await putNote(note('a', 100));
    await pushChanges(['cal|a']);
    const before = Date.now();
    await deleteNote('cal|a');
    await pushChanges(['cal|a']);
    const tomb = (await syncValue('n:cal|a')) as SyncValue;
    expect(tomb).toMatchObject({ deleted: true });
    expect(tomb.updatedAt).toBeGreaterThanOrEqual(before);
    expect(await getPendingDeletes()).toEqual({});
  });

  it('does not resurrect a note deleted before its tombstone was pushed', async () => {
    await putNote(note('a', 100));
    await pushChanges(['cal|a']);
    await deleteNote('cal|a'); // browser closes before the debounced push
    await fullSync(); // next startup
    expect(await getNote('cal|a')).toBeUndefined();
    expect(await syncValue('n:cal|a')).toMatchObject({ deleted: true });
  });

  it('lets an edit made elsewhere after the delete win', async () => {
    await putNote(note('a', 100));
    await deleteNote('cal|a');
    await fakeBrowser.storage.sync.set({ 'n:cal|a': note('a', Date.now() + 60_000, 'edited on laptop') });
    await fullSync();
    expect((await getNote('cal|a'))?.text).toBe('edited on laptop');
  });

  it('pushes "delete all" as a single batched write', async () => {
    for (let i = 0; i < 200; i++) await putNote(note(`e${i}`, 100 + i));
    await fullSync();
    const set = vi.spyOn(browser.storage.sync, 'set');
    await deleteAllNotes();
    await pushChanges();
    expect(set).toHaveBeenCalledTimes(1);
    const sync = await fakeBrowser.storage.sync.get(null);
    expect(Object.values(sync).every((v) => (v as { deleted?: boolean }).deleted)).toBe(true);
  });

  it('fullSync pulls remote notes into local', async () => {
    await fakeBrowser.storage.sync.set({ 'n:cal|remote': note('remote', 50, 'from other device') });
    await putNote(note('local', 60));
    await fullSync();
    expect((await getNote('cal|remote'))?.text).toBe('from other device');
    expect(await syncValue('n:cal|local')).toBeDefined();
  });
});

describe('startSyncMirror', () => {
  it('pushes local edits after the debounce', async () => {
    const stop = startSyncMirror(async () => true, 20);
    await putNote(note('a', 100));
    await wait(80);
    expect(await syncValue('n:cal|a')).toBeDefined();
    stop();
  });

  it('writes nothing if sync is switched off before the debounce fires', async () => {
    let enabled = true;
    const stop = startSyncMirror(async () => enabled, 30);
    await putNote(note('a', 100));
    enabled = false;
    await wait(100);
    expect(await syncValue('n:cal|a')).toBeUndefined();
    stop();
  });
});
