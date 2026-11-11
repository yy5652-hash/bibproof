import { readFile } from 'node:fs/promises';
import { ROOT, PIN, sha, json, jsonl, save, unique, type Entry, type BlindEntry, type Options } from './common';
const order=<T extends {bibtex_key:string}>(rows:T[])=>[...rows].sort((a,b)=>sha(a.bibtex_key).localeCompare(sha(b.bibtex_key))||a.bibtex_key.localeCompare(b.bibtex_key));
// Hamilton largest-remainder apportionment, lexical type ties, then SHA-256 key order.
export function apportion(counts:Record<string,number>,n:number):Record<string,number>{
 const total=Object.values(counts).reduce((a,b)=>a+b,0);if(n>total)throw new Error('Sample exceeds available entries');
 const groups=Object.keys(counts).sort();const out=Object.fromEntries(groups.map(g=>[g,Math.floor(n*counts[g]/total)]));
 const left=n-Object.values(out).reduce((a,b)=>a+b,0);
 groups.sort((a,b)=>(n*counts[b]/total-out[b])-(n*counts[a]/total-out[a])||a.localeCompare(b)).slice(0,left).forEach(g=>out[g]++);return out;
}
export function stratified(rows:Entry[],valid:number,hall:number){
 const h=rows.filter(r=>r.label==='HALLUCINATED');const groups:Record<string,Entry[]>={};for(const r of h)(groups[r.hallucination_type!]??=[]).push(r);
 const quotas=apportion(Object.fromEntries(Object.entries(groups).map(([g,rs])=>[g,rs.length])),hall);
 const v=rows.filter(r=>r.label==='VALID');if(v.length<valid)throw new Error('Insufficient valid entries');
 return order([...order(v).slice(0,valid),...Object.entries(groups).flatMap(([g,rs])=>order(rs).slice(0,quotas[g]))]);
}
export async function select(o:Options){
 const rows=await jsonl<Entry>(`${ROOT}/data/${o.split}.jsonl`), blind=await jsonl<BlindEntry>(`${ROOT}/data/${o.split}_blind.jsonl`);
 unique(rows);const bm=unique(blind);if(rows.length!==blind.length||rows.some(r=>!bm.has(r.bibtex_key)))throw new Error('Blind/label key mismatch');
 const gpt=await jsonl<Entry>(`${ROOT}/data/gptzero_neurips2025.jsonl`);const gkeys=new Set(gpt.map(r=>r.bibtex_key));
 const matched=rows.filter(r=>gkeys.has(r.bibtex_key));const source=rows.filter(r=>r.source==='gptzero_neurips2025');
 // Public splits rehash keys; raw GPTZero keys use gptzero_neurips2025_NNN.
 const overlap=new Set([...source,...matched].map(r=>r.bibtex_key));
 if(o.split==='test_public'&&overlap.size!==31)throw new Error('Expected 31 GPTZero-source test entries');
 const eligible=rows.filter(r=>!o.excludeGptzero||!overlap.has(r.bibtex_key));
 let chosen=order(eligible);
 if(o.pilot){const q=apportion({VALID:eligible.filter(r=>r.label==='VALID').length,HALLUCINATED:eligible.filter(r=>r.label==='HALLUCINATED').length},o.pilot);chosen=stratified(eligible,q.VALID,q.HALLUCINATED);}
 if(o.sample)chosen=stratified(eligible,154,246);
 const name=`${o.split}${o.pilot?'-pilot30':o.sample?'-sample400':''}${o.excludeGptzero?'-no-gptzero':''}`;
 const manifest={schema_version:1,upstream_commit:PIN,split:o.split,name,method:'Hamilton largest remainder across labels (pilot) and hallucination types, ties lexical; SHA256(bibtex_key) ascending within strata and final run order.',exclude_gptzero:o.excludeGptzero,gptzero_identification:'source == gptzero_neurips2025 (public split keys are rehashed); union raw bibtex_key matches if any',gptzero_raw_key_matches:matched.length,gptzero_overlap_count:overlap.size,gptzero_exact_title_matches:source.filter(r=>gpt.some(g=>g.fields.title===r.fields.title)).length,gptzero_overlap_keys:[...overlap].sort(),counts:{total:chosen.length,valid:chosen.filter(r=>r.label==='VALID').length,hallucinated:chosen.filter(r=>r.label==='HALLUCINATED').length,types:Object.fromEntries([...new Set(chosen.map(r=>r.hallucination_type).filter(Boolean))].sort().map(t=>[t,chosen.filter(r=>r.hallucination_type===t).length]))},blind_sha256:sha(await readFile(`${ROOT}/data/${o.split}_blind.jsonl`)),labels_sha256:sha(await readFile(`${ROOT}/data/${o.split}.jsonl`)),keys:chosen.map(r=>r.bibtex_key)};
 const path=`${ROOT}/selections/${name}.json`;
 try{const old=await json(path);if(JSON.stringify(old)!==JSON.stringify(manifest))throw new Error(`Selection drift: ${path}`);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;await save(path,manifest);}
 // Only the four blind fields cross the converter boundary, never label/type/source.
 return {manifest,path,entries:manifest.keys.map(k=>{const r=bm.get(k)!;return {bibtex_key:r.bibtex_key,bibtex_type:r.bibtex_type,fields:r.fields,raw_bibtex:r.raw_bibtex};})};
}
