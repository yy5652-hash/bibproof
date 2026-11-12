import {expect,it} from 'vitest';
import {extractReferences,needsExtractionPreview} from '../src/core/extract';
import {parseReference} from '../src/core/parse';
import {scoreCandidate} from '../src/core/score';
import {verifyReference} from '../src/core/verify';
import {citingSentences,resolveCitation,referenceId} from '../src/core/citing';
import {crossCheck} from '../src/core/crosscheck';
import {manuscriptEdits} from '../src/core/repairs';
import {chosenRecord,primaryRecord} from '../src/core/decisions';
import {readInputFile} from '../src/browser/files';
import {IndexClient} from '../src/core/http';
import {clientFor,crossrefItem,mockTransport} from './helpers';
import {deep,privacy,subtitle,extra,initials,bibtex,distilling,paper,attention,book} from './fixtures/round3-inputs';
const doi='10.1038/nature14539';
const record=crossrefItem({doi,title:'Deep learning',authors:[['Yann','LeCun'],['Yoshua','Bengio'],['Geoffrey','Hinton']],year:2015,venue:'Nature'});
const deepClient=()=>clientFor({crossrefWork:{[doi]:record}}).client;
const field=(r:Awaited<ReturnType<typeof verifyReference>>,name:string)=>r.score?.fields.find(f=>f.field===name);

it.each(['References and Notes','Notes and References','Sources','Literature','Bibliography and Notes','References:','7. References','REFERENCES','7. References and Notes:','参考文献'])('1 excludes all text before %s and waits before requests',heading=>{
 const ex=extractReferences(privacy.replace('References and Notes',heading));
 expect(ex.entries).toEqual([deep]);expect(ex.body).toContain('SANDPIPER');expect(needsExtractionPreview(ex)).toBe(true);
 expect(needsExtractionPreview(extractReferences(`${heading}\n${deep}`))).toBe(true);
});
it('1 previews DOI-bearing prose and heading-like lines, even without blank lines',()=>{
 for(const raw of [`SYNTHETIC DRAFT SANDPIPER mentions 10.1038/nature14539.\n${deep}`,`${deep}\n  This body sentence mentions 10.1038/nature14539.`,`Draft notes\n${deep}`])expect(needsExtractionPreview(extractReferences(raw))).toBe(true);
 expect(needsExtractionPreview(extractReferences(deep))).toBe(false);
 expect(needsExtractionPreview(extractReferences('https://doi.org/10.1038/nature14539'))).toBe(false);
});
it.each([[subtitle,'Title'],[extra,'Authors']])('2a/b rejects extra written title or author: %s',async(raw,name)=>{
 const r=await verifyReference(raw,deepClient());expect(r.verdict).toBe('Details differ');expect(field(r,name)?.status).toBe('differ');
});
it.each([
 deep,deep.replace('LeCun, Y., Bengio, Y., & Hinton, G.','LeCun, Y., et al.'),
 deep.replace('LeCun, Y., Bengio, Y., & Hinton, G.','LeCun, Y.'),
 deep.replace('LeCun, Y., Bengio, Y., & Hinton, G.','LeCun, Bengio, & Hinton'),
])('2b accepts incomplete or initial-free genuine lists: %s',async raw=>{
 const r=await verifyReference(raw,deepClient());expect(r.verdict).toBe('Verified');expect(field(r,'Authors')?.status).not.toBe('differ');
});
it('2a real separate Crossref subtitle is included and punctuation/omission are allowed',async()=>{
 for(const written of ['Deep learning: Methods and applications','Deep learning — Methods and applications','Deep learning']){
 const r=await verifyReference(deep.replace('Deep learning.',written+'.'),clientFor({crossrefWork:{[doi]:{...record,subtitle:['Methods and applications']}}}).client);
 expect(r.verdict).toBe('Verified');expect(field(r,'Title')?.status).toBe('agree');
 }
});
const adam='10.48550/arxiv.1412.6980';
const adamData={attributes:{doi:adam,titles:[{title:'Adam: A Method for Stochastic Optimization'}],creators:[{familyName:'Kingma',givenName:'Diederik P.'},{familyName:'Ba',givenName:'Jimmy'}],publicationYear:2014,publisher:'arXiv'}};
it('2c contradictory initials differ and evidence includes the initials',async()=>{
 const r=await verifyReference(initials,clientFor({dataciteWork:{[adam]:adamData}}).client);
 expect(r.verdict).toBe('Details differ');expect(field(r,'Authors')?.status).toBe('differ');expect(field(r,'Authors')?.written).toContain('Z. P.');expect(field(r,'Authors')?.record).toContain('Diederik');
});
it.each(['Kingma, D., & Ba, J.','Kingma, D. P., & Ba, J.','Kingma, & Ba'])('2c missing middle/first initials are allowed: %s',async authors=>{
 const r=await verifyReference(initials.replace('Kingma, Z. P., & Ba, Q.',authors),clientFor({dataciteWork:{[adam]:adamData}}).client);expect(r.verdict).toBe('Verified');
});
it.each([
 ['van de Meent, J.-W.',{family:'Meent',given:'Jan-Willem van de'}],
 ['García-López, J. M.',{family:'García-López',given:'José Manuel'}],
 ['张伟',{family:'张伟'}],
])('2c does not warn on particle, hyphenated or non-Latin names: %s',(written,author)=>{
 const ref=parseReference(`${written} (2020). A real research title. Journal of Examples.`);
 const score=scoreCandidate(ref,{id:'x',title:'A real research title',authors:[author],year:2020,source:'Crossref',url:''});expect(score.fields.find(f=>f.field==='Authors')?.status).not.toBe('differ');
});
const goelDoi='10.1109/cvpr52688.2022.00844';
const goelRecord=crossrefItem({doi:goelDoi,title:'Differentiable Stereopsis: Meshes from multiple views using differentiable rendering',authors:[['Shubham','Goel'],['Georgia','Gkioxari'],['Jitendra','Malik']],year:2022,venue:'2022 IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)'});
it('2d pasted and uploaded BibTeX preserve fields and flag the fabricated venue',async()=>{
 const upload=await readInputFile(new File([bibtex],'test.bib'));
 expect(extractReferences(upload.text).entries).toEqual(extractReferences(bibtex).entries);
 const raw=extractReferences(bibtex).entries[0];expect(needsExtractionPreview(extractReferences(bibtex))).toBe(false);
 const parsed=parseReference(raw);expect(parsed.authors?.[0].family).toBe('Goel');expect(parsed.title).not.toContain('booktitle');
 const r=await verifyReference(raw,clientFor({crossrefWork:{[goelDoi]:goelRecord}}).client);expect(r.verdict).toBe('Details differ');expect(field(r,'Venue')?.status).toBe('differ');
 const control=await verifyReference(bibtex.replace('Journal of Neural Architecture and Optimization','CVPR'),clientFor({crossrefWork:{[goelDoi]:goelRecord}}).client);expect(control.verdict).toBe('Verified');
});
it('2d unisolated fields are uncertain, with a visible note on an otherwise verified entry',async()=>{
 const r=await verifyReference(`LeCun Bengio Hinton 2015 Deep learning Nature doi:${doi}`,deepClient());
 expect(r.verdict).toBe('Verified');expect(r.explanation).toContain('title could not be isolated');expect(field(r,'Title')?.status).toBe('unknown');
});
it.each(['Hinton et al. (2015) discuss distillation.','Distillation works (Hinton et al., 2015).'])('3 binds first author, not any coauthor: %s',body=>{
 const entries=[deep,distilling],c=citingSentences(body,entries,true);expect(c.byEntry[0]).toEqual([]);expect(c.byEntry[1]).toEqual([body]);
 expect(crossCheck(body,entries).uncited).toEqual([1]);const rows=entries.map((raw,id)=>({raw,id}));
 expect(manuscriptEdits(rows,{0:{kind:'remove'}},c,{})).toEqual([]);
 const edit=manuscriptEdits([...rows].reverse(),{1:{kind:'remove'}},c,{})[0];expect(edit.referenceId).toBe(referenceId(distilling,1));expect(edit.sentence).toBe(body);
 expect(extractReferences(paper).entries).toEqual(entries);
});
it('3 ambiguous citations require a choice before edits, and suffixes bind precisely',()=>{
 const entries=[distilling,distilling.replace('Distilling','Another work: Distilling')];
 const c=citingSentences('Hinton et al. (2015) discuss distillation.',entries,true),rows=entries.map((raw,id)=>({raw,id}));
 expect(c.ambiguous).toHaveLength(1);expect(manuscriptEdits(rows,{0:{kind:'remove'},1:{kind:'remove'}},c,{})).toEqual([]);
 const resolved=resolveCitation(c,c.ambiguous![0].key,1,entries);expect(manuscriptEdits(rows,{0:{kind:'remove'},1:{kind:'remove'}},resolved,{}).map(e=>e.id)).toEqual([1]);
 const switched=resolveCitation(resolved,c.ambiguous![0].key,0,entries);expect(switched.byEntry.map(a=>a.length)).toEqual([1,0]);
 const suffixes=citingSentences('Hinton et al. (2015b) agree.',entries.map((s,i)=>s.replace('(2015)',`(2015${i?'b':'a'})`)),true);expect(suffixes.byEntry[0]).toEqual([]);expect(suffixes.byEntry[1]).toHaveLength(1);
});
it('4a resolves the supplied arXiv id through DataCite before other indexes',async()=>{
 const id='10.48550/arxiv.1706.03762',p=parseReference(attention);
 const transport=mockTransport({dataciteWork:{[id]:{attributes:{doi:id,titles:[{title:'Attention Is All You Need'}],creators:p.authors?.map(a=>({familyName:a.family,givenName:a.given})),publicationYear:2017,publisher:'arXiv'}}},crossrefSearch:[crossrefItem({doi:'10.65215/pc26a033',title:'Attention Is All You Need',authors:p.authors!.map(a=>[a.given??'',a.family]),year:2025})]});
 const r=await verifyReference(attention,new IndexClient(undefined,transport,0));expect(transport.calls[0]).toContain('api.datacite.org/dois/');expect(r.verdict).toBe('Verified');expect(primaryRecord(r)?.doi).toBe(id);expect(primaryRecord(r)?.year).toBe(2017);
});
it('4a a failed supplied identifier leaves another matching record as a candidate only',async()=>{
 const r=await verifyReference(attention,clientFor({crossrefSearch:[crossrefItem({doi:'10.65215/pc26a033',title:'Attention Is All You Need',authors:parseReference(attention).authors!.map(a=>[a.given??'',a.family]),year:2025})]}).client);
 expect(primaryRecord(r)).toBeUndefined();expect(r.alternatives?.[0].doi).toBe('10.65215/pc26a033');
});
it('4b prefers ISBN and catalog correction preserves written authors and publisher',async()=>{
 const urls:string[]=[];const transport=mockTransport();
 const client=new IndexClient(undefined,async(input,init)=>{urls.push(String(input));if(String(input).includes('openlibrary.org'))return new Response(JSON.stringify({docs:[{key:'/works/book',title:'Deep Learning',author_name:['Ian Goodfellow','Yoshua Bengio','Aaron Courville','Francis Bach'],first_publish_year:2016,isbn:['9780262035613']}]}));return transport(input,init);},0);
 const r=await verifyReference(book,client);expect(urls[0]).toContain('isbn=9780262035613');expect(field(r,'Authors')?.status).not.toBe('differ');expect(r.verdict).toBe('Verified');
 const correction=chosenRecord(r,{kind:'record'})!;expect(correction.authors.map(a=>a.family)).toEqual(['Goodfellow','Bengio','Courville']);expect(correction.publisher).toBe('MIT Press');expect(r.match?.authors).toHaveLength(4);
});
it('6 skips redundant OpenAlex keyword search for a confident title even with conflicting authors',async()=>{
 const raw=deep.replace('LeCun, Y., Bengio, Y., & Hinton, G.','Smith, J., & Jones, K.').replace(/https:.*/,''),m={crossrefSearch:[record]};
 const a=clientFor(m),b=clientFor(m);const fast=await verifyReference(raw,a.client),legacy=await verifyReference(raw,b.client,undefined,{retainRedundantOpenAlexSearch:true});
 expect(fast.verdict).toBe(legacy.verdict);expect(fast.verdict).toBe('Details differ');expect(a.transport.calls.filter(s=>s.includes('openalex.org/works?search='))).toHaveLength(0);expect(b.transport.calls.filter(s=>s.includes('openalex.org/works?search='))).toHaveLength(1);
});
it('4a an OpenAlex arXiv redirect to a published DOI is only a candidate',async()=>{
 const r=await verifyReference(attention,clientFor({openalexWork:{'10.48550/arxiv.1706.03762':{id:'https://openalex.org/W123',title:'Attention Is All You Need',doi:'https://doi.org/10.65215/pc26a033',publication_year:2025,authorships:parseReference(attention).authors!.map(a=>({author:{display_name:`${a.given} ${a.family}`}}))}}}).client);
 expect(r.verdict).toBe('Details differ');expect(primaryRecord(r)).toBeUndefined();expect(r.alternatives?.some(w=>w.doi==='10.65215/pc26a033')).toBe(true);
});
it.each(['NeurIPS','NIPS','Advances in Neural Information Processing Systems'])('2d accepts the genuine venue variant %s',venue=>{
 const ref=parseReference(deep.replace('Nature',venue));const score=scoreCandidate(ref,{id:'x',title:'Deep learning',authors:[],venue:'Advances in Neural Information Processing Systems 35',source:'Crossref',url:''});expect(score.fields.find(f=>f.field==='Venue')?.status).toBe('agree');
});
it('2d BibTeX inside a manuscript still requires a preview and excludes its body',()=>{
 const ex=extractReferences(`SYNTHETIC DRAFT SANDPIPER\nReferences and Notes\n${bibtex}`);expect(needsExtractionPreview(ex)).toBe(true);expect(ex.entries.join(' ')).not.toContain('SANDPIPER');expect(parseReference(ex.entries[0]).authors?.[0].family).toBe('Goel');
});
it('3 stable repair keys survive sorting and persisted citation bindings',()=>{
 const entries=[deep,distilling],rows=entries.map((raw,id)=>({raw,id}));const citing=citingSentences('Hinton et al. (2015) discuss distillation.',entries,true);
 const first=manuscriptEdits(rows,{1:{kind:'remove'}},citing,{})[0];const restored=JSON.parse(JSON.stringify(citing));
 const second=manuscriptEdits([...rows].reverse(),{1:{kind:'remove'}},restored,{[first.key]:'keep'})[0];expect(second.key).toBe(first.key);expect(second.choice).toBe('keep');expect(second.id).toBe(1);
});
