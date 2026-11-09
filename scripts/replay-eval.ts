/** Read-only replay: never calls a provider or rewrites committed evaluation results. */
import { readFile } from 'node:fs/promises';
import { DiskCache } from '../eval/cache';
import { IndexClient, cacheKey, type HttpResult } from '../src/core/http';
import { verifyReference } from '../src/core/verify';
import type { CheckResult } from '../src/core/types';
const disk = new DiskCache(); const misses = new Set<string>();
class ReplayClient extends IndexClient {
  override async request(url:string):Promise<HttpResult> {
    const cached = await disk.get(cacheKey(url)) as {value:HttpResult} | undefined;
    if(cached?.value) return {...cached.value,cached:true};
    misses.add(url); return {ok:false,status:0,error:'Offline replay cache miss'};
  }
}
const data = JSON.parse(await readFile('eval/results.json','utf8')) as {trials:{raw:string;group:string;result:CheckResult}[]};
const changes:unknown[]=[]; let falseAccusations=0;
for(const t of data.trials) {
 const r=await verifyReference(t.raw,new ReplayClient());
 if(r.verdict!==t.result.verdict) changes.push({group:t.group,raw:t.raw,before:t.result.verdict,after:r.verdict});
 if(t.group==='genuine' && r.verdict==='No record found') falseAccusations++;
}
console.log(JSON.stringify({trials:data.trials.length,falseAccusations,cacheMisses:misses.size,changes},null,2));
if(falseAccusations>0) process.exitCode=1;
