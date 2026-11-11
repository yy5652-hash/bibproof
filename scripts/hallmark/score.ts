import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { ROOT, PIN, json, jsonl, optionalJsonl, options, unique, save, sha, type Entry, type Prediction } from './common';
import { select } from './select';
const ratio=(a:number,b:number)=>b?a/b:0;
function matrix(entries:Entry[],preds:Map<string,Prediction>){
 const cm={tp:0,fp:0,tn:0,fn:0};for(const e of entries){const p=preds.get(e.bibtex_key);if(!p||p.evaluated===false||p.label==='UNCERTAIN')continue;
 if(e.label==='HALLUCINATED')p.label==='HALLUCINATED'?cm.tp++:cm.fn++;else p.label==='HALLUCINATED'?cm.fp++:cm.tn++;}return cm;
}
function rates(cm:ReturnType<typeof matrix>){return {detection_rate:ratio(cm.tp,cm.tp+cm.fn),false_positive_rate:ratio(cm.fp,cm.fp+cm.tn),f1:ratio(2*cm.tp,2*cm.tp+cm.fp+cm.fn)};}
export function metrics(entries:Entry[],predictions:Prediction[]){
 const preds=unique(predictions);for(const p of predictions)if(!['VALID','HALLUCINATED','UNCERTAIN'].includes(p.label))throw new Error(`Invalid prediction label ${p.label}`);
 const cm=matrix(entries,preds),valid=entries.filter(e=>e.label==='VALID'),hall=entries.filter(e=>e.label==='HALLUCINATED');
 const evaluated=(e:Entry)=>{const p=preds.get(e.bibtex_key);return p&&p.evaluated!==false?p:undefined;};
 const uncertain=(es:Entry[])=>es.filter(e=>evaluated(e)?.label==='UNCERTAIN').length;
 const missing=(es:Entry[])=>es.filter(e=>!evaluated(e)).length;
 const tier3=[...valid,...hall.filter(e=>e.difficulty_tier===3)];
 const per_type=Object.fromEntries([...new Set(entries.map(e=>e.hallucination_type??'valid'))].sort().map(t=>{
 const group=t==='valid'?valid:hall.filter(e=>e.hallucination_type===t),m=matrix(t==='valid'?valid:[...valid,...group],preds);
 return [t,{total:group.length,answered:group.filter(e=>evaluated(e)&&evaluated(e)?.label!=='UNCERTAIN').length,uncertain:uncertain(group),missing:missing(group),...m,...rates(m),all_input_detection:t==='valid'?0:ratio(m.tp,group.length)}];}));
 return {total:entries.length,valid:valid.length,hallucinated:hall.length,...cm,...rates(cm),tier3_f1:rates(matrix(tier3,preds)).f1,coverage:ratio(cm.tp+cm.fp+cm.tn+cm.fn,entries.length),response_coverage:ratio(entries.length-missing(entries),entries.length),all_input_detection:ratio(cm.tp,hall.length),uncertain_valid:uncertain(valid),uncertain_hallucinated:uncertain(hall),missing_valid:missing(valid),missing_hallucinated:missing(hall),per_type};
}
export async function score(selectionPath:string){
 const selection=await json(selectionPath);const all=await jsonl<Entry>(`${ROOT}/data/${selection.split}.jsonl`),em=unique(all);
 const entries:Entry[]=selection.keys.map((k:string)=>{const e=em.get(k);if(!e)throw new Error(`Unknown selection key ${k}`);return e;});unique(entries);
 const run=`${ROOT}/runs/${selection.name}`;const predictions=await optionalJsonl<Prediction>(`${run}/predictions.jsonl`);
 const completed=new Set(predictions.map(p=>p.bibtex_key));if(predictions.some(p=>!selection.keys.includes(p.bibtex_key)))throw new Error('Prediction outside selection');
 // Compare on exactly the completed input keys, including Bibproof's abstentions.
 // For partial runs, also publish selected-set coverage below so missing is visible.
 const paired=entries.filter(e=>completed.has(e.bibtex_key));
 const llmPath=`${ROOT}/data/upstream/results/checkpoints/llm_openai/openai_gpt-5.1.jsonl`;
 const cascadePath=`${ROOT}/data/upstream/results/cascade_gpt51/gpt51_${selection.split}_preds.jsonl`;
 const comparisons:any[]=[{name:'Bibproof',source:`${run}/predictions.jsonl`,metrics:metrics(paired,predictions)}];
 for(const [name,path] of [['Zero-shot GPT-5.1 (saved)',''+llmPath],['Cascade GPT-5.1 variant (saved)',cascadePath]]){
  const saved=await jsonl<Prediction>(path),pm=unique(saved);const used=paired.flatMap(e=>{const p=pm.get(e.bibtex_key);return p?[p]:[];});
  comparisons.push({name,source:path,matched_keys:used.length,requested_keys:paired.length,missing_keys:paired.filter(e=>!pm.has(e.bibtex_key)).map(e=>e.bibtex_key),metrics:metrics(paired,used)});
 }
 const unavailable=[{name:'Released DOI-only',reason:'Pinned release contains aggregate scores and relabel-key deltas, no complete per-entry predictions. Exact subset rescore unavailable.'},{name:'Released cascade_db_diagnosis (Sonnet)',reason:'Summary-only release; regenerate_cascade.py reconstructs aggregates. GPT-5.1 cascade above is a separate saved variant, not a substitute for released Sonnet scores.'}];
 async function publishedJson(path:string){let normalized=0;const raw=await readFile(path,'utf8');const text=raw.replace(/("(?:\\.|[^"\\])*")|(-?Infinity|NaN)/g,(match,quoted)=>{if(quoted)return match;normalized++;return 'null';});return {nonfinite_values_normalized_to_null:normalized,result:JSON.parse(text)};}
 const published=await Promise.all(['doi_only','llm_openai','cascade_db_diagnosis'].map(async tool=>({tool,source:`${ROOT}/data/baseline_results/${tool}_${selection.split}.json`,comparison_scope:'Published full split only; NOT a paired subset rescore',...await publishedJson(`${ROOT}/data/baseline_results/${tool}_${selection.split}.json`)})));
 const audit=await optionalJsonl<any>(`${run}/audit.jsonl`),deferred=await optionalJsonl<any>(`${run}/deferred.jsonl`);
 const counts=paired.map(e=>({bibtex_key:e.bibtex_key,openalex_searches:audit.filter(a=>a.bibtex_key===e.bibtex_key).reduce((n,a)=>n+a.openalex_searches,0),api_calls:audit.filter(a=>a.bibtex_key===e.bibtex_key).reduce((n,a)=>n+a.calls.length,0)}));
 const searches=counts.reduce((n,c)=>n+c.openalex_searches,0),calls=counts.reduce((n,c)=>n+c.api_calls,0),mean=ratio(searches,paired.length);
 const testEntries=await jsonl<Entry>(`${ROOT}/data/test_public.jsonl`);
 const searchByTruth=Object.fromEntries((['VALID','HALLUCINATED'] as const).map(label=>{const group=paired.filter(e=>e.label===label),keys=new Set(group.map(e=>e.bibtex_key)),n=counts.filter(c=>keys.has(c.bibtex_key)).reduce((sum,c)=>sum+c.openalex_searches,0);return [label,{pilot_inputs:group.length,searches:n,searches_per_entry:ratio(n,group.length),test_inputs:testEntries.filter(e=>e.label===label).length}];}));
 const adjusted=Object.values(searchByTruth).reduce((sum,g)=>sum+g.searches_per_entry*g.test_inputs,0);
 const result={schema_version:1,upstream_commit:PIN,selection:selectionPath,selection_sha256:sha(JSON.stringify(selection)),run_config:await json(`${run}/config.json`).catch(()=>null),run_status:await json(`${run}/status.json`).catch(()=>null),source_snapshot:await json(`${run}/source-snapshot.json`).catch(()=>null),scope:selection.name.includes('pilot')?'30-entry dev_public pilot; NOT a benchmark result':'Prepared selection / run',selected_input_metrics:metrics(entries,predictions),paired_input_count:paired.length,paired_keys:paired.map(e=>e.bibtex_key),comparisons,unavailable_paired_baselines:unavailable,published_full_split_context:published,cost:{openalex_searches:searches,mean_openalex_searches_per_entry:mean,searches_by_true_label:searchByTruth,label_mix_adjusted_projected_searches_831:adjusted,label_mix_adjusted_projected_days_831_at_80:Math.ceil(adjusted/80),per_entry:counts,total_http_calls:calls,total_entry_seconds:predictions.reduce((n,p)=>n+p.wall_clock_seconds,0),deferred_searches:deferred.reduce((n,a)=>n+a.openalex_searches,0),projected_searches_831:mean*831,projected_days_831_at_80:Math.ceil(mean*831/80),projection:'Linear extrapolation from this small dev pilot, cold cache, includes search retries. Split composition, outages, caching, and singleton quotas may change it; not a guarantee.',paid_api_spend_usd:0,paid_api_basis:'No LLM/provider key configured; public endpoints only. No paid API baseline reruns.'},definitions:{positive:'HALLUCINATED',uncertain:'Excluded from TP/FP/TN/FN; counts toward response coverage, not selective coverage.',missing:'Not counted as UNCERTAIN; excluded from classification metrics, reduces both coverages.',tier3_f1:'Tier-3 hallucinated entries plus ALL valid entries, matching upstream per_tier_metrics.',per_type:'Each hallucination type plus ALL valid inputs for FP/FPR/F1. Type total/uncertain/all-input detection use only that type.',zero_denominator:'0, as in upstream ConfusionMatrix; inspect counts when a stratum has no answers.',all_input_detection:'TP / all selected hallucinated inputs, including uncertain and missing.',confidence:'Fixed heuristic P(predicted label correct), not calibrated probabilities.'}};
 const pct=(x:number)=>(100*x).toFixed(1)+'%';
 let md=`# ${result.scope}\n\nSelected ${entries.length}; completed ${paired.length}. Comparison rows use exactly these ${paired.length} completed input keys, including abstentions.\n\n| Tool | n | DR | FPR | F1 | Tier-3 F1 | Coverage | All-input DR | FP | U valid | U hall |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
 for(const r of comparisons){const m=r.metrics;md+=`| ${r.name} | ${m.total} | ${pct(m.detection_rate)} | ${pct(m.false_positive_rate)} | ${pct(m.f1)} | ${pct(m.tier3_f1)} | ${pct(m.coverage)} | ${pct(m.all_input_detection)} | ${m.fp} | ${m.uncertain_valid} | ${m.uncertain_hallucinated} |\n`;}
 md+='\nDOI-only and released Sonnet cascade: exact subset rescore unavailable (no complete saved predictions at pin). Published full-split aggregates are retained in JSON as context only. GPT-5.1 cascade is explicitly a different saved variant.\n';
 md+='\n| Hallucination type | Inputs | TP | FN | Uncertain | Missing | All-input DR |\n|---|---:|---:|---:|---:|---:|---:|\n';
 for(const [type,m] of Object.entries(result.selected_input_metrics.per_type))md+=`| ${type} | ${m.total} | ${m.tp} | ${m.fn} | ${m.uncertain} | ${m.missing} | ${pct(m.all_input_detection)} |\n`;
 md+=`\nActual OpenAlex keyword searches: ${searches} (${mean.toFixed(3)}/entry). Linear projection: ${(mean*831).toFixed(1)} searches, ${Math.ceil(mean*831/80)} days at 80/day. Paid API spend: $0. This is a pilot extrapolation, not a benchmark result or a quota guarantee.\n`;
 md+=`\nAdjusting for the test label mix (307 valid / 524 hallucinated): ${adjusted.toFixed(1)} searches, ${Math.ceil(adjusted/80)} days at 80/day. Small-stratum pilot estimates remain uncertain.\n`;
 const out=`${ROOT}/results-${selection.name}`;await save(out+'.json',result);await writeFile(out+'.md',md);
 // Required conventional split output is the most recently scored selection;
 // embedded selection path/name makes pilot scope unambiguous.
 await save(`${ROOT}/results-${selection.split}.json`,result);await writeFile(`${ROOT}/results-${selection.split}.md`,md);
 console.log(md);return result;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){const o=options();const path=o.selection??(await select(o)).path;score(path).catch(e=>{console.error(e);process.exitCode=1;});}
