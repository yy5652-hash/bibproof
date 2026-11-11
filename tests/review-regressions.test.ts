import { describe, expect, it } from 'vitest';
import { completionSummary, numberMap, numberMapText } from '../src/core/decisions';
import { parseReference } from '../src/core/parse';
import { matchingDetailsDiffer, scoreCandidate } from '../src/core/score';
import { fromCrossref } from '../src/core/indexes';
import { decodeShare, encodeShare } from '../src/core/share';
import { runFrom } from '../src/components/Share';
import type { CheckResult, Work } from '../src/core/types';
import type { RowState } from '../src/useChecker';
const result: CheckResult = { reference: parseReference('x'), verdict: 'Verified', explanation: '', evidence: [], checkedAt: new Date().toISOString() };
const rows: RowState[] = [0,1,2].map(id => ({id, raw:`[${id+1}] reference`, state:id===0?'done':'skipped', result:id===0?result:undefined}));
describe('cancelled and restored runs', () => {
  it('does not claim all verified when any result is missing', () => {
    expect(completionSummary(rows)).toEqual({checked:1, unchecked:2, attention:0, allVerified:false});
    expect(completionSummary(JSON.parse(JSON.stringify(rows))).allVerified).toBe(false);
    expect(completionSummary([]).allVerified).toBe(false);
  });
  it('shares all entries including the unchecked ones', () => {
    const run = runFrom(rows, {}, new Date().toISOString()); const encoded = encodeShare(run);
    expect(encoded.ok).toBe(true);
    if (encoded.ok) expect(decodeShare(encoded.fragment.slice(4))?.entries.map(e => e.verdict)).toEqual(['Verified','Not checked','Not checked']);
  });
});
it('preserves short author-year and quoted titles', () => {
  expect(parseReference('LeCun, Y., Bengio, Y., & Hinton, G. (2022). Deep learning. Nature, 521, 436–444.').title).toBe('Deep learning');
  expect(parseReference('Y. LeCun, "Deep learning," Nature, 2015.').title).toBe('Deep learning');
});
it('separates evidence agreement from containment and one-year tolerance', () => {
  const ref = parseReference('He, K. (2016). Deep Residual Learning for Image Recognition. Nature.');
  const w: Work = {id:'w', title:'Deep learning', authors:[{family:'He'}], year:2015, source:'Crossref', url:'https://example.org'};
  const s = scoreCandidate(ref,w);
  expect(s.title).toBe(1);
  expect(s.fields.find(f => f.field==='Title')?.status).toBe('differ');
  expect(s.fields.find(f => f.field==='Year')?.status).toBe('tolerance');
  expect(matchingDetailsDiffer(ref,w,s)).toBe(true); // isolated title identity is required
});
it('maps removal and replacement without losing original manuscript numbers', () => {
  expect(numberMap(rows,{1:{kind:'remove'},2:{kind:'record'}})).toEqual([
    {id:0,old:'1',next:1,changed:false},{id:1,old:'2',next:null,changed:true},{id:2,old:'3',next:2,changed:true}
  ]);
  expect(numberMapText(rows,{1:{kind:'remove'}})).toContain('[3] → [2]');
  expect(numberMap([{id:8,raw:'[12] work'}],{} )[0]).toMatchObject({old:'12',next:1});
});
it('retracted articles and retraction notices have opposite relationship directions', () => {
  const article = fromCrossref({DOI:'10.1/article', title:['Article'], 'updated-by':[{type:'retraction',DOI:'10.1/notice'}]});
  const notice = fromCrossref({DOI:'10.1/notice', title:['Retraction notice'], 'update-to':[{type:'retraction',DOI:'10.1/article'}]});
  expect(article.retracted).toBe(true); expect(article.retractionUrls).toEqual(['https://doi.org/10.1/notice']);
  expect(notice.retracted).toBe(false); expect(notice.retractionUrls).toEqual([]);
});
