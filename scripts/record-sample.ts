/** A fresh public-API run, never synthesized verdicts. Does not modify eval results. */
import { writeFile } from 'node:fs/promises';
import { IndexClient } from '../src/core/http';
import { verifyReference } from '../src/core/verify';
import { sampleEntries } from '../src/core/sample';
import { DiskCache } from '../eval/cache';
import type { Cache, CheckResult } from '../src/core/types';
const budget = new DiskCache();
// Share the daily OpenAlex counter, but bypass prior response cache entries.
const cache: Cache = { get: k => k.startsWith('openalex-budget:') ? budget.get(k) : Promise.resolve(undefined), set: async (k,v) => { if(k.startsWith('openalex-budget:')) await budget.set(k,v); } };
const responses: Record<string, { status: number; body: unknown }> = {};
const transport: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  try { responses[String(input)] = {status:response.status,body:await response.clone().json()}; } catch { /* retain failure in result evidence */ }
  return response;
};
const client = new IndexClient(cache, transport);
const results: CheckResult[] = [];
for (const entry of sampleEntries) {
  const r = await verifyReference(entry.raw, client); results.push(r);
  console.log(`${results.length}. Expected ${entry.kind}; got ${r.verdict}`);
}
const snapshot = { runAt: new Date().toISOString(), provenance: 'Fresh live public scholarly index requests; no response replay or verdict overrides.', entries: sampleEntries.map(e=>e.raw), results };
if (results.some((r,i)=>r.verdict!==sampleEntries[i].kind)) {
  await writeFile('/tmp/bibproof-sample-attempt.json',JSON.stringify(snapshot,null,2)+'\n');
  console.error('Snapshot not published: at least one intended verdict failed. See /tmp/bibproof-sample-attempt.json.');
  process.exitCode=1;
} else {
  await writeFile('src/core/sample-snapshot.json',JSON.stringify(snapshot,null,2)+'\n');
  // Exact live evidence for reproducible browser checks, kept separate from older fixtures.
  await writeFile('tests/e2e/fixtures/sample-current-responses.json',JSON.stringify(responses)+'\n');
  console.log('Saved live snapshot; all intended verdicts matched.');
}
