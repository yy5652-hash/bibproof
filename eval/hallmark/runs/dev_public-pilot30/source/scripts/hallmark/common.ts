import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
export const ROOT='eval/hallmark';
export const PIN='c62d296d1d2e3e6f9cb325e37963b63350ab2ca4';
export type Label='VALID'|'HALLUCINATED'|'UNCERTAIN';
export interface BlindEntry {bibtex_key:string;bibtex_type:string;fields:Record<string,string>;raw_bibtex?:string|null}
export interface Entry extends BlindEntry {label:Exclude<Label,'UNCERTAIN'>;hallucination_type:string|null;difficulty_tier:number|null;source?:string}
export interface Prediction {bibtex_key:string;label:Label;confidence:number;reason:string;api_sources_queried:string[];wall_clock_seconds:number;api_calls:number;evaluated?:boolean}
export const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export async function json<T=any>(path:string):Promise<T>{return JSON.parse(await readFile(path,'utf8'));}
export async function jsonl<T=any>(path:string):Promise<T[]>{return (await readFile(path,'utf8')).split('\n').filter(l=>l.trim()).map((l,i)=>{try{return JSON.parse(l);}catch{throw new Error(`Invalid JSONL ${path}:${i+1}; repair before resume`);}});}
export async function optionalJsonl<T=any>(path:string):Promise<T[]>{try{return await jsonl<T>(path);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}}
export async function save(path:string,value:unknown){await mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});await writeFile(path+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(path+'.tmp',path);}
export function unique<T extends {bibtex_key:string}>(rows:T[]):Map<string,T>{const map=new Map<string,T>();for(const r of rows){if(map.has(r.bibtex_key))throw new Error(`Duplicate key ${r.bibtex_key}`);map.set(r.bibtex_key,r);}return map;}
export interface Options {split:'dev_public'|'test_public';pilot?:number;sample?:number;excludeGptzero:boolean;budget:number;prepareOnly:boolean;selection?:string}
export function options(args=process.argv.slice(2)):Options {
 const out:Options={split:'dev_public',excludeGptzero:false,budget:80,prepareOnly:false};
 for(let i=0;i<args.length;i++){const a=args[i];if(a==='--exclude-gptzero')out.excludeGptzero=true;else if(a==='--prepare-only')out.prepareOnly=true;
 else if(['--split','--pilot','--sample','--openalex-budget','--selection'].includes(a)){const v=args[++i];if(!v||v.startsWith('--'))throw new Error(`Missing ${a}`);if(a==='--split'){if(!['dev_public','test_public'].includes(v))throw new Error('Unsupported split');out.split=v as Options['split'];}else if(a==='--selection')out.selection=v;else {const n=Number(v);if(!Number.isSafeInteger(n)||n<0)throw new Error(`Invalid ${a}`);if(a==='--pilot')out.pilot=n;else if(a==='--sample')out.sample=n;else out.budget=n;}}
 else throw new Error(`Unknown flag ${a}`);}
 if(out.pilot!==undefined&&(out.pilot!==30||out.split!=='dev_public'))throw new Error('Pilot requires --split dev_public --pilot 30');
 if(out.sample!==undefined&&(out.sample!==400||out.split!=='test_public'||out.pilot))throw new Error('Fallback requires --split test_public --sample 400');
 return out;
}
