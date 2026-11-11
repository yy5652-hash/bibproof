import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { IndexClient, cacheKey, type HttpResult } from '../../src/core/http';
import type { Cache } from '../../src/core/types';
import { ROOT, sha, json, save } from './common';
export class DiskCache implements Cache {
 constructor(readonly dir=`${ROOT}/cache/responses`){}
 private path(key:string){return `${this.dir}/${sha(key)}.json`;}
 async get(key:string){try{return JSON.parse(await readFile(this.path(key),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw e;}}
 async set(key:string,value:unknown){await mkdir(this.dir,{recursive:true});const p=this.path(key);await writeFile(p+'.tmp',JSON.stringify(value));await rename(p+'.tmp',p);}
}
export const isSearch=(url:string)=>{const u=new URL(url);return u.host==='api.openalex.org'&&u.searchParams.has('search');};
export interface Call {url:string;started_at:string;status?:number;error?:string;openalex_search:boolean}
export class DailyBudget {
 constructor(readonly limit:number,readonly dir=`${ROOT}/cache/budgets`,readonly today=()=>new Date().toISOString().slice(0,10)){}
 async used(){try{return (await json<{searches:number}>(`${this.dir}/${this.today()}.json`)).searches;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return 0;throw e;}}
 async reserve(){const used=await this.used();if(used>=this.limit)return false;await save(`${this.dir}/${this.today()}.json`,{day:this.today(),searches:used+1,scope:'HALLMARK transport search attempts incl. retries; reserved immediately before fetch'});return true;}
}
export class MeasuredClient extends IndexClient {
 halted=false;calls:Call[]=[];requests:{url:string;cached:boolean;status:number}[]=[];responses=new Map<string,HttpResult>();
 constructor(readonly budget:DailyBudget,cache:Cache=new DiskCache(),network:typeof fetch=fetch){
  super(cache,async(input,init)=>{
   const url=String(input),search=isSearch(url);
   if(this.halted||(search&&!await budget.reserve())){this.halted=true;return new Response('HALLMARK local stop',{status:418});}
   const call:Call={url,started_at:new Date().toISOString(),openalex_search:search};this.calls.push(call);
   try{const response=await network(input,init);call.status=response.status;return response;}catch(e){call.error=e instanceof Error?e.message:String(e);throw e;}
  },1000); // Production per-host serial queue and one-second interval, including retries.
 }
 reset(){this.calls=[];this.requests=[];this.responses.clear();}
 override async request(url:string):Promise<HttpResult>{
  if(this.halted)return {ok:false,status:418,error:'HALLMARK daily search budget reached; entry deferred'};
  // Serve genuine production cache hits even when no transport allowance remains.
  if(isSearch(url)&&await this.budget.used()>=this.budget.limit){
   const hit=await this.cache.get(cacheKey(url)) as {at:number;value:HttpResult}|undefined;
   if(!hit||Date.now()-hit.at>=7*86400000){this.halted=true;return {ok:false,status:418,error:'HALLMARK daily search budget reached; entry deferred'};}
  }
  const result=await super.request(url);if(!result.ok&&result.status===429&&/daily|budget|quota|keyless/i.test(result.error??''))this.halted=true;this.responses.set(url,result);this.requests.push({url,cached:!!result.cached,status:result.status});return result;
 }
}
function withoutRetractions(value:any):any {
 if(Array.isArray(value))return value.map(withoutRetractions);
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='is_retracted'?false:k==='isRetracted'?'N':k==='updated-by'&&Array.isArray(v)?v.filter(x=>String(x.type).toLowerCase()!=='retraction').map(withoutRetractions):k==='pubType'&&Array.isArray(v)?v.filter(x=>x!=='Retracted Publication'):withoutRetractions(v)]));
}
// Replay the SAME production decision over the SAME observed records with only
// retraction markers removed. No extra network and no score thresholds duplicated.
export class IdentityReplay extends IndexClient {
 missing=false;
 constructor(private observed:Map<string,HttpResult>){super();}
 override async request(url:string){const r=this.observed.get(url);if(!r){this.missing=true;return {ok:false,status:0,error:'Identity replay record unavailable'};}return {...r,data:withoutRetractions(r.data)};}
}
