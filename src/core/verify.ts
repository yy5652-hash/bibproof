import { matchingDetailsDiffer, titleIdentityAgrees, authorIdentity } from './score';
import type { CheckResult, IndexEvidence, IndexName, Work } from './types';
import { parseReference } from './parse';
import { scoreCandidate, strongMatch, settled, statedWords, containment, closeWording } from './score';
import { IndexClient, type HttpProgress } from './http';
import { lookup, crossrefSearch, type Lookup } from './indexes';
// Real records worth offering instead of a flagged entry.
function alternativesFor(result:CheckResult,candidates:Work[]):Work[]{
  if(result.verdict==='Verified' && !result.reference.arxiv)return [];
  // A conflict that already has a same-title record offers that record, not looser look-alikes.
  if(result.verdict==='Identifier conflict'&&result.match && result.match.doi!==result.identifierRecord?.doi)return [result.match];
  const ref=result.reference;const seen=new Set([result.match?.doi??result.match?.id]);
  return candidates.map(work=>({work,score:scoreCandidate(ref,work)}))
    .filter(({work})=>closeWording(ref,work))
    .sort((a,b)=>b.score.total-a.score.total)
    .filter(({work})=>{const key=work.doi??work.id;if(seen.has(key))return false;seen.add(key);return true;})
    .slice(0,3).map(({work})=>work);
}
export interface CheckProgress extends HttpProgress { index:IndexName }
export interface VerifyOptions { /** Offline audit control; production leaves this false. */ retainRedundantOpenAlexSearch?:boolean }
export async function verifyReference(raw:string,client:IndexClient,onProgress?:(p:CheckProgress)=>void,options:VerifyOptions={}):Promise<CheckResult>{
  const tracked=Object.create(client) as IndexClient;
  const providers:Record<string,IndexName>={'api.crossref.org':'Crossref','api.datacite.org':'DataCite','api.openalex.org':'OpenAlex','www.ebi.ac.uk':'Europe PMC','openlibrary.org':'Open Library'};
  tracked.request=url=>client.request(url,p=>onProgress?.({...p,index:providers[new URL(url).host]}));
  const candidates:Work[]=[];const result=await decide(raw,tracked,candidates,options);
  if(result.match && !result.reference.identityTitle && result.verdict==='Verified' && !result.explanation.includes('no title') && !result.explanation.includes('no other details'))result.explanation='A record matches, but the title could not be isolated. Review the title in the original entry before relying on this result.';
  const alternatives=alternativesFor(result,candidates);
  return alternatives.length?{...result,alternatives}:result;
}
async function decide(raw:string,client:IndexClient,candidates:Work[],options:VerifyOptions):Promise<CheckResult>{
  const ref=parseReference(raw);const evidence:IndexEvidence[]=[];let identifierRecord:Work|undefined;
  const base={reference:ref,evidence,checkedAt:new Date().toISOString()};
  // Web pages, statutes and thin entries still get one Crossref search, but a miss proves nothing.
  const limited=ref.kind==='unsupported'||ref.kind==='unknown';
  const add=(r:Lookup)=>{evidence.push(r.evidence);candidates.push(...r.works);return r.works;};
  const rank=()=>candidates.map(work=>({work,score:scoreCandidate(ref,work)})).sort((a,b)=>b.score.total-a.score.total);
  const doi=ref.doi??(ref.arxiv?`10.48550/arxiv.${ref.arxiv}`:undefined);
  // An entry that is only an identifier has nothing to search on or compare against.
  const bare=Boolean(doi||ref.pmid)&&ref.raw.replace(/https?:\/\/\S+|(?:doi:?\s*)?10\.\d{4,9}\/\S+|arxiv:\s*\S+|pmid:?\s*\d+/ig,'').replace(/^\s*(?:\[\d+\]|\d+[.)](?!\d))\s*/,'').replace(/[^\p{L}\p{N}]/gu,'').length<3;
  const idStart=evidence.length;
  if(ref.arxiv){
    identifierRecord=add(await lookup(client,'DataCite',`https://api.datacite.org/dois/${encodeURIComponent(doi!)}`,true))[0];
    if(!identifierRecord)identifierRecord=add(await lookup(client,'OpenAlex',`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi!)}`,true)).find(w=>w.doi?.toLowerCase()===doi?.toLowerCase());
  }
  else if(doi){
    identifierRecord=add(await lookup(client,'Crossref',`https://api.crossref.org/works/${encodeURIComponent(doi)}`,true))[0];
    if(!identifierRecord)identifierRecord=add(await lookup(client,'DataCite',`https://api.datacite.org/dois/${encodeURIComponent(doi)}`,true))[0];
  }
  if(ref.isbn && !doi){
    const books=add(await lookup(client,'Open Library',`https://openlibrary.org/search.json?isbn=${encodeURIComponent(ref.isbn)}&limit=5&fields=key,title,author_name,first_publish_year,isbn,publisher`));
    identifierRecord=books.find(w=>w.isbn?.includes(ref.isbn!));
  }
  // Only an identifier lookup that actually answered can say the identifier is unconfirmed.
  const idAnswered=evidence.slice(idStart).some(e=>e.status==='answered');
  if(ref.pmid && !identifierRecord)add(await lookup(client,'Europe PMC',`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent('EXT_ID:'+ref.pmid+' AND SRC:MED')}&format=json&resultType=core&pageSize=5`));
  if(!bare&&!rank().some(x=>settled(x.score)))add(await lookup(client,'Crossref',crossrefSearch(ref.raw)));
  // A same-titled record from the wrong year may be a reprint or duplicate, so keep looking for the right one.
  if(!bare&&!limited&&!rank().some(x=>settled(x.score)&&(identifierRecord||!ref.year||x.score.year>0))){
    const confident=rank().some(({work,score})=>['Crossref','DataCite'].includes(work.source) && score.title>=.88 && titleIdentityAgrees(ref,work) && (!ref.year || score.year>0));
    if(!confident || options.retainRedundantOpenAlexSearch)add(await lookup(client,'OpenAlex',`https://api.openalex.org/works?search=${encodeURIComponent(ref.title||ref.raw)}&per-page=5`));
    add(await lookup(client,'Europe PMC',`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(ref.title||ref.raw)}&format=json&resultType=core&pageSize=5`));
    if(ref.kind==='book')add(await lookup(client,'Open Library',`https://openlibrary.org/search.json?q=${encodeURIComponent(ref.title||ref.raw)}&limit=5&fields=key,title,author_name,first_publish_year`));
  }
  let best=rank()[0];
  // Retrieve the full Crossref record for matches found through another index,
  // and use a cheap OpenAlex singleton (never a search) to supplement retractions.
  if(best && (bare || best.score.title>=.65 || best.score.locator || best.work===identifierRecord)){
    if(best.work.doi && best.work.source!=='Crossref' && best.work.doi!==doi){add(await lookup(client,'Crossref',`https://api.crossref.org/works/${encodeURIComponent(best.work.doi)}`,true));best=rank()[0];}
    if(best.work.doi && !candidates.some(w=>w.source==='OpenAlex' && w.doi===best.work.doi))add(await lookup(client,'OpenAlex',`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(best.work.doi)}`,true));
    best=rank()[0];
    const same=candidates.filter(w=>w.id===best.work.id || (w.doi && w.doi===best.work.doi));
    if(same.some(w=>w.retracted))best={...best,work:{...best.work,retracted:true,retractionUrls:same.flatMap(w=>w.retractionUrls??[])}};
  }
  if(bare){
    if(!best)return {...base,verdict:'Could not check',explanation:'This identifier did not resolve in the registries checked. That does not make it fake, because other registries exist. Try it at doi.org.'};
    const fields=best.score.fields.map(f=>f.field==='DOI'?f:{...f,written:'Only an identifier was given',status:'unknown' as const});
    return {...base,verdict:best.work.retracted?'Retracted':'Verified',explanation:best.work.retracted?'This identifier resolves to a work marked as retracted in index metadata. Read the retraction notice before citing it.':'This identifier resolves to the record shown. You gave no other details to compare against it.',match:best.work,score:{...best.score,fields}};
  }
  const idScore=identifierRecord?scoreCandidate(ref,identifierRecord):undefined;
  const conflict=Boolean(identifierRecord && idScore && !titleIdentityAgrees(ref,identifierRecord) && (idScore.title<.55 || (containment(ref.title,identifierRecord.title)<.55 && idScore.authors<.5)) && ref.title.split(/\s+/).length>=3);
  if(identifierRecord && idScore && !conflict){const same=candidates.filter(w=>w.id===identifierRecord!.id || (w.doi && w.doi===identifierRecord!.doi));best={work:{...identifierRecord,retracted:same.some(w=>w.retracted),retractionUrls:same.flatMap(w=>w.retractionUrls??[])},score:idScore};}
  if(best?.work.retracted && (best.score.title>=.65||best.score.locator))return {...base,verdict:'Retracted',explanation:'The matched work is marked as retracted in index metadata. Read the retraction notice before citing it.',match:best.work,score:best.score,identifierRecord:conflict?identifierRecord:undefined};
  if(conflict&&idScore)idScore.fields=idScore.fields.map(f=>f.field==='Title'?{...f,status:'differ'}:f);
  if(conflict)return {...base,verdict:'Identifier conflict',explanation:'The supplied identifier resolves, but its title does not agree with this reference. Review the identifier record and any closer title match.',identifierRecord,match:best?.score.title>=.65?best.work:undefined,nearest:best?.work,score:idScore};
  if((doi || ref.isbn) && !identifierRecord && idAnswered && best && (strongMatch(best.score)||titleIdentityAgrees(ref,best.work)))return {...base,verdict:'Details differ',explanation:'The supplied identifier could not be confirmed. A similar record is a candidate only; it is not a correction to the supplied identity.',nearest:best.work,score:best.score};
  if(best && (strongMatch(best.score) || (titleIdentityAgrees(ref,best.work) && (best.score.authors>=.7 || authorIdentity(ref,best.work)==='agree')))){
    const differ=matchingDetailsDiffer(ref,best.work,best.score);
    return {...base,verdict:differ?'Details differ':'Verified',explanation:differ?'A matching work exists, but the highlighted fields differ.':'The indexed title and authors agree. Publication year allows a one-year online-first difference.',match:best.work,score:best.score};
  }
  if(best?.score.locator){
    const noTitle=statedWords(ref,best.work)<3;
    const score=noTitle?{...best.score,fields:best.score.fields.map(f=>f.field==='Title'?{...f,written:'No title in this entry',status:'unknown' as const}:f)}:best.score;
    return {...base,verdict:noTitle?'Verified':'Details differ',explanation:noTitle?'This entry gives no title, but its first author, volume and first page match the record.':'First author, volume and first page match this record, but the title you wrote differs from it.',match:best.work,score};
  }
  if(best && (best.score.title>=.65 || (identifierRecord===best.work && best.score.title>=.55)))return {...base,verdict:'Details differ',explanation:best.score.authors<.7?'A close title exists, but its authors do not agree. This may be a chimera: check the author list carefully.':'A nearby work exists, but its metadata differs. Review the evidence before using a correction.',match:best.work,score:best.score};
  // Three or more named authors plus the year identify a real work whose title was miscited.
  if(best && best.work.authors.length>=3 && best.score.authors===1 && best.score.year>0 && !/\bet\s+al\b/i.test(ref.raw))return {...base,verdict:'Details differ',explanation:'Every author and the year match this record, but the title you wrote differs from it. Check which title is right.',match:best.work,score:best.score};
  if(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}]/u.test(ref.raw))return {...base,verdict:'Could not check',explanation:'This entry is not in a Latin script. These indexes cover such journals poorly, so a missing record says nothing about it. Check it by hand.',nearest:best?.work,score:best?.score};
  const failed=evidence.some(e=>e.status!=='answered');const indexes=new Set(evidence.filter(e=>e.status==='answered').map(e=>e.index)).size;
  if(limited)return {...base,verdict:'Could not check',explanation:'This looks like a web page, report, legal source or other item these indexes do not reliably cover, and no matching record turned up. Check it by hand.',nearest:best?.work,score:best?.score};
  if(statedWords(ref)<4)return {...base,verdict:'Could not check',explanation:'This entry has too little text to search on: it gives no clear title. Check it by hand.',nearest:best?.work,score:best?.score};
  if(failed || indexes<2)return {...base,verdict:'Could not check',explanation:`${[...new Set(evidence.filter(e=>e.status!=='answered').map(e=>e.index))].join(' and ')||'A required index'} could not answer, so no conclusion about existence is possible. Retry later or check by hand.`,nearest:best?.work,score:best?.score};
  const placeholder=/\b(?:john doe|jane doe|john smith|jane smith|first ?name|last ?name|author name)\b/i.test(ref.raw);
  return {...base,verdict:'No record found',explanation:`No matching record in ${indexes} indexes.${placeholder?' The author names also look like placeholders.':''} Likely fabricated, check by hand.`,nearest:best?.work,score:best?.score};
}
