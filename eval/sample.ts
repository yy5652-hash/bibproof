import { writeFile } from 'node:fs/promises';
import { IndexClient } from '../src/core/http';
import { verifyReference } from '../src/core/verify';
import { sampleEntries } from '../src/core/sample';
import { DiskCache } from './cache';
const client=new IndexClient(new DiskCache());const results=[];
for(const s of sampleEntries){const result=await verifyReference(s.raw,client);console.log(s.kind,'→',result.verdict,result.match?.title??result.nearest?.title??'');results.push({expected:s.kind,passes:s.kind===result.verdict,...result});}
await writeFile('eval/sample-results.json',JSON.stringify({runAt:new Date().toISOString(),allPassed:results.every(r=>r.passes),results},null,2)+'\n');
if(results.some(r=>!r.passes))process.exitCode=1;
