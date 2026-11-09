import { expect, it } from 'vitest';
import snapshot from '../src/core/sample-snapshot.json';
import { sampleEntries } from '../src/core/sample';
import { scoreCandidate } from '../src/core/score';
import { parseReference } from '../src/core/parse';
import type { Work } from '../src/core/types';
it('the saved live sample contains the intended verdicts, exact entries and real query evidence', () => {
 expect(snapshot.entries).toEqual(sampleEntries.map(e=>e.raw));
 expect(snapshot.results.map(r=>r.verdict)).toEqual(sampleEntries.map(e=>e.kind));
 expect(Number.isFinite(Date.parse(snapshot.runAt))).toBe(true);
 for(const r of snapshot.results) {
   expect(r.evidence.length).toBeGreaterThan(0);
   expect(r.evidence.every(e=>e.status==='answered')).toBe(true);
   expect(r.evidence.every(e=>e.url.startsWith('https://'))).toBe(true);
 }
 expect(snapshot.results[2].reference.title).toBe('Deep learning');
 const fields=(snapshot.results[4] as {score:{fields:{field:string;status:string}[]}}).score.fields; // conflict rows mark the title as differing
 expect(fields.find(f=>f.field==='Title')?.status).toBe('differ');
 expect(fields.find(f=>f.field==='Year')?.status).toBe('tolerance');
});
