import { describe, expect, it } from 'vitest';
import { IndexClient } from '../src/core/http';
import { verifyReference } from '../src/core/verify';
import { clientFor, crossrefItem } from './helpers';

const smith = crossrefItem({ doi: '10.1000/tiny', title: 'Graph sampling for tiny networks', authors: [['Jane', 'Smith'], ['Kim', 'Jones']], year: 2020 });
const REF_DOI = 'Smith, J., & Jones, K. (2020). Graph sampling for tiny networks. Journal of Examples, 12, 1–10. https://doi.org/10.1000/tiny';
const REF_PLAIN = 'Smith, J., & Jones, K. (2020). Graph sampling for tiny networks. Journal of Examples, 12, 1–10.';
const INVENTED = 'Wetherquill, Z., & Brindlewick, P. (2023). Chromatic jellyfish calculus for teleporting medieval libraries. Journal of Interplanetary Archival Thermodynamics, 42, 101–119.';

describe('verifyReference: the six verdicts', () => {
  it('Verified: the DOI resolves to a record whose title and authors agree', async () => {
    const { client } = clientFor({ crossrefWork: { '10.1000/tiny': smith } });
    const r = await verifyReference(REF_DOI, client);
    expect(r.verdict).toBe('Verified');
    expect(r.match?.doi).toBe('10.1000/tiny');
    expect(r.evidence[0]).toMatchObject({ index: 'Crossref', status: 'answered', count: 1 });
  });

  it('Verified without any identifier, found by bibliographic search', async () => {
    const { client } = clientFor({ crossrefSearch: [smith] });
    expect((await verifyReference(REF_PLAIN, client)).verdict).toBe('Verified');
  });

  it('Details differ: the work exists but the year is wrong; the diff names the field', async () => {
    const { client } = clientFor({ crossrefWork: { '10.1000/tiny': smith } });
    const r = await verifyReference(REF_DOI.replace('2020', '2014'), client);
    expect(r.verdict).toBe('Details differ');
    expect(r.score!.fields.find(f => f.field === 'Year')).toMatchObject({ status: 'differ', record: '2020' });
  });

  it("Details differ: a chimera (real title, someone else's authors) is warned about, not verified", async () => {
    const { client } = clientFor({ crossrefSearch: [smith] });
    const r = await verifyReference('Okafor, N., & Lindqvist, E. (2020). Graph sampling for tiny networks. Journal of Examples, 12, 1–10.', client);
    expect(r.verdict).toBe('Details differ');
    expect(r.explanation).toMatch(/chimera/i);
    expect(r.score!.fields.find(f => f.field === 'Authors')!.status).toBe('differ');
  });

  it('Identifier conflict: the DOI resolves to a different work', async () => {
    const other = crossrefItem({ doi: '10.1000/other', title: 'Photosynthetic yield of alpine mosses', authors: [['Ana', 'Rossi']], year: 2011 });
    const { client } = clientFor({ crossrefWork: { '10.1000/other': other }, crossrefSearch: [smith] });
    const r = await verifyReference(REF_PLAIN + ' https://doi.org/10.1000/other', client);
    expect(r.verdict).toBe('Identifier conflict');
    expect(r.identifierRecord?.title).toBe('Photosynthetic yield of alpine mosses');
    expect(r.nearest?.title).toBe('Graph sampling for tiny networks');
  });

  it('Retracted overrides Verified when Crossref reports a retraction relation', async () => {
    const retracted = crossrefItem({ doi: '10.1000/tiny', title: 'Graph sampling for tiny networks', authors: [['Jane', 'Smith'], ['Kim', 'Jones']], year: 2020, retractedBy: '10.1000/notice' });
    const { client } = clientFor({ crossrefWork: { '10.1000/tiny': retracted } });
    const r = await verifyReference(REF_DOI, client);
    expect(r.verdict).toBe('Retracted');
    expect(r.match?.retractionUrls).toEqual(['https://doi.org/10.1000/notice']);
  });

  it('Retracted is also raised from OpenAlex is_retracted when Crossref has no relation', async () => {
    const oa = { id: 'https://openalex.org/W1', title: 'Graph sampling for tiny networks', display_name: 'Graph sampling for tiny networks', doi: 'https://doi.org/10.1000/tiny', publication_year: 2020, is_retracted: true, authorships: [{ author: { display_name: 'Jane Smith' } }, { author: { display_name: 'Kim Jones' } }] };
    const { client } = clientFor({ crossrefWork: { '10.1000/tiny': smith }, openalexWork: { '10.1000/tiny': oa } });
    expect((await verifyReference(REF_DOI, client)).verdict).toBe('Retracted');
  });

  it('No record found: a scholarly-looking entry that every queried index answered about, with nothing close', async () => {
    const unrelated = crossrefItem({ doi: '10.1000/far', title: 'Tidal forcing of estuarine sediment', authors: [['Li', 'Wei']], year: 2005 });
    const { client } = clientFor({ crossrefSearch: [unrelated] });
    const r = await verifyReference(INVENTED, client);
    expect(r.verdict).toBe('No record found');
    expect(r.explanation).toMatch(/No matching record in 3 indexes\. Likely fabricated, check by hand\./);
    expect(r.evidence.every(e => e.status === 'answered')).toBe(true);
    expect(r.nearest?.title).toBe('Tidal forcing of estuarine sediment');
  });

  it('Details differ, never fake: all named authors and the year match, only the title is miscited', async () => {
    const preprint = crossrefItem({ doi: '10.1000/pre', title: 'Working memory capacity predicts offloading benefits', authors: [['Hana', 'Ball'], ['Phil', 'Peper'], ['Sam', 'Gilbert']], year: 2021 });
    const { client } = clientFor({ crossrefSearch: [preprint] });
    const r = await verifyReference('Ball H. Peper P. Gilbert S. (2021). Prospective remembering in laboratory and naturalistic settings. PsyArXiv Preprints.', client);
    expect(r.verdict).toBe('Details differ');
    expect(r.match?.doi).toBe('10.1000/pre');
  });

  it('Could not check: a web page that no index knows is never called fake', async () => {
    const { client } = clientFor();
    const r = await verifyReference('World Health Organization. (2024). Climate change. https://www.who.int/news-room/fact-sheets/detail/climate-change', client);
    expect(r.verdict).toBe('Could not check');
  });
});

describe('verifyReference: an index failure is never evidence of absence', () => {
  it('OpenAlex out of budget while Crossref and Europe PMC found nothing: Could not check', async () => {
    const { client } = clientFor({ openalexSearch: 429 });
    const r = await verifyReference(INVENTED, client);
    expect(r.verdict).toBe('Could not check');
    expect(r.evidence.find(e => e.index === 'OpenAlex')?.status).toBe('failed');
  });
  it('every index refusing the request: Could not check, with the failures recorded', async () => {
    const { client } = clientFor({ crossrefSearch: 403, openalexSearch: 403, europePmc: 403 });
    const r = await verifyReference(INVENTED, client);
    expect(r.verdict).toBe('Could not check');
    expect(r.evidence.filter(e => e.status === 'failed').length).toBeGreaterThanOrEqual(3);
  });
  it('a DOI whose Crossref lookup fails is not reported as an invented identifier', async () => {
    const { client } = clientFor({ crossrefWork: { '10.1000/tiny': 403 }, crossrefSearch: 403, openalexSearch: 403, europePmc: 403 });
    expect((await verifyReference(REF_DOI, client)).verdict).toBe('Could not check');
  });
  it('a malformed index response counts as a failure, not as an empty answer', async () => {
    const transport: typeof fetch = async () => new Response(JSON.stringify({ unexpected: true }), { status: 200 });
    const r = await verifyReference(INVENTED, new IndexClient(undefined, transport, 0));
    expect(r.verdict).toBe('Could not check');
  });
});
