import { normalize, tokens } from './parse';
import type { ParsedReference, Work, Score, FieldEvidence } from './types';
export function containment(needle: string, haystack: string): number {
  const a=tokens(needle), b=new Set(tokens(haystack)); return a.length?a.filter(t=>b.has(t)).length/a.length:0;
}
export function scoreCandidate(ref: ParsedReference, work: Work): Score {
  const raw=normalize(ref.raw); const title=containment(work.title,ref.raw);
  // Compare the index's surnames against the full reference. Avoid reliance on
  // an APA-only author parser; truncated author lists are common in MLA/IEEE.
  const names=work.authors.map(a=>normalize(a.family)).filter(Boolean);
  const hits=names.filter(n=>(' '+raw+' ').includes(' '+n+' ')).length;
  const truncated=/\bet\s+al\b/i.test(ref.raw);
  const authors=names.length ? (truncated && names[0] && (' '+raw+' ').includes(' '+names[0]+' ')?1:hits/names.length) : 0;
  const years=[...ref.raw.replace(/10\.\d{4,9}\/\S+|https?:\/\/\S+/g,'').matchAll(/\b((?:18|19|20)\d{2})\b/g)].map(m=>Number(m[1]));
  const delta=work.year && years.length ? Math.min(...years.map(y=>Math.abs(y-work.year!))) : Infinity;
  const year=delta===0?1:delta===1?.85:0;
  const venue=work.venue ? containment(work.venue,ref.raw) : 0;
  // Volume + first page + first author identifies a work even when the title is
  // abbreviated, misquoted, or omitted, as in some medical and history styles.
  const firstPage=normalize(String(work.pages??'').split(/[-–]/)[0]);
  const padded=' '+raw+' ';
  const locator=Boolean(firstPage&&work.volume&&names[0]&&padded.includes(' '+firstPage+' ')&&padded.includes(' '+normalize(work.volume)+' ')&&padded.includes(' '+names[0]+' '));
  // Field statuses use the same thresholds as the verdict: 'differ' only where matching also sees a difference.
  const bareTitle=work.title.replace(/^\s*(?:retracted|withdrawn)\s*:\s*/i,'');
  const fields:FieldEvidence[]=[
    {field:'Title',written:ref.title||'Not isolated; checked against full entry',record:work.title,status:title<.65?'differ':ref.title&&(normalize(ref.title)===normalize(bareTitle)||(title>=.9&&containment(ref.title,bareTitle)>=.9))?'agree':'unknown'},
    {field:'Authors',written:ref.surnames.join(', ')||'Not isolated; checked against full entry',record:work.authors.map(a=>a.family).join(', ')||'Not supplied',status:!names.length?'unknown':authors<.8?'differ':'agree'},
    {field:'Year',written:years.join(', ')||'Not supplied',record:String(work.year??'Not supplied'),status:!years.length||!work.year?'unknown':delta===0?'agree':delta===1?'tolerance':'differ'},
    {field:'Venue',written:ref.venue || 'See original reference',record:work.venue||'Not supplied',status:!work.venue||!ref.venue?'unknown':normalize(ref.venue)===normalize(work.venue)?'agree':'unknown'},
    {field:'DOI',written:ref.doi||'Not supplied',record:work.doi||'Not supplied',status:!ref.doi||!work.doi?'unknown':ref.doi===work.doi.toLowerCase()?'agree':'differ'}
  ];
  return {title,authors,year,venue,locator,total:.64*title+.26*authors+.07*year+.03*venue+(locator?.5:0),fields};
}
// Enough shared wording to offer a record as a lead. One word in common is not:
// the nearest hit for an invented title is often an unrelated short title.
export function closeWording(ref: ParsedReference, work: Work): boolean {
  const title=tokens(work.title), raw=new Set(tokens(ref.raw)); const shared=title.filter(t=>raw.has(t)).length;
  return (shared>=2&&shared/title.length>=.75)||(shared>=3&&shared/title.length>=.5);
}
export function strongMatch(s: Score): boolean { return s.title>=.88 && s.authors>=.7; }
export function settled(s: Score): boolean { return strongMatch(s) || Boolean(s.locator); }
// How many words remain once author names, numbers and the venue are removed: an
// entry with almost none states no title, so a failed search proves nothing.
export function statedWords(ref: ParsedReference, work?: Work): number {
  const known=new Set(work?[...tokens(work.venue??''),...work.authors.flatMap(a=>tokens(`${a.family} ${a.given??''}`))]:ref.surnames.flatMap(tokens));
  return tokens(ref.raw.replace(/https?:\/\/\S+|10\.\d{4,9}\/\S+/g,' ')).filter(t=>t.length>2&&!/^\d+$/.test(t)&&!known.has(t)).length;
}

/** Preserve the search-based verdict rules independently of the stricter display comparison. */
export function matchingDetailsDiffer(ref: ParsedReference, work: Work, s: Score): boolean {
  return s.title < .65 || (work.authors.length > 0 && s.authors < .8) ||
    (Boolean(ref.raw.replace(/10\.\d{4,9}\/\S+|https?:\/\/\S+/g, '').match(/\b(?:18|19|20)\d{2}\b/)) && Boolean(work.year) && s.year === 0) ||
    Boolean(ref.doi && work.doi && ref.doi !== work.doi.toLowerCase());
}
