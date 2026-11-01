import { readFile, writeFile } from 'node:fs/promises';
import { verifyReference } from '../src/core/verify';
import { VERDICTS } from '../src/core/types';
import type { IndexClient } from '../src/core/http';
import type { DiskCache } from './cache';
const source='https://gptzero.me/news/neurips/';
export async function realWorld(client:IndexClient,cache:DiskCache){
  try{
    let corpus=await cache.get('gptzero-corpus-v1') as {checkedAt:string;rows:{paper:string;raw:string}[]}|undefined;
    if(!corpus){
      const robotsResponse=await fetch('https://gptzero.me/robots.txt',{signal:AbortSignal.timeout(20000)});if(!robotsResponse.ok)throw new Error('robots.txt not retrievable');
      const robots=await robotsResponse.text();let applies=false;
      for(const line of robots.split('\n')){const m=line.trim().match(/^(user-agent|disallow):\s*(.*)/i);if(!m)continue;if(m[1].toLowerCase()==='user-agent')applies=m[2]==='*';else if(applies && m[2] && '/news/neurips/'.startsWith(m[2]))throw new Error('robots.txt disallows retrieval');}
      const response=await fetch(source,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error(`Source returned ${response.status}`);
      const html=await response.text();const table=html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi)?.find(t=>t.includes('Published Paper'));
      if(!table)throw new Error('Citation table could not be extracted');
      const plain=(s:string)=>s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;|&#160;/g,' ').replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").trim();
      const rows=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].slice(1).flatMap(m=>{const cells=[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c=>plain(c[1]));return cells.length>=4?[{paper:cells[0],raw:cells[2]}]:[];});
      if(!rows.length)throw new Error('No citations extracted');
      corpus={checkedAt:new Date().toISOString(),rows};await cache.set('gptzero-corpus-v1',corpus);
      await writeFile('eval/real-world-corpus.json',JSON.stringify({source,robotsAllowed:true,...corpus},null,2)+'\n');
    }
    const trials:any[]=[];
    for(const [i,row] of corpus.rows.entries()){const result=await verifyReference(row.raw,client);trials.push({...row,result});if((i+1)%10===0)console.log(`GPTZero public set ${i+1}/${corpus.rows.length}`);}
    const counts=Object.fromEntries(VERDICTS.map(v=>[v,trials.filter(t=>t.result.verdict===v).length]));
    const detected=trials.filter(t=>['Details differ','Identifier conflict','No record found'].includes(t.result.verdict)).length;
    const report={status:'completed',source,robotsUrl:'https://gptzero.me/robots.txt',robotsAllowed:true,retrievedAt:corpus.checkedAt,runAt:new Date().toISOString(),total:trials.length,detected,detectionRate:detected/trials.length,counts,note:'Separate real-world set. Ground-truth labels are GPTZero\'s claims, not independently adjudicated here. All extracted table rows included. Never pooled with synthetic hold-out metrics.',trials};
    await writeFile('eval/real-world-results.json',JSON.stringify(report,null,2)+'\n');return {...report,trials:undefined};
  }catch(error){const report={status:'skipped',source,reason:error instanceof Error?error.message:String(error)};await writeFile('eval/real-world-results.json',JSON.stringify(report,null,2)+'\n');return report;}
}
