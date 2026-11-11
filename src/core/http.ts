import type { Cache } from './types';
export class MemoryCache implements Cache {
  private values=new Map<string,unknown>();
  async get(key:string){return this.values.get(key);}
  async set(key:string,value:unknown){this.values.set(key,value);}
  async clear(){this.values.clear();}
}
export interface HttpResult { ok:boolean; data?:any; status:number; cached?:boolean; error?:string }
export function cacheKey(url:string):string {
  const u=new URL(url);u.hash='';u.searchParams.sort();
  for(const key of ['query.bibliographic','search','q','query']) { const value=u.searchParams.get(key);if(value)u.searchParams.set(key,value.trim().replace(/\s+/g,' ').toLowerCase()); }
  return 'response:v1:'+u.toString();
}
export const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
export interface HttpProgress { attempt:number; state:'querying'|'retrying' }
export class IndexClient {
  private queues=new Map<string,Promise<unknown>>();
  private next=new Map<string,number>();
  private pending=new Map<string,Promise<HttpResult>>();
  constructor(public cache:Cache=new MemoryCache(),private transport:typeof fetch=(input,init)=>fetch(input,init),private interval=1000){}
  async request(url:string,onProgress?:(p:HttpProgress)=>void):Promise<HttpResult> {
    onProgress?.({attempt:1,state:'querying'});
    const key=cacheKey(url);
    const hit=await this.cache.get(key).catch(()=>undefined) as {at:number;value:HttpResult}|undefined;
    if(hit && Date.now()-hit.at<7*86400000) return {...hit.value,cached:true};
    const existing=this.pending.get(key);if(existing)return existing;
    const host=new URL(url).host;
    const previous=this.queues.get(host)??Promise.resolve();
    const task=previous.catch(()=>undefined).then(()=>this.execute(url,key,host,onProgress));
    this.queues.set(host,task);this.pending.set(key,task);
    try{return await task;}finally{this.pending.delete(key);}
  }
  private async execute(url:string,key:string,host:string,onProgress?:(p:HttpProgress)=>void):Promise<HttpResult>{
    const openAlex=host==='api.openalex.org';
    const day=new Date().toISOString().slice(0,10);
    const budgetKey='openalex-budget:'+day;
    const budget=(await this.cache.get(budgetKey).catch(()=>undefined) as {searches:number;blocked:boolean}|undefined)??{searches:0,blocked:false};
    const search=openAlex && new URL(url).searchParams.has('search');
    if(openAlex && (budget.blocked || (search && budget.searches>=95)))return {ok:false,status:429,error:'OpenAlex daily keyless budget unavailable; other indexes still checked.'};
    for(let attempt=0;attempt<3;attempt++){
      onProgress?.({attempt:attempt+1,state:attempt?'retrying':'querying'});
      const wait=Math.max(0,(this.next.get(host)??0)-Date.now());
      if(wait>60000)return {ok:false,status:429,error:'Index requested a longer cooldown. Retry later.'};
      await delay(wait);
      if(search){budget.searches++;await this.cache.set(budgetKey,budget).catch(()=>{});}
      try{
        this.next.set(host,Date.now()+this.interval);
        const response=await this.transport(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(18000)});
        if(response.status===429 || response.status>=500){
          const retry=response.headers.get('Retry-After');
          const seconds=retry && /^\d+(\.\d+)?$/.test(retry)?Number(retry)*1000:retry?Math.max(0,Date.parse(retry)-Date.now()):0;
          const message=(await response.text()).slice(0,250);
          if(openAlex && /budget|credit|daily|quota/i.test(message)){budget.blocked=true;await this.cache.set(budgetKey,budget).catch(()=>{});return {ok:false,status:429,error:'OpenAlex daily budget exhausted.'};}
          this.next.set(host,Date.now()+Math.max(Number.isFinite(seconds)?seconds:0,1000*2**attempt));
          if(attempt<2)continue;
          return {ok:false,status:response.status,error:`Index unavailable (HTTP ${response.status}); not evidence of absence.`};
        }
        if(openAlex && [401,402,403].includes(response.status)){budget.blocked=true;await this.cache.set(budgetKey,budget).catch(()=>{});}
        if(response.status===404){const value={ok:true,status:404,data:null};await this.cache.set(key,{at:Date.now(),value}).catch(()=>{});return value;}
        if(!response.ok)return {ok:false,status:response.status,error:`Index returned HTTP ${response.status}.`};
        const data=await response.json();const value={ok:true,status:response.status,data};
        await this.cache.set(key,{at:Date.now(),value}).catch(()=>{});return value;
      }catch(error){if(attempt===2)return {ok:false,status:0,error:error instanceof Error?error.message:'Network unavailable'};this.next.set(host,Date.now()+1000*2**attempt);}
    }
    return {ok:false,status:0,error:'Request incomplete'};
  }
}
