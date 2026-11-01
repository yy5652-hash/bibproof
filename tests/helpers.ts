import { IndexClient } from '../src/core/http';

type Json = Record<string, unknown>;
export interface Mock { crossrefWork?: Record<string, Json | number>; crossrefSearch?: Json[] | number; openalexWork?: Record<string, Json | number>; openalexSearch?: Json[] | number; europePmc?: Json[] | number; dataciteWork?: Record<string, Json | number> }

export function crossrefItem(o: { doi: string; title: string; authors: [string, string][]; year: number; venue?: string; retractedBy?: string }): Json {
  return {
    DOI: o.doi, title: [o.title], type: 'journal-article', 'container-title': [o.venue ?? 'Journal of Examples'],
    author: o.authors.map(([given, family]) => ({ given, family })), issued: { 'date-parts': [[o.year]] },
    ...(o.retractedBy ? { 'updated-by': [{ type: 'retraction', DOI: o.retractedBy }] } : {}),
  };
}

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const tell = (v: Json | Json[] | number | undefined, ok: (x: any) => unknown, empty: unknown, status404 = false) =>
  typeof v === 'number' ? respond({ error: v === 429 ? 'daily budget exhausted' : 'denied' }, v) : v === undefined ? (status404 ? respond({}, 404) : respond(empty)) : respond(ok(v));

/** A fetch stand-in for the five indexes. Anything not configured answers like a healthy index with nothing to say. */
export function mockTransport(m: Mock = {}) {
  const calls: string[] = [];
  const fn: typeof fetch = async input => {
    const url = new URL(String(input)); calls.push(url.host + url.pathname + url.search);
    const key = decodeURIComponent(url.pathname.split('/works/')[1] ?? '').toLowerCase();
    if (url.host === 'api.crossref.org') {
      if (key) { const v = m.crossrefWork?.[key]; return typeof v === 'number' ? respond({}, v) : v ? respond({ message: v }) : respond({}, 404); }
      return tell(m.crossrefSearch, items => ({ message: { items } }), { message: { items: [] } });
    }
    if (url.host === 'api.datacite.org') { const v = m.dataciteWork?.[decodeURIComponent(url.pathname.replace('/dois/', '')).toLowerCase()]; return typeof v === 'number' ? respond({}, v) : v ? respond({ data: v }) : respond({}, 404); }
    if (url.host === 'api.openalex.org') {
      if (key) { const v = m.openalexWork?.[key.replace('https://doi.org/', '')]; return typeof v === 'number' ? respond({ error: 'denied' }, v) : v ? respond(v) : respond({}, 404); }
      return tell(m.openalexSearch, results => ({ results }), { results: [] });
    }
    if (url.host === 'www.ebi.ac.uk') return tell(m.europePmc, result => ({ resultList: { result } }), { resultList: { result: [] } });
    return respond({ docs: [] });
  };
  return Object.assign(fn, { calls });
}
export const clientFor = (m?: Mock) => { const transport = mockTransport(m); return { client: new IndexClient(undefined, transport, 0), transport }; };
