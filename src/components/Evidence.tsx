import { useEffect, useState } from 'react';
import type { CheckResult, Work } from '../core/types';
import { formatWork, registerStyle, type CitationStyle } from '../core/format';
const styleLoads=new Map<string,Promise<void>>();
export async function ensureStyle(style:CitationStyle){if(['apa','vancouver'].includes(style))return;let task=styleLoads.get(style);if(!task){task=fetch(`${import.meta.env.BASE_URL}styles/${style}.csl`).then(r=>{if(!r.ok)throw new Error('Citation style could not be loaded.');return r.text();}).then(xml=>registerStyle(style,xml));styleLoads.set(style,task);task.catch(()=>styleLoads.delete(style));}await task;}
export function SourceLink({url,children}:{url:string;children:React.ReactNode}){return /^https?:\/\//i.test(url)?<a href={url} target="_blank" rel="noreferrer">{children}<span aria-hidden="true"> ↗</span></a>:<span>{children}</span>;}
function Record({work,label}:{work:Work;label:string}){return <div className="record"><span className="eyebrow">{label}</span><p><SourceLink url={work.url}>{work.title}</SourceLink></p><small>{work.authors.slice(0,6).map(a=>a.family).join(', ')}{work.authors.length>6?' et al.':''} · {work.year??'Year unavailable'} · {work.source}</small></div>;}
export function Evidence({result,style}:{result:CheckResult;style:CitationStyle}){
  const [corrected,setCorrected]=useState('');const [error,setError]=useState('');const [copied,setCopied]=useState(false);
  useEffect(()=>{let active=true;setCorrected('');setError('');if(result.match)void ensureStyle(style).then(()=>formatWork(result.match!,style)).then(text=>{if(active)setCorrected(text);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[result.match,style]);
  async function copy(){try{await navigator.clipboard.writeText(corrected);setCopied(true);}catch{setError('Clipboard unavailable. Select and copy the corrected text below.');}}
  return <div className="evidence">
    <p className="verdict-explanation">{result.explanation}</p>
    {result.identifierRecord&&<Record work={result.identifierRecord} label="Your identifier points to"/>}
    {result.match&&<Record work={result.match} label={result.identifierRecord?'Closest title match — review before using':'Matched source record'}/>}
    {!result.match&&result.nearest&&<Record work={result.nearest} label="Did you mean? — nearest result, not a confirmed match"/>}
    {result.score&&<div className="field-grid" role="table" aria-label="Field-level evidence"><div className="field-row field-head" role="row"><span role="columnheader">Field</span><span role="columnheader">What you wrote</span><span role="columnheader">What the record says</span></div>{result.score.fields.map(f=><div className={`field-row ${f.status}`} role="row" key={f.field}><strong role="cell">{f.field}<small>{f.status==='agree'?'✓ Agrees':f.status==='differ'?'≠ Differs':'– Uncertain'}</small></strong><span role="cell">{f.written}</span><span role="cell">{f.record}</span></div>)}</div>}
    {result.match?.retractionUrls?.map(url=><p key={url}><SourceLink url={url}>Read the retraction notice</SourceLink></p>)}
    <div className="index-log"><h4>Index trail</h4>{result.evidence.length? <ul>{result.evidence.map((e,i)=><li key={i}><span className={e.status==='answered'?'index-ok':'index-fail'}>{e.status==='answered'?'✓':'!'} {e.index}</span><span>{e.status==='answered'?`${e.count} record${e.count===1?'':'s'}${e.cached?' · cached':''}`:'Unavailable'} · <SourceLink url={e.url}>Query evidence</SourceLink>{e.detail&&<small>{e.detail}</small>}</span></li>)}</ul>:<p>No scholarly-index request sent: this entry is outside supported coverage. {result.reference.url&&<SourceLink url={result.reference.url}>Open original source</SourceLink>}</p>}<p className="fine-print">Checked {new Date(result.checkedAt).toLocaleString()}. Retraction coverage depends on index metadata; no flag is not a guarantee.</p></div>
    {result.match&&<div className="correction"><div className="section-line"><h4>Corrected reference</h4><button className="button small" onClick={copy} disabled={!corrected}>{copied?'Copied ✓':'Copy reference'}</button></div><p className="corrected-text">{corrected||'Formatting reference…'}</p>{result.verdict!=='Verified'&&<small>Review the matched work and all warnings before using this correction.</small>}</div>}
    {error&&<p role="alert" className="error">{error}</p>}
  </div>;
}
