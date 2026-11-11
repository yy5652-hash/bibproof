import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, mkdir, symlink, writeFile } from 'node:fs/promises';
import { ROOT, jsonl, json, unique, sha, type Entry, type Prediction, type BlindEntry } from './common';
import { metrics } from './score';
import { select } from './select';
import { convert } from './convert';
import { DailyBudget, DiskCache, MeasuredClient, IdentityReplay } from './client';
import { verifyReference } from '../../src/core/verify';
import { mapVerdict } from './mapping';

test('official abstention, tier-3 and all-input denominators, raw FP and missing',()=>{
 const entries=['v1','v2','v3','h1','h2','h3'].map((k,i)=>({bibtex_key:k,label:i<3?'VALID':'HALLUCINATED',hallucination_type:i<3?null:'near_miss_title',difficulty_tier:i===4?1:3})) as Entry[];
 const predictions=['HALLUCINATED','VALID','UNCERTAIN','HALLUCINATED','VALID','UNCERTAIN'].map((label,i)=>({bibtex_key:entries[i].bibtex_key,label})) as Prediction[];
 const m=metrics(entries,predictions);assert.deepEqual([m.tp,m.fp,m.tn,m.fn],[1,1,1,1]);assert.equal(m.detection_rate,.5);assert.equal(m.false_positive_rate,.5);assert.equal(m.f1,.5);assert.equal(m.tier3_f1,2/3);assert.equal(m.coverage,4/6);assert.equal(m.response_coverage,1);assert.equal(m.all_input_detection,1/3);assert.equal(m.uncertain_valid,1);assert.equal(m.uncertain_hallucinated,1);
 const missing=metrics(entries,predictions.slice(0,5));assert.equal(missing.missing_hallucinated,1);assert.equal(missing.uncertain_hallucinated,0);assert.equal(missing.response_coverage,5/6);
 assert.equal(m.per_type.near_miss_title.fp,1);assert.throws(()=>metrics(entries,[predictions[0],predictions[0]]),/Duplicate/);
});
test('precommitted stratification, source overlap, blind conversion, no hidden network',async()=>{
 const base={split:'dev_public' as const,pilot:30,excludeGptzero:false,budget:80,prepareOnly:true};const a=await select(base),b=await select(base);
 assert.deepEqual(a.manifest,b.manifest);assert.deepEqual([a.manifest.counts.valid,a.manifest.counts.hallucinated],[14,16]);assert.equal(Object.keys(a.manifest.counts.types).length,14);
 const sample=await select({...base,split:'test_public',pilot:undefined,sample:400});assert.deepEqual([sample.manifest.counts.valid,sample.manifest.counts.hallucinated],[154,246]);
 const excluded=await select({...base,split:'test_public',pilot:undefined,excludeGptzero:true});assert.equal(excluded.entries.length,800);assert.equal(excluded.manifest.gptzero_overlap_count,31);
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('Conversion must never use network');};
 try{for(const entry of a.entries){assert.ok(!('label' in entry));const raw=await convert(entry);assert.ok(raw.length>20);}}
 finally{globalThis.fetch=original;}
});
test('pinned downloads match every manifest SHA-256',async()=>{
 const m=await json(`${ROOT}/data/manifest.json`);for(const f of m.files)assert.equal(sha(await readFile(f.local_path)),f.sha256,f.local_path);
});
test('budget caps actual transport attempts incl retries, cache survives zero allowance, next day resumes',async()=>{
 const dir=await mkdtemp(`${ROOT}/cache/selftest-`);try{
 let day='2026-01-01',outgoing=0;const budget=new DailyBudget(1,dir+'/budget',()=>day),cache=new DiskCache(dir+'/responses');
 const client=new MeasuredClient(budget,cache,async()=>{outgoing++;return new Response('temporary',{status:500});});
 const url='https://api.openalex.org/works?search=budget-test';const r=await client.request(url);
 assert.equal(r.ok,false);assert.equal(outgoing,1);assert.equal(await budget.used(),1);assert.equal(client.halted,true);assert.equal(client.calls.length,1);
 day='2026-01-02';const next=new MeasuredClient(budget,cache,async()=>{outgoing++;return Response.json({results:[]});});assert.equal((await next.request(url)).ok,true);assert.equal(outgoing,2);assert.equal(await budget.used(),1);
 const cached=new MeasuredClient(new DailyBudget(0,dir+'/budget',()=>day),cache,async()=>{throw new Error('Cache hit must not fetch');});assert.equal((await cached.request(url)).cached,true);assert.equal(cached.halted,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Crossref real IndexClient queue remains serial at one request per second',async()=>{
 const dir=await mkdtemp(`${ROOT}/cache/selftest-`);try{const times:number[]=[];const client=new MeasuredClient(new DailyBudget(80,dir+'/b'),new DiskCache(dir+'/r'),async()=>{times.push(Date.now());return Response.json({message:{items:[]}});});
 await Promise.all([client.request('https://api.crossref.org/works?query=first'),client.request('https://api.crossref.org/works?query=second')]);assert.equal(times.length,2);assert.ok(times[1]-times[0]>=950);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('retracted identity replay uses production verdict, does not send network or mutate records',async()=>{
 const dir=await mkdtemp(`${ROOT}/cache/selftest-`);try{
 const title='An example study of citation verification';const doi='10.1234/example';
 const client=new MeasuredClient(new DailyBudget(80,dir+'/b'),new DiskCache(dir+'/r'),async input=>{
 const u=new URL(String(input));if(u.host==='api.openalex.org')return Response.json({id:'https://openalex.org/W1',title,doi:'https://doi.org/'+doi,authorships:[{author:{display_name:'Ada Lovelace'}}],publication_year:2020,is_retracted:true});
 const work={DOI:doi,title:[title],author:[{family:'Lovelace',given:'Ada'}],published:{'date-parts':[[2020]]},'container-title':['Journal of Citations'],'updated-by':[{type:'retraction',DOI:'10.1234/notice'}]};return Response.json({message:u.pathname==='/works'?{items:[work]}:work});});
 const raw=`Lovelace, A. (2020). ${title}. Journal of Citations. https://doi.org/${doi}`;
 const r=await verifyReference(raw,client);assert.equal(r.verdict,'Retracted');const replay=new IdentityReplay(client.responses);const identity=await verifyReference(raw,replay);assert.equal(identity.verdict,'Verified');assert.equal(mapVerdict(identity).label,'VALID');assert.equal(replay.missing,false);
 const differing=await verifyReference(raw.replace('(2020)','(2010)'),new IdentityReplay(client.responses));assert.equal(differing.verdict,'Details differ');assert.equal(mapVerdict(differing).label,'HALLUCINATED');assert.equal((client.responses.values().next().value?.data as any).message['updated-by'].length,1);
 const unavailable=new IdentityReplay(new Map());await verifyReference(raw,unavailable);assert.equal(unavailable.missing,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('runner integrates zero-budget clean stop and key-based resume without network',async()=>{
 const dir=await mkdtemp(`${ROOT}/cache/runner-selftest-`),abs=resolve(dir);try{
 await mkdir(`${abs}/eval/hallmark`,{recursive:true});await mkdir(`${abs}/scripts`,{recursive:true});
 for(const [target,link] of [['src','src'],['package-lock.json','package-lock.json'],['node_modules','node_modules'],['scripts/hallmark','scripts/hallmark'],[`${ROOT}/data`,`${ROOT}/data`]])await symlink(resolve(target),`${abs}/${link}`);
 await writeFile(`${abs}/package.json`,'{"type":"module"}');const guard=`${abs}/no-network.mjs`;await writeFile(guard,"globalThis.fetch=async()=>{throw new Error('Integration test forbids network')};");
 const run=()=>{const r=spawnSync(process.execPath,['--import',import.meta.resolve('tsx'),'--import',pathToFileURL(guard).href,resolve('scripts/hallmark/run.ts'),'--split','dev_public','--pilot','30','--openalex-budget','0'],{cwd:abs,encoding:'utf8',timeout:20000});assert.equal(r.status,0,r.stderr);};
 run();const base=`${abs}/${ROOT}/runs/dev_public-pilot30`;let status=await json(`${base}/status.json`);assert.equal(status.status,'daily_budget_reached');assert.equal(status.completed,0);
 const actual=await readFile(`${ROOT}/runs/dev_public-pilot30/predictions.jsonl`,'utf8');await writeFile(`${base}/predictions.jsonl`,actual);
 run();status=await json(`${base}/status.json`);assert.equal(status.status,'complete');assert.equal(status.completed,30);assert.equal(status.completed_this_invocation,0);assert.equal(status.searches_reserved_today,0);
 assert.equal(await readFile(`${base}/predictions.jsonl`,'utf8'),actual);
 }finally{await rm(dir,{recursive:true,force:true});}
});
