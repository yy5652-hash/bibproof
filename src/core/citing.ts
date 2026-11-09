import { normalize, parseReference } from './parse';

/** Sentences of the document body that cite each reference entry, computed on the device. */
export interface Citing { detected: boolean; style: 'numeric' | 'author-year' | 'mixed' | 'none'; byEntry: string[][]; counts: number[] }

const NUMERIC = /\[((?:\d+\s*(?:[–-]\s*\d+)?\s*[,;]?\s*)+)\]/g;
const AUTHOR_YEAR = /([\p{Lu}][\p{L}'’-]+)(?:\s+(?:et al\.?|(?:and|&)\s+[\p{Lu}][\p{L}'’-]+))?[,\s]*\(?((?:19|20)\d{2})([a-z])?\)?/gu;
const ABBREVIATION = /(?<!\b(?:et al|e\.g|i\.e|Fig|Figs|Eq|Eqs|vs|cf|Dr|Prof|No|Nos|approx|ca|Sec|Ch)\.)(?<!\b\p{Lu}\.)/u;
const BOUNDARY = new RegExp(`(?<=[.!?])${ABBREVIATION.source}\\s+(?=[\\p{Lu}\\p{N}("“\\[])`, 'u');
const MAX_LEN = 320;
const MAX_PER_ENTRY = 4;

export function splitSentences(body: string): string[] {
  const flat = body.replace(/\s+/g, ' ').replace(/([。！？])/g, '$1\n').trim();
  return flat.split('\n').flatMap(chunk => chunk.split(BOUNDARY)).map(s => s.trim()).filter(s => s.length > 1);
}

function clip(sentence: string, at: number): string {
  if (sentence.length <= MAX_LEN) return sentence;
  const start = Math.max(0, Math.min(at - 120, sentence.length - MAX_LEN));
  return `${start > 0 ? '… ' : ''}${sentence.slice(start, start + MAX_LEN).trim()}${start + MAX_LEN < sentence.length ? ' …' : ''}`;
}

export function numbersIn(group: string): number[] {
  return group.split(/[,;]/).flatMap(part => {
    const [a, b] = part.trim().split(/[–-]/).map(Number);
    if (!Number.isFinite(a)) return [];
    return b && b >= a && b - a < 1000 ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a];
  });
}

export function citingSentences(body: string, entries: string[], complete = false): Citing {
  const refs = entries.map(parseReference);
  const byEntry: string[][] = refs.map(() => []);
  const counts = refs.map(() => 0);
  let numeric = 0; let authorYear = 0;
  for (const sentence of splitSentences(body)) {
    const hits = new Map<number, number>();
    for (const m of sentence.matchAll(NUMERIC)) {
      numeric++;
      for (const n of numbersIn(m[1])) {
        const at = refs.findIndex((r, i) => (r.label ?? String(i + 1)) === String(n));
        if (at >= 0 && !hits.has(at)) hits.set(at, m.index ?? 0);
      }
    }
    for (const m of sentence.matchAll(AUTHOR_YEAR)) {
      authorYear++;
      const surname = normalize(m[1]);
      const at = refs.findIndex(r => r.year === Number(m[2]) && (r.yearSuffix ?? '') === (m[3] ?? '') && r.surnames.some(s => normalize(s) === surname));
      if (at >= 0 && !hits.has(at)) hits.set(at, m.index ?? 0);
    }
    for (const [at, where] of hits) {
      counts[at]++;
      if (complete || byEntry[at].length < MAX_PER_ENTRY) byEntry[at].push(complete ? sentence : clip(sentence, where));
    }
  }
  const style = numeric && authorYear ? 'mixed' : numeric ? 'numeric' : authorYear ? 'author-year' : 'none';
  return { detected: style !== 'none', style, byEntry, counts };
}
