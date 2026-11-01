import type { ParsedReference } from './types';
export function normalize(text: string): string {
  return text.replace(/<[^>]*>/g, ' ').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
const stop = new Set('a an the of in on for and or to with from by as at is are using via into'.split(' '));
export function tokens(text: string): string[] { return [...new Set(normalize(text).split(' ').filter(x => x.length > 1 && !stop.has(x)))]; }
export function cleanDoi(value: string): string {
  let doi = value.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').trim().replace(/[.,;]+$/, '');
  while (doi.endsWith(')') && (doi.match(/\)/g)?.length ?? 0) > (doi.match(/\(/g)?.length ?? 0)) doi = doi.slice(0, -1);
  return doi.toLowerCase();
}
// For styles the rules below miss: "Smith, A., Jones, B.: Title." and "A. Smith, B. Jones, Title."
// and "Smith, A., 2018: Title." Drop a leading author run, then take the longest segment.
function fallbackTitle(text: string): string {
  const body = text.replace(/^(?:(?:\p{Lu}\.\s?)+[\p{Lu}][\p{L}'’-]+(?:,\s*(?:and\s+)?|\s+and\s+))+/u, '').replace(/^.*?\b(?:18|19|20)\d{2}[a-z]?:\s+/u, '');
  const parts = body.split(/(?<=[\p{Ll}\p{N}\)\]])\.\s+|:\s+(?=\p{Lu})/u).map(part => part.trim());
  return parts.reduce((best, part) => tokens(part).length > tokens(best).length && !/^(?:[\p{Lu}][\p{L}'’-]+,\s*(?:\p{Lu}\.\s?)+,?\s*)+$/u.test(part) ? part : best, '');
}
export function parseReference(raw: string): ParsedReference {
  const label = raw.match(/^\s*(?:\[(\d+)\]|(\d+)[.)])\s*/);
  const text = raw.replace(/^\s*(?:\[\d+\]|\d+[.)])\s*/, '').replace(/\s+/g, ' ').trim();
  const doiMatch = text.match(/10\.\d{4,9}\/[^\s<>"\]}]+/i);
  const doi = doiMatch ? cleanDoi(doiMatch[0]) : undefined;
  const arxiv = text.match(/(?:arxiv[:\s/]+|arxiv\.org\/(?:abs|pdf)\/|10\.48550\/arxiv\.)(\d{4}\.\d{4,5}(?:v\d+)?|[a-z.-]+\/\d{7}(?:v\d+)?)/i)?.[1]?.replace(/v\d+$/, '');
  const pmid = text.match(/(?:PMID:\s*|pubmed\.ncbi\.nlm\.nih\.gov\/)(\d+)/i)?.[1];
  const withoutIds = text.replace(/https?:\/\/\S+|(?:doi:\s*)?10\.\d{4,9}\/\S+|arxiv:\s*\S+/ig, '').trim();
  const years = [...withoutIds.matchAll(/\b((?:18|19|20)\d{2})([a-z])?\b/g)];
  const yearMatch = years[0];
  const year = yearMatch ? Number(yearMatch[1]) : undefined;
  const quoted = withoutIds.match(/[“"]([^”"]{8,})[”"]/);
  // Author-year styles put the title after the parenthesized year. Other styles
  // usually separate the author block and title with a full stop (not initials).
  const afterYear = withoutIds.match(/\(\d{4}[a-z]?(?:[^)]*)\)\s*[.,:]?\s*(.+)/);
  const segments = withoutIds.split(/(?<=[\p{Ll}\p{N}\)\]])\.\s+(?=[\p{Lu}“"])/u);
  let title = quoted?.[1] ?? afterYear?.[1]?.split(/\.\s+/)[0] ?? (segments.length > 1 ? segments[1] : withoutIds);
  if (tokens(title).length < 3 || title === withoutIds) title = fallbackTitle(withoutIds) || title;
  title = title.replace(/^[.,\s]+|[.,\s]+$/g, '');
  const titleAt = text.indexOf(title);
  const authorBlock = (titleAt > 0 ? text.slice(0, titleAt) : text.slice(0, yearMatch?.index ?? 100)).replace(/\b(?:18|19|20)\d{2}\b/g, '');
  let surnames = [...authorBlock.matchAll(/(?:^|[;&]|\band\b|,\s*(?=[\p{Lu}][\p{L}'’-]+,))\s*([\p{Lu}][\p{L}'’-]+)(?=,)/gu)].map(m => m[1]);
  if (!surnames.length) surnames = [...authorBlock.matchAll(/\b([\p{Lu}][\p{L}'’-]{2,})\b/gu)].map(m => m[1]).filter(s => !['Retrieved','Available','Accessed'].includes(s));
  const url = text.match(/https?:\/\/[^\s<>]+/)?.[0]?.replace(/[.,;)]+$/, '');
  const book = /\b(?:ISBN|press|publisher|edition|ed\.)\b/i.test(text);
  const unsupported = !doi && !arxiv && !pmid && (Boolean(url && !/arxiv|doi\.org|pubmed/i.test(url)) || /\b(?:statute|legislation|act of|annual report|technical report|general technical report|white paper|website|web page|working paper|discussion paper|dissertation|thesis)\b/i.test(text) || /\b[\p{Lu}][\p{L}'’-]+\s+[vV]s?\.\s+[\p{Lu}]|\b\d+\s+(?:U\.?\s?S\.?|S\.?\s?Ct\.?|F\.\dd)\s+\d+/u.test(text));
  const scholarly = Boolean(doi || arxiv || pmid || (surnames.length && tokens(title).length >= 2 && (year || tokens(title).length >= 4)));
  return {raw, label:label?.[1] ?? label?.[2], doi, arxiv, pmid, url, year, yearSuffix:yearMatch?.[2], surnames:[...new Set(surnames)], title, kind:unsupported?'unsupported':book?'book':scholarly?'scholarly':'unknown'};
}
