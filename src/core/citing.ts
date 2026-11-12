import { normalize, parseReference } from './parse';

/** Sentences of the document body that cite each reference entry, computed on the device. */
export interface AmbiguousCitation { key:string; citation:string; sentence:string; candidates:number[]; chosen?:number }
export interface Citing { baseByEntry?:string[][]; ambiguous?:AmbiguousCitation[]; byReference?:Record<string,string[]>; detected: boolean; style: 'numeric' | 'author-year' | 'mixed' | 'none'; byEntry: string[][]; counts: number[] }

const NUMERIC = /\[((?:\d+\s*(?:[–-]\s*\d+)?\s*[,;]?\s*)+)\]/g;
export const AUTHOR_YEAR = /([\p{Lu}][\p{L}'’-]+)(?:\s+(?:et al\.?|(?:and|&)\s+[\p{Lu}][\p{L}'’-]+))?[,\s]*\(?((?:19|20)\d{2})([a-z])?\)?/gu;
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
  const ambiguous:AmbiguousCitation[]=[];
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
      const matches=refs.flatMap((r,i)=>r.year===Number(m[2]) && (r.yearSuffix??'')===(m[3]??'') && normalize(r.surnames[0]??'')===surname?[i]:[]);
      if(matches.length>1){ambiguous.push({key:`ambiguous-${ambiguous.length}`,citation:m[0],sentence,candidates:matches});continue;}
      const at=matches[0]??-1;
      if (at >= 0 && !hits.has(at)) hits.set(at, m.index ?? 0);
    }
    for (const [at, where] of hits) {
      counts[at]++;
      if (complete || byEntry[at].length < MAX_PER_ENTRY) byEntry[at].push(complete ? sentence : clip(sentence, where));
    }
  }
  const style = numeric && authorYear ? 'mixed' : numeric ? 'numeric' : authorYear ? 'author-year' : 'none';
  return { ambiguous, byReference:Object.fromEntries(entries.map((raw,id)=>[referenceId(raw,id),byEntry[id]])), detected: style !== 'none', style, byEntry, counts };
}

/** Stable within a run, independent of display sorting and bibliography renumbering. */
export function referenceId(raw:string,id:number):string {
  let hash=2166136261;for(const ch of raw)hash=Math.imul(hash^ch.charCodeAt(0),16777619);
  return `ref-${id}-${(hash>>>0).toString(36)}`;
}
export function resolveCitation(citing:Citing,key:string,chosen:number|undefined,entries:string[]):Citing {
  const ambiguous=(citing.ambiguous??[]).map(a=>a.key===key?{...a,chosen:a.candidates.includes(chosen!)?chosen:undefined}:a);
  // Keep unambiguous bindings separately so changing a selection never loses a real citation.
  const base=citing.baseByEntry??citing.byEntry;
  const byEntry=base.map(sentences=>[...sentences]);
  for(const a of ambiguous)if(a.chosen!==undefined&&!byEntry[a.chosen].includes(a.sentence))byEntry[a.chosen].push(a.sentence);
  return {...citing,baseByEntry:base,ambiguous,byEntry,counts:byEntry.map(s=>s.length),byReference:Object.fromEntries(entries.map((raw,id)=>[referenceId(raw,id),byEntry[id]]))};
}
