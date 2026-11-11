// Reproduce the completed pilot from its byte-verified production source snapshot
// and locally retained response cache. Never sends network traffic or rewrites predictions.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, json, jsonl, sha, save, unique, type BlindEntry, type Prediction } from './common';
import { DiskCache } from './client';
async function main(){
 const base=`${ROOT}/runs/dev_public-pilot30`,snapshot=await json(`${base}/source-snapshot.json`);
 for(const f of snapshot.files)if(sha(await readFile(f.snapshot))!==f.sha256)throw new Error(`Snapshot hash mismatch ${f.path}`);
 const load=(path:string)=>import(pathToFileURL(resolve(`${base}/source/${path}`)).href);
 const [{verifyReference},{IndexClient},{convert}]=await Promise.all([load('src/core/verify.ts'),load('src/core/http.ts'),load('scripts/hallmark/convert.ts')]);
 const disk=new DiskCache(),cache={get:async(key:string)=>{const hit=await disk.get(key);return key.startsWith('response:')&&hit?{...hit,at:Date.now()}:hit;},set:async()=>{}};
 let forbidden=0;const client=new IndexClient(cache,async()=>{forbidden++;throw new Error('Offline replay: cache miss; network forbidden');},0);
 const entries=unique(await jsonl<BlindEntry>(`${ROOT}/data/dev_public_blind.jsonl`)),audit=unique(await jsonl<any>(`${base}/audit.jsonl`)),preds=await jsonl<Prediction>(`${base}/predictions.jsonl`),checks=[];
 for(const p of preds){const entry=entries.get(p.bibtex_key)!;const raw=await convert({bibtex_key:entry.bibtex_key,bibtex_type:entry.bibtex_type,fields:entry.fields,raw_bibtex:entry.raw_bibtex});
 const result=await verifyReference(raw,client),old=audit.get(p.bibtex_key).result;const same=raw===audit.get(p.bibtex_key).reference&&result.verdict===old.verdict&&result.explanation===old.explanation&&result.match?.id===old.match?.id;
 checks.push({bibtex_key:p.bibtex_key,verdict:result.verdict,identical_reference_verdict_explanation_match:same});
 }
 const report={source_hashes_verified:snapshot.files.length,entries:checks.length,identical:checks.filter(c=>c.identical_reference_verdict_explanation_match).length,network_attempts:forbidden,cache_policy:'Read-only; recorded responses reused regardless of age. Production cache TTL is not a reproducibility limit.',checks};
 await save(`${base}/replay.json`,report);console.log(JSON.stringify({source_hashes_verified:report.source_hashes_verified,entries:report.entries,identical:report.identical,network_attempts:forbidden}));
 if(forbidden||report.identical!==report.entries)throw new Error('Offline replay failed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
