import type { CheckResult, Work } from './types';

/** What the person chose for one entry. No decision means the entry stays as written. */
export type Decision = { kind: 'keep' } | { kind: 'record'; alt?: number } | { kind: 'remove' };
export type Decisions = Record<number, Decision>;
export interface PlanRow { id: number; raw: string; result?: CheckResult }
export interface PlanItem { id: number; raw: string; action: 'original' | 'record' | 'removed'; work?: Work; candidate?: boolean }
export interface ChangeLine { id: number; kind: 'replaced' | 'removed' | 'unresolved' | 'kept'; raw: string; work?: Work; candidate?: boolean }

export const stripLabel = (raw: string) => raw.replace(/^\s*(?:\[\d+\]|\d+[.)])\s*/, '').replace(/\s+/g, ' ').trim();

/** The record that "Use record" adopts. Retracted entries get none: a retracted paper is kept or removed, never silently swapped. */
export function primaryRecord(r: CheckResult): Work | undefined {
  return r.verdict === 'Retracted' ? undefined : r.match;
}
export const needsAction = (r: CheckResult) => r.verdict !== 'Verified';
export const canUseRecord = (r: CheckResult) => Boolean(primaryRecord(r)) || Boolean(r.alternatives?.length);
/** A record that only came from the candidate list or from a conflicting entry has not been verified against what the person wrote. */
export const isCandidate = (r: CheckResult, d?: Decision) => d?.kind === 'record' && (d.alt !== undefined || r.verdict === 'Identifier conflict');

export function chosenRecord(r: CheckResult, d?: Decision): Work | undefined {
  if (d?.kind !== 'record') return undefined;
  return d.alt !== undefined ? r.alternatives?.[d.alt] : primaryRecord(r);
}

export function planBibliography(rows: PlanRow[], decisions: Decisions): { items: PlanItem[]; log: ChangeLine[] } {
  const items: PlanItem[] = []; const log: ChangeLine[] = [];
  for (const row of rows) {
    const d = decisions[row.id]; const r = row.result;
    if (d?.kind === 'remove') { items.push({ id: row.id, raw: row.raw, action: 'removed' }); log.push({ id: row.id, kind: 'removed', raw: row.raw }); continue; }
    const work = r ? chosenRecord(r, d) : undefined;
    if (r && work) { const candidate = isCandidate(r, d); items.push({ id: row.id, raw: row.raw, action: 'record', work, candidate }); log.push({ id: row.id, kind: 'replaced', raw: row.raw, work, candidate }); continue; }
    items.push({ id: row.id, raw: row.raw, action: 'original' });
    if (d?.kind === 'keep' && r && needsAction(r)) log.push({ id: row.id, kind: 'kept', raw: row.raw });
    else if (r && needsAction(r)) log.push({ id: row.id, kind: 'unresolved', raw: row.raw });
  }
  return { items, log };
}

/** Unique BibTeX keys for the records that replaced entries. */
export function recordsWithKeys(items: PlanItem[]): Work[] {
  const used = new Map<string, number>();
  return items.flatMap(i => {
    if (i.action !== 'record' || !i.work) return [];
    const family = (i.work.authors[0]?.family ?? 'ref').normalize('NFKD').replace(/[^A-Za-z0-9]/g, '') || 'ref';
    const stem = `${family}${i.work.year ?? ''}`;
    const n = (used.get(stem) ?? 0) + 1; used.set(stem, n);
    return [{ ...i.work, id: n === 1 ? stem : `${stem}${String.fromCharCode(96 + n)}` }];
  });
}

export function changeLogText(log: ChangeLine[], title = 'Bibproof change log'): string {
  const group = (kind: ChangeLine['kind'], head: string) => {
    const lines = log.filter(l => l.kind === kind);
    return lines.length ? [`${head} (${lines.length})`, ...lines.map(l => `  #${l.id + 1} ${stripLabel(l.raw)}${l.work ? `\n     -> ${l.work.title}${l.work.doi ? ` (doi:${l.work.doi})` : ''}${l.candidate ? ' [candidate, read before relying on it]' : ''}` : ''}`), ''] : [];
  };
  return [title, '', ...group('replaced', 'Replaced with a record'), ...group('removed', 'Removed'), ...group('unresolved', 'Unresolved, left as written'), ...group('kept', 'Kept as written on purpose')].join('\n').trimEnd() + '\n';
}
