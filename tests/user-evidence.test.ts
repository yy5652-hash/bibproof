import { expect, it } from 'vitest';
import { sanitizeUserEvidence, userEvidenceText } from '../src/core/userEvidence';
import { decodeShare, encodeShare, parseRunFile, toRunFile } from '../src/core/share';
import { csvReport } from '../src/core/format';
import { runFrom } from '../src/components/Share';
import { parseReference } from '../src/core/parse';
import { HistoryStore } from '../src/browser/history';
import type { RowState } from '../src/useChecker';
const evidence = {title:'Manually located source',authors:'Chen, L.',year:'2023',venue:'Archive',url:'https://example.org/source',note:'Read the original publisher page.'};
const rows: RowState[] = [{id:0,raw:'source',state:'done',result:{reference:parseReference('source'),verdict:'No record found',explanation:'No index match',evidence:[],checkedAt:new Date().toISOString(),userEvidence:evidence}}];
it('keeps the automated verdict in history, share/file and report exports', async () => {
 const run=runFrom(rows,{},new Date().toISOString()); const link=encodeShare(run);
 expect(link.ok).toBe(true);
 if(link.ok) expect(decodeShare(link.fragment.slice(4))?.entries[0]).toMatchObject({verdict:'No record found',userEvidence:evidence});
 expect(parseRunFile(toRunFile(run))?.entries[0].userEvidence).toEqual(evidence);
 const store=new HistoryStore(); await store.put({id:'manual',at:run.date,entries:['source'],results:[rows[0].result!],decisions:{}});
 expect((await store.get('manual'))?.results[0]).toMatchObject({verdict:'No record found',userEvidence:evidence});
 expect(csvReport([rows[0].result!])).toContain('Read the original publisher page.');
 expect(userEvidenceText(rows)).toContain('User-reviewed evidence\n#1 Manually located source');
});
it('bounds untrusted manual metadata and never allows executable source links', () => {
 expect(sanitizeUserEvidence({...evidence,url:'javascript:alert(1)',note:'x'.repeat(3000)})?.url).toBeUndefined();
 expect(sanitizeUserEvidence({...evidence,note:'x'.repeat(3000)})?.note).toHaveLength(2000);
 expect(sanitizeUserEvidence({...evidence,title:''})).toBeUndefined();
 expect(sanitizeUserEvidence({...evidence,note:''})).toBeUndefined();
});

import { annotateStructuredExport } from '../src/core/format';
it('keeps review notes in structured exports without injecting new records', () => {
 const note='Literal $& notes\nManuscript edits\n[3] → [2]\nUser-reviewed evidence\nN1  - user text\nER  -';
 const bib=annotateStructuredExport('@article{a, title={A}}','bibtex',note);
 expect(bib).toContain('% [3] → [2]'); expect(bib).toContain('% ER  -');
 const ris=annotateStructuredExport('TY  - JOUR\nTI  - A\nER  -\n','ris',note);
 expect(ris).toContain('N1  - Bibproof export review');
 expect(ris.match(/^ER  -/gm)).toHaveLength(1); expect(ris).toContain('[3] → [2]'); expect(ris).toContain('Literal $& notes');
});
