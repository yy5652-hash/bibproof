// Citation.js 0.9.0: https://github.com/citation-js/citation-js/blob/main/packages/core/docs/cite_constructor.md
import { Cite } from '@citation-js/core';
import '@citation-js/plugin-bibtex';
import type { ParsedReference, Author } from './types';
export const isBibtex = (text:string) => /^\s*@\w+\s*[{(]/m.test(text);
/** Both pasted and uploaded BibTeX use the same local parser. No fetch plugins. */
export function splitBibtex(source:string):string[] {
  return new Cite(source).data.map(item=>new Cite([item]).format('bibtex').trim());
}
export function parseBibtex(raw:string):ParsedReference {
  const item=new Cite(raw).data[0];
  if(!item)throw new Error('Empty bibliography');
  const authors:Author[]=(item.author??[]).map(a=>({family:[a['non-dropping-particle'],a.family??a.literal].filter(Boolean).join(' '),given:a.given}));
  const title=String(item.title??'');
  return {raw,title,identityTitle:title||undefined,authors,surnames:authors.map(a=>a.family),year:Number(item.issued?.['date-parts']?.[0]?.[0])||undefined,doi:item.DOI?.toLowerCase(),arxiv:(item.DOI??item.URL??'').match(/(?:arxiv\.|arxiv\.org\/(?:abs|pdf)\/)(\d{4}\.\d{4,5})(?:v\d+)?/i)?.[1],venue:item['container-title'],publisher:item.publisher,isbn:item.ISBN?.replace(/[^\dX]/gi,''),kind:item.type==='book'?'book':'scholarly'};
}
