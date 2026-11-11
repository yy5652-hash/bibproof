import { readFile, appendFile, mkdir, open, unlink, readdir } from 'node:fs/promises';
import { verifyReference } from '../../src/core/verify';
import { ROOT, PIN, options, optionalJsonl, json, save, sha, unique, type Prediction } from './common';
import { select } from './select';
import { convert } from './convert';
import { DailyBudget, MeasuredClient, IdentityReplay } from './client';
import { mapVerdict } from './mapping';
async function fingerprint(){
 const paths=['package-lock.json',...(await readdir('src/core')).filter(x=>x.endsWith('.ts')).map(x=>'src/core/'+x),...(await readdir('scripts/hallmark')).filter(x=>x.endsWith('.ts')&&!x.endsWith('.test.ts')).map(x=>'scripts/hallmark/'+x)];
 return Object.fromEntries(await Promise.all(paths.sort().map(async p=>[p,sha(await readFile(p))])));
}
async function main(){
 const o=options();if(o.selection)throw new Error('--selection is scorer-only');
 const selected=await select(o),{manifest}=selected;console.log(JSON.stringify({selection:selected.path,counts:manifest.counts}));
 if(o.prepareOnly)return;
 await mkdir(`${ROOT}/cache`,{recursive:true});const lockPath=`${ROOT}/cache/runner.lock`;
 const lock=await open(lockPath,'wx').catch(()=>{throw new Error(`Runner lock exists: ${lockPath}; if a prior run crashed, confirm it ended before removing this file`);});
 await lock.writeFile(String(process.pid));let stop=false;const stopSignal=()=>{stop=true;};process.on('SIGINT',stopSignal);process.on('SIGTERM',stopSignal);
 try{
 const base=`${ROOT}/runs/${manifest.name}`;await mkdir(base,{recursive:true});
 const fp=await fingerprint(),config={schema_version:1,upstream_commit:PIN,selection_sha256:sha(JSON.stringify(manifest)),production_and_harness_sha256:fp,network:'live fetch, production IndexClient with disk response cache, 1000ms per-host queue'};
 try{const old=await json(`${base}/config.json`);if(JSON.stringify(old)!==JSON.stringify(config))throw new Error('Code/data/selection drift: archive the previous run before rerunning');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;await save(`${base}/config.json`,config);}
 const predPath=`${base}/predictions.jsonl`,done=unique(await optionalJsonl<Prediction>(predPath));
 if([...done.keys()].some(k=>!manifest.keys.includes(k)))throw new Error('Unexpected prediction key');
 const budget=new DailyBudget(o.budget),client=new MeasuredClient(budget);const start=Date.now();let completed=0,status='complete';
 for(const entry of selected.entries){
  if(done.has(entry.bibtex_key))continue;
  if(stop){status='interrupted';break;}
  if(await budget.used()>=o.budget){status='daily_budget_reached';break;}
  client.reset();const entryStart=Date.now();let raw='',result,conversionError:string|undefined;
  try{raw=await convert(entry);}catch(e){conversionError=e instanceof Error?e.message:String(e);}
  if(!conversionError)result=await verifyReference(raw,client);
  let decision=result?mapVerdict(result):{label:'UNCERTAIN' as const,confidence:0.5};let reason=result?`${result.verdict}: ${result.explanation}`:`Could not check: production .bib upload conversion failed: ${conversionError}`;
  let identity;
  if(result?.verdict==='Retracted'){
   const replay=new IdentityReplay(client.responses);identity=await verifyReference(raw,replay);
   if(!replay.missing&&identity.verdict!=='Retracted'){decision=mapVerdict(identity);reason+=` Identity before retraction override: ${identity.verdict}. ${identity.explanation}`;}
   else reason+=' Identity before retraction override unavailable; UNCERTAIN.';
  }
  const audit={bibtex_key:entry.bibtex_key,reference:raw,result,identity,conversion_error:conversionError,requests:client.requests,calls:client.calls,openalex_searches:client.calls.filter(c=>c.openalex_search).length,openalex_search_requests:client.requests.filter(r=>new URL(r.url).host==='api.openalex.org'&&new URL(r.url).searchParams.has('search')).length,wall_clock_seconds:(Date.now()-entryStart)/1000,day:new Date().toISOString().slice(0,10)};
  if(client.halted){await appendFile(`${base}/deferred.jsonl`,JSON.stringify({...audit,reason:'Budget reached mid-entry; no prediction saved. Resume this key with cached responses.'})+'\n');status='daily_budget_reached';break;}
  const prediction:Prediction={bibtex_key:entry.bibtex_key,...decision,reason,api_sources_queried:[...new Set(result?.evidence.map(e=>e.index)??[])],wall_clock_seconds:audit.wall_clock_seconds,api_calls:client.calls.length};
  // Audit first, prediction second. Crash may leave an orphan audit, never a fabricated prediction.
  await appendFile(`${base}/audit.jsonl`,JSON.stringify(audit)+'\n');await appendFile(predPath,JSON.stringify(prediction)+'\n');done.set(entry.bibtex_key,prediction);completed++;
  console.log(`${done.size}/${manifest.keys.length} ${entry.bibtex_key} ${result?.verdict??'Conversion failed'} -> ${decision.label}; OpenAlex searches=${audit.openalex_searches}; HTTP=${prediction.api_calls}`);
 }
 const current=await fingerprint();const codeChanged=JSON.stringify(fp)!==JSON.stringify(current);
 await save(`${base}/status.json`,{status,selected:manifest.keys.length,completed:done.size,completed_this_invocation:completed,daily_search_budget:o.budget,searches_reserved_today:await budget.used(),elapsed_seconds:(Date.now()-start)/1000,finished_at:new Date().toISOString(),source_changed_during_run:codeChanged});
 if(codeChanged)throw new Error('Source changed during run; see config.json hashes and status.json. Do not pool runs across versions.');
 console.log(JSON.stringify({status,completed:done.size,path:predPath}));
 }finally{process.off('SIGINT',stopSignal);process.off('SIGTERM',stopSignal);await lock.close();await unlink(lockPath);}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
