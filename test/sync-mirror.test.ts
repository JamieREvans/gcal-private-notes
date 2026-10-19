import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { toEventRef } from '../lib/event-id';
import { getNote, putNote, type Note } from '../lib/notes-store';
import {
  BUDGET_ITEMS,
  fullSync,
  mergeFromSync,
  planEvictions,
  pushNote,
  pushTombstone,
  syncKey,
  TOMBSTONE_TTL_MS,
  type SyncValue,
} from '../lib/sync-mirror';

beforeEach(() => fakeBrowser.reset());

function note(id: string, updatedAt: number, text = 'x'): Note {
  const ref = toEventRef(id, 'cal');
  return { ...ref, text, createdAt: updatedAt, updatedAt };
}

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
    await pushNote('cal|newest');

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

  it('writes a tombstone for a user delete', async () => {
    await putNote(note('a', 100));
    await pushNote('cal|a');
    await fakeBrowser.storage.local.remove('note:cal|a');
    await pushNote('cal|a');
    expect((await fakeBrowser.storage.sync.get('n:cal|a'))['n:cal|a']).toMatchObject({ deleted: true });
    // Re-deleting does not bump the tombstone.
    const before = (await fakeBrowser.storage.sync.get('n:cal|a'))['n:cal|a'];
    await pushTombstone('cal|a');
    expect((await fakeBrowser.storage.sync.get('n:cal|a'))['n:cal|a']).toEqual(before);
  });

  it('fullSync pulls remote notes into local', async () => {
    await fakeBrowser.storage.sync.set({ 'n:cal|remote': note('remote', 50, 'from other device') });
    await putNote(note('local', 60));
    await fullSync();
    expect((await getNote('cal|remote'))?.text).toBe('from other device');
    expect(await fakeBrowser.storage.sync.get('n:cal|local')).toHaveProperty('n:cal|local');
  });
});
