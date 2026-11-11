/** Read-only replay: never calls a provider or rewrites committed evaluation results.
 * Fresh/realistic reports do not contain per-entry verdicts, so compare those
 * corpora with the recorded pre-round-2 offline replay, not guessed labels. */
import { readFile } from 'node:fs/promises';
import { DiskCache } from '../eval/cache';
import { IndexClient, cacheKey, type HttpResult } from '../src/core/http';
import { verifyReference } from '../src/core/verify';
import type { CheckResult } from '../src/core/types';
const disk=new DiskCache();const misses=new Set<string>();
class ReplayClient extends IndexClient {
 override async request(url:string):Promise<HttpResult>{
  const cached=await disk.get(cacheKey(url)) as {value:HttpResult}|undefined;
  if(cached?.value)return {...cached.value,cached:true};
  misses.add(url);return {ok:false,status:0,error:'Offline replay cache miss'};
 }
}
const data=JSON.parse(await readFile('eval/results.json','utf8')) as {trials:{raw:string;group:string;result:CheckResult}[]};
const baseline=JSON.parse(await readFile('tests/fixtures/replay-before-round2.json','utf8')) as {commit:string;fresh:{raw:string;verdict:string}[];realistic:{raw:string;verdict:string}[]};
const freshReport=JSON.parse(await readFile('eval/fresh-results.json','utf8')) as {misjudged:{raw:string;verdict:string}[]};
const changes:{group:string;raw:string;before:string;after:string;writtenTitle?:string;recordTitle?:string}[]=[];
const sets:{set:string;trials:number;falseAccusations:number;cacheMisses:number}[]=[];
const freshRawChecks:{raw:string;committed:string;replayed:string}[]=[];
let regressions=0;
for(const [name,trials] of [
 ['held-out',data.trials.map(t=>({raw:t.raw,group:t.group,before:t.result.verdict}))],
 ['realistic',baseline.realistic.map(t=>({raw:t.raw,group:'realistic',before:t.verdict}))],
 ['fresh',baseline.fresh.map(t=>({raw:t.raw,group:'fresh',before:t.verdict}))],
] as const){
 const missBefore=misses.size;let falseAccusations=0;
 for(const t of trials){
  const r=await verifyReference(t.raw,new ReplayClient());
  if(r.verdict!==t.before)changes.push({group:t.group,raw:t.raw,before:t.before,after:r.verdict,writtenTitle:r.reference.identityTitle,recordTitle:r.match?.title});
  if(['genuine','realistic','fresh'].includes(t.group)&&r.verdict==='No record found'){
   falseAccusations++;
   if(['Verified','Details differ'].includes(t.before))regressions++;
  }
  if(name==='fresh'){
   const original=freshReport.misjudged.find(e=>e.raw===t.raw);
   if(original)freshRawChecks.push({raw:t.raw,committed:original.verdict,replayed:r.verdict});
  }
 }
 sets.push({set:name,trials:trials.length,falseAccusations,cacheMisses:misses.size-missBefore});
}
console.log(JSON.stringify({baselineCommit:baseline.commit,sets,regressions,changes,freshRawChecks,cacheMisses:[...misses]},null,2));
if(regressions>0)process.exitCode=1;
