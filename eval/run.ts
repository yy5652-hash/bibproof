import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { IndexClient } from '../src/core/http';
import { fromCrossref } from '../src/core/indexes';
import { verifyReference } from '../src/core/verify';
import { citationEngine, formatWork, registerStyle, type CitationStyle } from '../src/core/format';
import { tokens } from '../src/core/parse';
import { VERDICTS, type Work, type CheckResult } from '../src/core/types';
import { DiskCache } from './cache';
import { realWorld } from './real-world';
import { messyGenuine } from './messy';
const tuning=process.argv.includes('--tune');const seed=tuning?1729:88421;
const cache=new DiskCache();const client=new IndexClient(cache);
function rng(initial:number){let state=initial>>>0;return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};}
function shuffle<T>(values:T[],seed:number){const next=rng(seed);const copy=[...values];for(let i=copy.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
const disciplines=['machine learning','molecular biology','quantum physics','cognitive psychology','economic history','climate science'];
const perDiscipline=tuning?2:10;
const styles:CitationStyle[]=['apa','mla','ieee','vancouver'];
for(const name of ['mla','ieee'] as const)await registerStyle(name,await readFile(`public/styles/${name}.csl`,'utf8'));
await citationEngine();
const pools:Work[][]=[];
for(const discipline of disciplines){
  const key='sampling-pool-v2:'+discipline;
  let pool=await cache.get(key) as Work[]|undefined as Work[];
  if(!pool){
    const response=await client.request(`https://api.crossref.org/works?query=${encodeURIComponent(discipline)}&filter=type:journal-article,from-pub-date:1990-01-01,until-pub-date:2024-12-31&rows=500`);
    if(!response.ok)throw new Error(`Sampling failed: ${discipline}: ${response.error}`);
    pool=response.data.message.items.map(fromCrossref).filter((w:Work)=>w.doi&&w.authors.length&&w.authors.length<=40&&w.year&&tokens(w.title).length>=5&&!w.retracted&&/^[\x00-\x7F\u00C0-\u024F\u2000-\u206F]+$/.test(w.title));
    await cache.set(key,pool);
  }
  if(pool.length<25)throw new Error(`Insufficient eligible records in ${discipline}: ${pool.length}`);
  pools.push(pool);
}
// Disjoint tuning and held-out documents, not just different shuffle orders.
const tuneIds=new Set(pools.flatMap((pool,i)=>shuffle(pool,1729+i).slice(0,4).map(w=>w.id)));
const used=new Set<string>();const genuine:Work[]=[];const donors:Work[]=[];
for(const [i,pool] of pools.entries()){
  const choices=shuffle(pool,seed+i).filter(w=>!used.has(w.id)&&(tuning||!tuneIds.has(w.id)));
  const selected=choices.slice(0,perDiscipline*2);if(selected.length<perDiscipline*2)throw new Error('Not enough disjoint works');
  selected.forEach(w=>used.add(w.id));genuine.push(...selected.slice(0,perDiscipline));donors.push(...selected.slice(perDiscipline));
}
interface Trial{group:string;style:CitationStyle;sourceDoi?:string;raw:string}
const trials:Trial[]=[];
for(const work of genuine)for(const style of styles)trials.push({group:'genuine',style,sourceDoi:work.doi,raw:await formatWork(work,style)});
const classes=['invented','chimera','bogus DOI','mutated'];
const replacement=['maritime','crystalline','orchards','velvet','cartography','subterranean','tapestries','lunar','ceramics','harpsichord','archipelago','mosaic'];
for(let i=0;i<donors.length;i++){
  const work=donors[i],other=donors[(i+7)%donors.length];const group=classes[i%4];const fake:Work={...work,authors:[...work.authors],doi:undefined,url:''};
  if(group==='invented'){let j=0;fake.title=work.title.replace(/[\p{L}]{4,}/gu,()=>replacement[(j+++i)%replacement.length]);}
  if(group==='chimera')fake.authors=other.authors;
  if(group==='bogus DOI')fake.doi=other.doi;
  if(group==='mutated'){let changed=0;fake.title=work.title.replace(/[\p{L}]{5,}/gu,word=>changed<2?replacement[(i+changed++)%replacement.length]:word);fake.year=(work.year??2000)+7;}
  trials.push({group,style:styles[i%4],sourceDoi:work.doi,raw:await formatWork(fake,styles[i%4])});
}
await mkdir('eval',{recursive:true});
// The real-world and messy sets run first: they matter most and the OpenAlex budget is daily.
let optionalSet:unknown={status:'not run in tuning'};
if(!tuning)optionalSet=await realWorld(client,cache);
const realisticGenuine=await messyGenuine(client,tuning);
console.log('realistic genuine',JSON.stringify({...realisticGenuine,misjudged:realisticGenuine.misjudged.length}));
await writeFile(tuning?'eval/tuning-corpus.json':'eval/corpus.json',JSON.stringify({seed,disciplines,genuineWorks:genuine.length,fabricationDonorWorks:donors.length,trials},null,2)+'\n');
const checked:(Trial&{result:CheckResult})[]=[];
for(const [i,trial] of trials.entries()){
  const result=await verifyReference(trial.raw,client);checked.push({...trial,result});
  if((i+1)%10===0||i===trials.length-1)console.log(`${tuning?'tuning':'held-out'} ${i+1}/${trials.length}: ${trial.group} → ${result.verdict}`);
}
const confusionMatrix=Object.fromEntries(['genuine',...classes].map(group=>[group,Object.fromEntries(VERDICTS.map(v=>[v,checked.filter(t=>t.group===group&&t.result.verdict===v).length]))]));
const reals=checked.filter(t=>t.group==='genuine');const fakes=checked.filter(t=>t.group!=='genuine');
const flagged=(t:typeof checked[number])=>['Details differ','Identifier conflict','No record found'].includes(t.result.verdict);
const falseAccusations=reals.filter(t=>t.result.verdict==='No record found').length;
const detectionByClass=Object.fromEntries(classes.map(group=>{const rows=fakes.filter(t=>t.group===group);const detected=rows.filter(flagged).length;return [group,{total:rows.length,detected,rate:detected/rows.length,abstained:rows.filter(t=>t.result.verdict==='Could not check').length}];}));
const report={schemaVersion:1,mode:tuning?'tuning':'held-out',runAt:new Date().toISOString(),seed,tuningSeed:1729,heldOutSeed:88421,disjointFromTuning:!tuning,thresholds:{strongTitle:.88,strongAuthors:.7,nearTitle:.65,identifierTitleConflict:.55},sampling:{disciplines,poolSizes:pools.map(p=>p.length),method:'Fixed-seed shuffle of cached Crossref top-500 topical queries (journal articles, 1990–2024). Excludes missing metadata, >40 authors, retracted works, titles with <5 content tokens, and titles outside Latin-script filter. Not a population-representative sample.',genuineWorks:genuine.length,styles,genuineTrials:reals.length,fabricatedTrials:fakes.length},realisticGenuine,metrics:{falseAccusations,genuineTotal:reals.length,falseAccusationRate:falseAccusations/reals.length,genuineAccepted:reals.filter(t=>['Verified','Details differ'].includes(t.result.verdict)).length,genuineIdentifierConflicts:reals.filter(t=>t.result.verdict==='Identifier conflict').length,detectionRate:fakes.filter(flagged).length/fakes.length,abstentions:checked.filter(t=>t.result.verdict==='Could not check').length,detectionByClass},definitions:{falseAccusation:'A genuine formatted reference classified No record found, divided by all genuine formatting trials.',detection:'Fabrication flagged Details differ, Identifier conflict, or No record found. Details differ is a review warning, not an accusation of fabrication. Could not check is an abstention and stays in the denominator.',confusionMatrix:'Rows are ground-truth groups; columns are all six output verdicts. Genuine trials accept Verified or Details differ.',uncertainty:'Four formats of the same work are correlated. Synthetic fabrications and source-index overlap limit generalisation. No population-wide accuracy claim.'},confusionMatrix,indexFailures:checked.flatMap(t=>t.result.evidence.filter(e=>e.status==='failed').map(e=>({group:t.group,index:e.index,detail:e.detail}))),optionalSet,trials:checked};
const path=tuning?'eval/tuning-results.json':'eval/results.json';await writeFile(path,JSON.stringify(report,null,2)+'\n');
if(!tuning){const {trials:_t,indexFailures:_f,...summary}=report as any;await writeFile('eval/summary.json',JSON.stringify(summary,null,2)+'\n');}
console.log(JSON.stringify({path,metrics:report.metrics,confusionMatrix},null,2));
