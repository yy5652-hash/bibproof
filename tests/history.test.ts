import { describe, expect, it } from 'vitest';
import { HistoryStore, type StoredRun } from '../src/browser/history';

const run = (id: string): StoredRun => ({ id, at: '2026-11-02T00:00:00.000Z', entries: ['A'], results: [null], decisions: {} });

describe('history', () => {
  it('a deleted run stays deleted when the open session saves it again', async () => {
    const store = new HistoryStore();
    await store.put(run('a')); await store.remove('a'); await store.put(run('a'));
    expect(await store.list()).toEqual([]);
  });
  it('clearing history also stops later saves of those runs', async () => {
    const store = new HistoryStore();
    await store.put(run('a')); await store.clear(); await store.put(run('a')); await store.put(run('b'));
    expect((await store.list()).map(r => r.id)).toEqual(['b']);
  });
});
