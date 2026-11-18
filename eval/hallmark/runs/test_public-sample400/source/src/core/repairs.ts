import {referenceId,type Citing} from './citing';
import { parseReference, normalize } from './parse';
import { chosenRecord, numberMap, type Decisions, type PlanRow } from './decisions';
export const SENTENCE_CHOICES = ['unresolved', 'keep', 'revise', 'remove'] as const;
export type SentenceChoice = typeof SENTENCE_CHOICES[number];
export type SentenceReviews = Record<string, SentenceChoice>;
export interface ManuscriptEdit { key: string; referenceId?:string; id: number; sentence: string; choice: SentenceChoice; renumber: boolean; old: string; next: number | null; labelChange?: string; labelDone: boolean }
export function manuscriptEdits(rows: PlanRow[], decisions: Decisions, citing: Citing | null, reviews: SentenceReviews): ManuscriptEdit[] {
  if (!citing) return [];
  const numeric = citing.style === 'numeric' || citing.style === 'mixed';
  return numberMap(rows, decisions).flatMap(m => {
    const d = decisions[m.id];
    if (d?.kind !== 'record' && d?.kind !== 'remove' && !(numeric && m.changed)) return [];
    const row=rows.find(r=>r.id===m.id)!;
    const ref=parseReference(row.raw);
    const work=row.result ? chosenRecord(row.result,d) : undefined;
    const label=(names:string[],year:number|undefined,suffix='')=>`(${names.length>2 ? names[0]+' et al.' : names.join(' & ')}, ${year??'?'}${suffix})`;
    const citation=/([\p{Lu}][\p{L}'’-]+(?:\s+(?:et al\.?|(?:and|&)\s+[\p{Lu}][\p{L}'’-]+))?)[,\s]*\(?((?:19|20)\d{2})([a-z])?\)?/gu;
    const stable=referenceId(row.raw,row.id);
    // An unresolved ambiguity must be assigned before any edit to that sentence.
    const sentences=citing.byReference?.[stable]??citing.byEntry[m.id]??[];
    return sentences.filter(sentence=>!citing.ambiguous?.some(a=>a.sentence===sentence && a.chosen===undefined)).map((sentence, i) => {
      const cited=[...sentence.matchAll(citation)].find(hit=>Number(hit[2])===ref.year && (ref.yearSuffix??'')===(hit[3]??'') && normalize(hit[1].split(/\s+(?:et al|and|&)/)[0])===normalize(ref.surnames[0]??''));
      const previous=cited ? `(${cited[1].replace(/\band\b/g,'&').replace(/et al$/, 'et al.')}, ${cited[2]}${cited[3]??''})` : label(ref.surnames,ref.year,ref.yearSuffix);
      const nextLabel=work ? label(work.authors.map(a=>a.family),work.year,work.year===ref.year?ref.yearSuffix:undefined) : previous;
      // Compare the label the manuscript actually uses, including et al.; changes
      // to unprinted coauthors alone need no label edit.
      const labelChange=cited && work && nextLabel!==previous ? `${previous} → ${nextLabel}` : undefined;
      return { referenceId:stable, key: `${stable}:${i}`, id: m.id, sentence, choice: reviews[`${stable}:${i}`] ?? reviews[`${m.id}:${i}`] ?? 'unresolved', renumber: numeric && m.changed, old: m.old, next: m.next, labelChange, labelDone: (reviews[`${stable}:${i}:label`]??reviews[`${m.id}:${i}:label`])==='keep' };
    });
  });
}
export const editsNeeded = (edits: ManuscriptEdit[]) => edits.filter(e => e.choice !== 'keep' || ((e.renumber || e.labelChange) && !e.labelDone)).length;

/** A decision only invalidates reviews whose source or output label changed. */
export function retainSentenceReviews(rows: PlanRow[], before: Decisions, after: Decisions, reviews: SentenceReviews): SentenceReviews {
  const oldMap = new Map(numberMap(rows,before).map(m=>[m.id,m.next]));
  const changed = new Set(numberMap(rows,after).filter(m => oldMap.get(m.id)!==m.next || JSON.stringify(before[m.id])!==JSON.stringify(after[m.id])).map(m=>m.id));
  const changedKeys=new Set(rows.filter(r=>changed.has(r.id)).flatMap(r=>[String(r.id),referenceId(r.raw,r.id)]));
  return Object.fromEntries(Object.entries(reviews).filter(([key])=>!changedKeys.has(key.split(':')[0])));
}
