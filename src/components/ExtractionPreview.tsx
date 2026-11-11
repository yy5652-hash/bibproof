import { useState } from 'react';
import type { Extraction } from '../core/extract';
import { useI18n } from '../i18n';
export function ExtractionPreview({extraction,onConfirm,onCancel}:{extraction:Extraction;onConfirm:(ex:Extraction)=>void;onCancel:()=>void}) {
 const {t}=useI18n();const [entries,setEntries]=useState(extraction.entries);
 const nonempty=entries.map(e=>e.trim()).filter(Boolean);
 return <section className="extraction-preview" aria-label={t('preview.title')}>
  <h3>{t('preview.title')}</h3><p>{t('preview.note')}</p>
  {entries.map((entry,i)=><div key={i}>
   <label>{t('preview.entry',{n:i+1})}<textarea value={entry} onChange={e=>setEntries(old=>old.map((v,n)=>n===i?e.target.value:v))}/></label>
   <button className="button small" disabled={i===0} onClick={()=>setEntries(old=>old.flatMap((v,n)=>n===i?[]:n===i-1?[v+' '+old[i]]:[v]))}>{t('preview.merge')}</button>
   <button className="button small" disabled={!entry.includes('\n')} onClick={()=>setEntries(old=>old.flatMap((v,n)=>n===i?v.split(/\n+/).filter(v=>v.trim()):[v]))}>{t('preview.split')}</button>
   <button className="button small" onClick={()=>setEntries(old=>old.filter((_,n)=>n!==i))}>{t('preview.exclude')}</button>
  </div>)}
  <button className="button primary" disabled={!nonempty.length} onClick={()=>onConfirm({...extraction,entries:nonempty})}>{t('preview.check',{n:nonempty.length})}</button>
  <button className="button" onClick={onCancel}>{t('close')}</button>
 </section>;
}
