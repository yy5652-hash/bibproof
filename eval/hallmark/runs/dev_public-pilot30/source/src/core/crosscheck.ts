import { normalize, parseReference } from './parse';
export interface CrossCheck { style: string; missing: string[]; uncited: number[]; note: string }
export function crossCheck(body: string, entries: string[]): CrossCheck {
  const refs=entries.map(parseReference); const cited=new Set<number>(); const missing=new Set<string>();
  const numeric=[...body.matchAll(/\[((?:\d+\s*(?:[–-]\s*\d+)?\s*[,;]?\s*)+)\]/g)];
  const authorYear=[...body.matchAll(/([\p{Lu}][\p{L}'’-]+)(?:\s+(?:et al\.?|(?:and|&)\s+[\p{Lu}][\p{L}'’-]+))?[,\s]*\(?((?:19|20)\d{2})([a-z])?\)?/gu)];
  for(const m of numeric){
    const nums=m[1].split(/[,;]/).flatMap(part=>{const [a,b]=part.trim().split(/[–-]/).map(Number);return b&&b>=a&&b-a<1000?Array.from({length:b-a+1},(_,i)=>a+i):[a];});
    for(const n of nums){const at=refs.findIndex((r,i)=>(r.label??String(i+1))===String(n));if(at>=0)cited.add(at);else missing.add(`[${n}]`);}
  }
  for(const m of authorYear){const surname=normalize(m[1]); const at=refs.findIndex(r=>r.year===Number(m[2]) && (r.yearSuffix??'')===(m[3]??'') && r.surnames.some(s=>normalize(s)===surname)); if(at>=0)cited.add(at);else missing.add(`${m[1]}, ${m[2]}${m[3]??''}`);}
  const detected=numeric.length+authorYear.length>0;
  return {style:numeric.length&&authorYear.length?'Mixed':numeric.length?'Numeric':authorYear.length?'Author–year':'Not detected',missing:[...missing],uncited:detected?refs.flatMap((_,i)=>cited.has(i)?[]:[i+1]):[],note:detected?'Heuristic check. Footnotes, ambiguous author names, and unusual styles may need a manual review.':'No supported in-text citations detected; unused entries cannot be inferred.'};
}
