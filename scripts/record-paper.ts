/** Record the paper's references live; --from-saved assembles an explicitly dated
 * example from the existing real live-run snapshot without claiming a new run. */
import { readFile,writeFile } from 'node:fs/promises';
import { paperEntries,PAPER } from '../src/core/paper-sample';
import { IndexClient } from '../src/core/http';
import { verifyReference } from '../src/core/verify';
import { DiskCache } from '../eval/cache';
import type { CheckResult } from '../src/core/types';
const fromSaved=process.argv.includes('--from-saved');
let results:CheckResult[],runAt:string,provenance:string;
if(fromSaved){
 const saved=JSON.parse(await readFile('src/core/sample-snapshot.json','utf8'));
 results=paperEntries.map(e=>{const i=saved.entries.indexOf(e.raw);if(i<0)throw new Error('Missing live sample evidence');return saved.results[i];});
 runAt=saved.runAt;provenance=`Constructed manuscript assembled from existing live sample evidence (${saved.runAt}). No new live check is claimed. Original provenance: ${saved.provenance}`;
}else{
 // Fail early if public indexes cannot be reached; never publish a failed snapshot.
 await fetch('https://api.crossref.org/works/10.1038%2Fnature14539',{signal:AbortSignal.timeout(10000)});
 const budget=new DiskCache();
 const client=new IndexClient({get:k=>k.startsWith('openalex-budget:')?budget.get(k):Promise.resolve(undefined),set:async(k,v)=>{if(k.startsWith('openalex-budget:'))await budget.set(k,v);}});
 results=[];for(const e of paperEntries)results.push(await verifyReference(e.raw,client));
 runAt=new Date().toISOString();provenance='Fresh live public scholarly index requests for this constructed manuscript; no verdict overrides.';
}
if(results.some((r,i)=>r.verdict!==paperEntries[i].kind))throw new Error('Unexpected verdict; snapshot not written');
await writeFile('src/core/paper-snapshot.json',JSON.stringify({runAt,provenance,document:PAPER,entries:paperEntries.map(e=>e.raw),results},null,2)+'\n');
console.log(`Saved paper with ${results.length} references; evidence checked ${runAt}; ${fromSaved?'assembled from existing live evidence':'fresh live run'}.`);
