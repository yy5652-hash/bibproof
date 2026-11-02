// Development-only: a finished run of N synthetic references, to prove the list stays smooth at 300. Never bundled into the production build.
import type { CheckResult, Verdict, Work } from '../core/types';
import { parseReference } from '../core/parse';

const TOPICS = ['graph sampling', 'protein folding', 'monetary policy', 'coastal erosion', 'language acquisition', 'battery chemistry', 'urban transit', 'soil carbon'];
export function fixtureRun(n = 300): { entries: string[]; results: CheckResult[] } {
  const entries: string[] = []; const results: CheckResult[] = [];
  for (let i = 0; i < n; i++) {
    const year = 2005 + (i % 20); const topic = TOPICS[i % TOPICS.length];
    const title = `A study of ${topic} in setting number ${i + 1}`;
    const raw = `[${i + 1}] Author${i}, A., & Coauthor${i}, B. (${year}). ${title}. Journal of Fixtures, ${10 + (i % 40)}, ${100 + i}–${110 + i}.`;
    const verdict: Verdict = (['Verified', 'Verified', 'Verified', 'Verified', 'Verified', 'Verified', 'Details differ', 'No record found', 'Could not check', i % 20 === 9 ? 'Retracted' : 'Identifier conflict'] as const)[i % 10];
    const work: Work = { id: `w${i}`, title, authors: [{ family: `Author${i}`, given: 'A.' }, { family: `Coauthor${i}`, given: 'B.' }], year: verdict === 'Details differ' ? year + 2 : year, venue: 'Journal of Fixtures', doi: `10.0000/fixture.${i}`, url: `https://doi.org/10.0000/fixture.${i}`, source: 'Crossref' };
    const alt: Work = { ...work, id: `a${i}`, title: `${title}, revisited`, doi: `10.0000/fixture.${i}.alt`, url: `https://doi.org/10.0000/fixture.${i}.alt` };
    const hasRecord = verdict !== 'No record found' && verdict !== 'Could not check';
    results.push({
      reference: parseReference(raw), verdict, explanation: verdict === 'Verified' ? 'The indexed title and authors agree. Publication year allows a one-year online-first difference.' : verdict === 'No record found' ? 'No matching record in 3 indexes. Likely fabricated, check by hand.' : 'A matching work exists, but the highlighted fields differ.',
      evidence: [{ index: 'Crossref', status: 'answered', url: 'https://api.crossref.org/works', count: hasRecord ? 1 : 0 }], checkedAt: new Date().toISOString(),
      ...(hasRecord ? { match: work } : {}), ...(verdict !== 'Verified' ? { alternatives: [alt] } : {}),
    });
    entries.push(raw);
  }
  return { entries, results };
}
