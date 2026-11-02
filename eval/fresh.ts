import { readFile, writeFile } from 'node:fs/promises';
import { IndexClient } from '../src/core/http';
import { verifyReference } from '../src/core/verify';
import { VERDICTS } from '../src/core/types';
import { DiskCache } from './cache';

// A batch drawn after the verdict rules were frozen, disjoint from the messy corpus,
// because that corpus informed a rule and no longer counts as unseen.
const corpusPath = 'eval/fresh-corpus.json';
const disciplines = ['neuroscience', 'materials science', 'public health', 'sociology', 'computer vision', 'ecology'];
const perDiscipline = 10;
const seed = 40961;

function shuffle<T>(values: T[], start: number) {
  let state = start >>> 0;
  const next = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
const stripIds = (text: string) => text.replace(/https?:\/\/\S+|(?:doi:?\s*)?10\.\d{4,9}\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();

const client = new IndexClient(new DiskCache());
const known = new Set((JSON.parse(await readFile('eval/messy-corpus.json', 'utf8')).rows as { doi: string }[]).map(r => r.doi));

async function loadCorpus() {
  try { return JSON.parse(await readFile(corpusPath, 'utf8')); } catch { /* build it below */ }
  const rows: { discipline: string; citingDoi: string; doi: string; raw: string }[] = [];
  for (const [d, discipline] of disciplines.entries()) {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(discipline)}&filter=has-references:true,type:journal-article,from-pub-date:2015-01-01&select=DOI,reference&rows=200`;
    const response = await client.request(url);
    if (!response.ok) throw new Error(`Fresh corpus sampling failed: ${response.error}`);
    const picks: typeof rows = [];
    for (const article of shuffle(response.data.message.items as any[], seed + d)) {
      const usable = (article.reference ?? []).filter((r: any) => r.DOI && r.unstructured && !known.has(r.DOI.toLowerCase()) && /^[\x00-\x7FÀ-ɏ -⁯]+$/.test(r.unstructured) && stripIds(r.unstructured).length >= 50);
      const pick = shuffle(usable as any[], seed + d)[0];
      if (pick) picks.push({ discipline, citingDoi: article.DOI, doi: pick.DOI.toLowerCase(), raw: stripIds(pick.unstructured) });
      if (picks.length === perDiscipline) break;
    }
    rows.push(...picks);
  }
  await writeFile(corpusPath, JSON.stringify({ method: 'One deposited unstructured reference per citing article, new topical queries, fixed seed; identifiers stripped; DOIs in the messy corpus excluded. Drawn after the verdict rules were frozen.', rows }, null, 2) + '\n');
  return { rows };
}

const { rows } = await loadCorpus() as { rows: { discipline: string; doi: string; raw: string }[] };
const trials: (typeof rows[number] & { result: Awaited<ReturnType<typeof verifyReference>> })[] = [];
for (const row of rows) trials.push({ ...row, result: await verifyReference(row.raw, client) });
const counts = Object.fromEntries(VERDICTS.map(v => [v, trials.filter(t => t.result.verdict === v).length]));
const report = {
  runAt: new Date().toISOString(), total: trials.length, counts,
  falseAccusations: counts['No record found'], accepted: counts['Verified'] + counts['Details differ'], abstentions: counts['Could not check'],
  misjudged: trials.filter(t => !['Verified', 'Details differ'].includes(t.result.verdict)).map(t => ({ raw: t.raw, doi: t.doi, verdict: t.result.verdict, explanation: t.result.explanation, failed: t.result.evidence.filter(e => e.status === 'failed').map(e => e.index), nearest: t.result.nearest?.title })),
};
await writeFile('eval/fresh-results.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, misjudged: report.misjudged.map(m => `${m.verdict} | failed:${m.failed.join(',')} | ${m.raw.slice(0, 110)} | ${m.nearest?.slice(0, 60)}`) }, null, 1));
