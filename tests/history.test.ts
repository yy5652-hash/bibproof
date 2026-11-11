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

import { extractReferences } from '../src/core/extract';
import { crossCheck } from '../src/core/crosscheck';
import { citingSentences } from '../src/core/citing';
it('persists document findings and citing sentences without the manuscript',async()=>{
 const ex=extractReferences('PRIVATE UNCITED PARAGRAPH. A claim (Smith, 2020). Missing (Jones, 2022).\nReferences\nSmith, J. (2020). Work.\nLee, A. (2021). Unused.');
 const stored:StoredRun={...run('doc'),entries:ex.entries,results:ex.entries.map(()=>null),fullDocument:ex.fullDocument,cross:crossCheck(ex.body,ex.entries),citing:citingSentences(ex.body,ex.entries,true)};
 const store=new HistoryStore();await store.put(stored);const restored=await store.get('doc');
 expect(restored?.fullDocument).toBe(true);expect(restored?.cross?.missing).toContain('Jones, 2022');expect(restored?.cross?.uncited).toEqual([2]);
 expect(JSON.stringify(restored)).not.toContain('PRIVATE UNCITED PARAGRAPH');expect(restored?.citing?.byEntry[0]).toHaveLength(1);
});
