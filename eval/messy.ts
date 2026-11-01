import { readFile, writeFile } from 'node:fs/promises';
import { verifyReference } from '../src/core/verify';
import { VERDICTS } from '../src/core/types';
import type { IndexClient } from '../src/core/http';

// Genuine references as real authors typed them: unstructured strings deposited
// with Crossref, in the citing articles' own house styles, with identifiers removed.
// The harder test for false accusations, since nothing here comes from clean metadata.
const corpusPath = 'eval/messy-corpus.json';
const disciplines = ['machine learning', 'molecular biology', 'quantum physics', 'cognitive psychology', 'economic history', 'climate science'];
const perDiscipline = 20;

function shuffle<T>(values: T[], seed: number) {
  let state = seed >>> 0;
  const next = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
const stripIds = (text: string) => text.replace(/https?:\/\/\S+|(?:doi:?\s*)?10\.\d{4,9}\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();

async function loadCorpus(client: IndexClient) {
  try { return JSON.parse(await readFile(corpusPath, 'utf8')); } catch { /* build it below */ }
  const rows: { discipline: string; citingDoi: string; doi: string; raw: string }[] = [];
  for (const [d, discipline] of disciplines.entries()) {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(discipline)}&filter=has-references:true,type:journal-article,from-pub-date:2015-01-01&select=DOI,reference&rows=200`;
    const response = await client.request(url);
    if (!response.ok) throw new Error(`Messy corpus sampling failed: ${response.error}`);
    const picks: typeof rows = [];
    for (const article of shuffle(response.data.message.items as any[], 5150 + d)) {
      const usable = (article.reference ?? []).filter((r: any) => r.DOI && r.unstructured && /^[\x00-\x7FÀ-ɏ -⁯]+$/.test(r.unstructured) && stripIds(r.unstructured).length >= 50);
      const pick = shuffle(usable as any[], 5150 + d)[0];
      if (pick) picks.push({ discipline, citingDoi: article.DOI, doi: pick.DOI.toLowerCase(), raw: stripIds(pick.unstructured) });
      if (picks.length === perDiscipline) break;
    }
    rows.push(...picks);
  }
  await writeFile(corpusPath, JSON.stringify({ method: 'One deposited unstructured reference per citing article, Crossref topical query, fixed seed; identifiers stripped.', rows }, null, 2) + '\n');
  return { rows };
}

export async function messyGenuine(client: IndexClient, tuning: boolean) {
  const { rows } = await loadCorpus(client) as { rows: { discipline: string; doi: string; raw: string }[] };
  // Even positions are for tuning; odd positions stay held out.
  const subset = rows.filter((_, i) => i % 2 === (tuning ? 0 : 1));
  const trials: (typeof subset[number] & { result: Awaited<ReturnType<typeof verifyReference>> })[] = [];
  for (const row of subset) trials.push({ ...row, result: await verifyReference(row.raw, client) });
  const counts = Object.fromEntries(VERDICTS.map(v => [v, trials.filter(t => t.result.verdict === v).length]));
  const report = {
    total: trials.length, counts,
    falseAccusations: counts['No record found'],
    accepted: counts['Verified'] + counts['Details differ'],
    abstentions: counts['Could not check'],
    misjudged: trials.filter(t => !['Verified', 'Details differ'].includes(t.result.verdict)).map(t => ({ raw: t.raw, doi: t.doi, verdict: t.result.verdict, nearest: t.result.nearest?.title })),
  };
  return report;
}
