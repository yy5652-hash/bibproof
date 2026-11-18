import type { Work, CheckResult } from './types';
export type CitationStyle='apa'|'mla'|'chicago'|'ieee'|'vancouver'|'harvard1';
let initialization:Promise<typeof import('@citation-js/core')>|undefined;
export function citationEngine(){return initialization??= (async()=>{const core=await import('@citation-js/core');await Promise.all([import('@citation-js/plugin-csl'),import('@citation-js/plugin-bibtex'),import('@citation-js/plugin-ris')]);return core;})();}
export function toCsl(work:Work){return {id:work.id,type:work.type==='book'?'book':'article-journal',title:work.title,author:work.authors,'container-title':work.venue,issued:work.year?{'date-parts':[[work.year]]}:undefined,DOI:work.doi,URL:work.url,volume:work.volume,issue:work.issue,page:work.pages,publisher:work.publisher};}
export async function registerStyle(name:string,xml:string){const {plugins}=await citationEngine();plugins.config.get('@csl').styles.add(name,xml);}
export async function formatWork(work:Work,style:CitationStyle='apa'){const {Cite}=await citationEngine();return new Cite([toCsl(work)]).format('bibliography',{format:'text',style,lang:'en-US'}).trim();}
export async function exportWorks(works:Work[],format:'bibtex'|'ris'){const {Cite}=await citationEngine();return new Cite(works.map(toCsl)).format(format);}
export async function importBibliography(source:string):Promise<string[]>{
  // Only load local serialization plugins. Do not register the DOI/URL fetch plugin:
  // identifiers inside uploaded files must not trigger hidden network requests.
  const {Cite}=await citationEngine();const cite=new Cite(source);
  return cite.data.map(item=>new Cite([item]).format('bibliography',{format:'text',style:'apa',lang:'en-US'}).trim());
}
export function csvReport(results:CheckResult[]):string{
  const cell=(s:unknown)=>{let t=String(s??'');if(/^[=+@\-\t\r]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';};
  const rows=[['Reference','Verdict','Explanation','Matched title','DOI','Source record','Indexes answered','Indexes failed','Checked at','User-reviewed title','User-reviewed URL','User-reviewed authors','User-reviewed year','User-reviewed venue','User evidence note'],...results.map(r=>[r.reference.raw,r.verdict,r.explanation,r.match?.title,r.match?.doi,r.match?.url,r.evidence.filter(e=>e.status==='answered').map(e=>e.index).join('; '),r.evidence.filter(e=>e.status==='failed').map(e=>e.index).join('; '),r.checkedAt,r.userEvidence?.title,r.userEvidence?.url,r.userEvidence?.authors,r.userEvidence?.year,r.userEvidence?.venue,r.userEvidence?.note])];
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}

/** Carry the run's manuscript audit in formats that otherwise silently drop it. */
export function annotateStructuredExport(source:string, format:'bibtex'|'ris', notes:string, heading='Bibproof export review (applies to the whole export)'):string {
  if(format==='bibtex') return notes.split(/\r?\n/).map(line=>'% '+line).join('\n')+'\n'+source;
  // RIS N1 is a free-text note; flatten newlines so user text cannot inject tags.
  return source.replace(/^ER {2}-/m, () => 'N1  - '+heading+': '+notes.replace(/[\r\n]+/g,' | ')+'\nER  -');
}
