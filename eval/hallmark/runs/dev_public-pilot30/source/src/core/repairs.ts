import type { Citing } from './citing';
import { parseReference, normalize } from './parse';
import { chosenRecord, numberMap, type Decisions, type PlanRow } from './decisions';
export const SENTENCE_CHOICES = ['unresolved', 'keep', 'revise', 'remove'] as const;
export type SentenceChoice = typeof SENTENCE_CHOICES[number];
export type SentenceReviews = Record<string, SentenceChoice>;
export interface ManuscriptEdit { key: string; id: number; sentence: string; choice: SentenceChoice; renumber: boolean; old: string; next: number | null; labelChange?: string; labelDone: boolean }
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
    const authorChanged=work && normalize(ref.surnames.join(' '))!==normalize(work.authors.map(a=>a.family).join(' '));
    const changed=work && (authorChanged || work.year!==ref.year);
    const labelChange=!numeric && changed ? `${label(ref.surnames,ref.year,ref.yearSuffix)} → ${label(work.authors.map(a=>a.family),work.year)}` : undefined;
    return (citing.byEntry[m.id] ?? []).map((sentence, i) => ({ key: `${m.id}:${i}`, id: m.id, sentence, choice: reviews[`${m.id}:${i}`] ?? 'unresolved', renumber: numeric && m.changed, old: m.old, next: m.next, labelChange, labelDone: reviews[`${m.id}:${i}:label`]==='keep' }));
  });
}
export const editsNeeded = (edits: ManuscriptEdit[]) => edits.filter(e => e.choice !== 'keep' || ((e.renumber || e.labelChange) && !e.labelDone)).length;

/** A decision only invalidates reviews whose source or output label changed. */
export function retainSentenceReviews(rows: PlanRow[], before: Decisions, after: Decisions, reviews: SentenceReviews): SentenceReviews {
  const oldMap = new Map(numberMap(rows,before).map(m=>[m.id,m.next]));
  const changed = new Set(numberMap(rows,after).filter(m => oldMap.get(m.id)!==m.next || JSON.stringify(before[m.id])!==JSON.stringify(after[m.id])).map(m=>m.id));
  return Object.fromEntries(Object.entries(reviews).filter(([key])=>!changed.has(Number(key.split(':')[0]))));
}
