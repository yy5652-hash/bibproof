import type { Work, Author, IndexEvidence, IndexName } from './types';
import type { IndexClient } from './http';
import { cleanDoi } from './parse';
type Json = Record<string,any>;
function text(value:any):string { return String(value??'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'); }
function fullName(name:string):Author{const p=name.trim().split(/\s+/);return {family:p.pop()??'',given:p.join(' ')};}
export function fromCrossref(w:Json):Work {
  const updates=[...(w['update-to']??[]),...(w['updated-by']??[])].filter(x=>String(x.type).toLowerCase()==='retraction');
  return {id:w.DOI,title:text(w.title?.[0]),authors:(w.author??[]).map((a:Json)=>({family:a.family??a.name??'',given:a.given})),year:(w.published??w.issued??w['published-print'])?.['date-parts']?.[0]?.[0],venue:text(w['container-title']?.[0]),doi:cleanDoi(w.DOI??''),url:`https://doi.org/${w.DOI}`,source:'Crossref',retracted:updates.length>0,retractionUrls:updates.map(x=>`https://doi.org/${x.DOI??x.doi}`),type:w.type,volume:w.volume,issue:w.issue,pages:w.page,publisher:w.publisher};
}
export function fromDataCite(w:Json):Work{
  const a=w.attributes??w; return {id:a.doi,title:text(a.titles?.[0]?.title),authors:(a.creators??[]).map((p:Json)=>p.familyName?{family:p.familyName,given:p.givenName}:fullName(p.name??'')),year:Number(a.publicationYear)||undefined,doi:cleanDoi(a.doi??''),venue:typeof a.publisher==='string'?a.publisher:a.publisher?.name,url:`https://doi.org/${a.doi}`,source:'DataCite',type:a.types?.resourceTypeGeneral};
}
export function fromOpenAlex(w:Json):Work{
  return {id:w.id,title:text(w.title??w.display_name),authors:(w.authorships??[]).map((a:Json)=>fullName(a.author?.display_name??'')),year:w.publication_year,doi:w.doi?cleanDoi(w.doi):undefined,venue:w.primary_location?.source?.display_name,url:w.id,source:'OpenAlex',retracted:w.is_retracted===true,type:w.type};
}
function fromEuropePmc(w:Json):Work {
  return {id:w.id,title:text(w.title),authors:w.authorList?.author?.map((a:Json)=>({family:a.lastName??a.fullName??'',given:a.firstName}))??(w.authorString??'').split(', ').filter(Boolean).map((n:string)=>({family:n.replace(/\s+[A-Z]+\.?$/,'')})),year:Number(w.pubYear)||undefined,doi:w.doi?cleanDoi(w.doi):undefined,venue:w.journalInfo?.journal?.title??w.journalTitle,url:`https://europepmc.org/article/${w.source??'MED'}/${w.id}`,source:'Europe PMC',retracted:w.isRetracted==='Y'||w.pubTypeList?.pubType?.includes('Retracted Publication'),type:'journal-article'};
}
function fromOpenLibrary(w:Json):Work{return {id:w.key,title:text(w.title),authors:(w.author_name??[]).map(fullName),year:w.first_publish_year,url:`https://openlibrary.org${w.key}`,source:'Open Library',type:'book'};}
export interface Lookup { works:Work[]; evidence:IndexEvidence }
export async function lookup(client:IndexClient,index:IndexName,url:string,single=false):Promise<Lookup>{
  const result=await client.request(url);
  if(!result.ok)return {works:[],evidence:{index,url,status:'failed',count:0,detail:result.error}};
  try{
    const data=result.data;let works:Work[]=[];
    if(data){
      if(index==='Crossref')works=(single?[data.message]:data.message.items).map(fromCrossref);
      if(index==='DataCite')works=(single?[data.data]:data.data).map(fromDataCite);
      if(index==='OpenAlex')works=(single?[data]:data.results).map(fromOpenAlex);
      if(index==='Europe PMC')works=(data.resultList?.result??[]).map(fromEuropePmc);
      if(index==='Open Library')works=(data.docs??[]).map(fromOpenLibrary);
    }
    works=works.filter(w=>w.title && w.id);
    return {works,evidence:{index,url,status:'answered',count:works.length,cached:result.cached,detail:result.status===404?'Identifier not registered in this index':undefined}};
  }catch{return {works:[],evidence:{index,url,status:'failed',count:0,detail:'Unexpected response format; not evidence of absence.'}};}
}
export const crossrefSearch=(query:string)=>`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=5`;
