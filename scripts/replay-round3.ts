/** Read-only offline audit. Never calls an index, fills a cache, or edits eval results.
 * Run: node --import tsx scripts/replay-round3.ts > /tmp/round3-replay.json
 * The frozen baseline was captured from e859beb before round-3 changes.
 */
import {readFile} from 'node:fs/promises';
import {DiskCache} from '../eval/cache';
import {IndexClient,cacheKey,type HttpResult} from '../src/core/http';
import {verifyReference} from '../src/core/verify';
import type {CheckResult} from '../src/core/types';
interface Trial {raw:string;group?:string;key?:string}
interface Before extends Trial {set:string;verdict:string;searches:number;misses:string[]}
const baseline=JSON.parse(await readFile('tests/fixtures/replay-before-round3.json','utf8')) as {commit:string;rows:Before[]};
const frozen=JSON.parse(await readFile('tests/fixtures/replay-before-round2.json','utf8')) as {realistic:Trial[];fresh:Trial[]};
const held=JSON.parse(await readFile('eval/results.json','utf8')) as {trials:Trial[]};
const pilot=(await readFile('eval/hallmark/runs/dev_public-pilot30/audit.jsonl','utf8')).trim().split('\n').map(l=>JSON.parse(l) as {reference:string;bibtex_key:string});
const trials:[string,Trial[]][]=[['held-out',held.trials],['realistic',frozen.realistic],['fresh',frozen.fresh],['pilot30',pilot.map(t=>({raw:t.reference,key:t.bibtex_key}))]];
const rows=[];
const isSearch=(url:string)=>new URL(url).host==='api.openalex.org'&&new URL(url).searchParams.has('search');
for(const [set,entries] of trials){
 const caches=set==='pilot30'?[new DiskCache('eval/hallmark/cache/responses'),new DiskCache()]:[new DiskCache()];
 for(const t of entries){
  class Replay extends IndexClient {
   urls:string[]=[];misses:string[]=[];
   override async request(url:string):Promise<HttpResult>{
    this.urls.push(url);
    for(const cache of caches){const hit=await cache.get(cacheKey(url)) as {value:HttpResult}|undefined;if(hit?.value)return {...hit.value,cached:true};}
    this.misses.push(url);return {ok:false,status:0,error:'Offline replay cache miss'};
   }
  }
  const current=new Replay(),withoutBudget=new Replay();
  const r=await verifyReference(t.raw,current),control=await verifyReference(t.raw,withoutBudget,undefined,{retainRedundantOpenAlexSearch:true});
  const before=baseline.rows[rows.length];
  if(before?.raw!==t.raw||before.set!==set)throw new Error('Baseline row order/input mismatch');
  const summarize=(r:CheckResult)=>({verdict:r.verdict,explanation:r.explanation,match:r.match?.id,fields:r.score?.fields.filter(f=>f.status==='differ')});
  rows.push({set,group:t.group??set,key:t.key,raw:t.raw,before:before.verdict,...summarize(r),beforeSearches:before.searches,searches:current.urls.filter(isSearch).length,withoutBudgetFixVerdict:control.verdict,withoutBudgetFixSearches:withoutBudget.urls.filter(isSearch).length,beforeMisses:before.misses,misses:current.misses});
 }
}
const changes=rows.filter(r=>r.verdict!==r.before);
const sets=trials.map(([set])=>{
 const entries=rows.filter(r=>r.set===set),sum=(key:'beforeSearches'|'searches'|'withoutBudgetFixSearches')=>entries.reduce((n,r)=>n+r[key],0);
 return {set,entries:entries.length,beforeSearches:sum('beforeSearches'),afterSearches:sum('searches'),beforePerEntry:sum('beforeSearches')/entries.length,afterPerEntry:sum('searches')/entries.length,withoutBudgetFixSearches:sum('withoutBudgetFixSearches'),beforeCacheMisses:entries.reduce((n,r)=>n+r.beforeMisses.length,0),cacheMisses:entries.reduce((n,r)=>n+r.misses.length,0)};
});
const budgetOnlyVerdictChanges=rows.filter(r=>r.verdict!==r.withoutBudgetFixVerdict);
const newNoRecordFound=changes.filter(r=>r.verdict==='No record found');
const unexpectedGenuineChanges=changes.filter(r=>['genuine','realistic','fresh'].includes(r.group)&&!(r.before==='Verified'&&r.verdict==='Details differ'));
console.log(JSON.stringify({baselineCommit:baseline.commit,networkRequests:0,measurement:'Logical OpenAlex keyword search requests per reference, including cache hits; not live transport or billable usage. Singleton DOI lookups excluded.',cachePolicy:'Recorded responses reused regardless of age. Cache misses remain explicit failures; no synthesized responses.',sets,newNoRecordFound,budgetOnlyVerdictChanges,unexpectedGenuineChanges,changes,rows},null,2));
if(newNoRecordFound.length||budgetOnlyVerdictChanges.length||unexpectedGenuineChanges.length)process.exitCode=1;
