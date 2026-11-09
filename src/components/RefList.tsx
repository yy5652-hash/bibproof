import { memo, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
import { useVirtualizer, useWindowVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { needsAction, type Decision } from '../core/decisions';
import { useI18n } from '../i18n';
import type { RowState } from '../useChecker';
import { IconSpinner, VerdictBadge, verdictMeta } from './Icons';

const ESTIMATE = 108;

function rowNote(r: NonNullable<RowState['result']>, t: ReturnType<typeof useI18n>['t'], explain: (s: string) => string): string {
  const rec = r.verdict === 'Identifier conflict' ? r.identifierRecord : r.match ?? r.nearest;
  const who = rec?.authors[0]?.family ? `${rec.authors[0].family}${rec.authors.length > 1 ? ' et al.' : ''}` : '';
  const cite = rec ? [rec.title, [who, rec.year].filter(Boolean).join(', ')].filter(Boolean).join(' · ') : '';
  if (!cite) return explain(r.explanation);
  switch (r.verdict) {
    case 'Details differ': return t('note.closest', { cite });
    case 'Identifier conflict': return t('note.identifier', { cite });
    case 'Verified': case 'Retracted': return t('note.matched', { cite });
    default: return explain(r.explanation);
  }
}

const Row = memo(function Row({ row, selected, decision, onSelect, index, count }: { row: RowState; selected: boolean; decision?: Decision; onSelect: (id: number) => void; index: number; count: number }) {
  const { t, explain } = useI18n();
  const r = row.result;
  const tag = decision ? (decision.kind === 'record' ? (decision.alt !== undefined ? t('dec.tag.candidate') : t('dec.tag.record')) : t(`dec.tag.${decision.kind}` as 'dec.tag.keep')) : r && needsAction(r) ? t('dec.unresolved') : '';
  return (
    <div className={`row ${r ? `v-${verdictMeta[r.verdict].slug}` : `is-${row.state}`}${selected ? ' selected' : ''}`} data-testid="row" data-verdict={r?.verdict ?? row.state} data-id={row.id}>
      <button className="row-btn" aria-current={selected ? 'true' : undefined} aria-posinset={index + 1} aria-setsize={count} disabled={!r} onClick={() => onSelect(row.id)}>
        <span className="row-top">
          <span className="row-n">{row.id + 1}</span>
          {r ? <VerdictBadge verdict={r.verdict} />
            : row.state === 'skipped' ? <span className="badge v-skipped">{t('state.skipped')}</span>
            : row.state === 'running' ? <span className="badge v-pending"><IconSpinner />{t('state.running')}</span>
            : <span className="badge v-pending">{t('state.queued')}</span>}
          {r?.userEvidence && <span className="tag">{t('user.badge')}</span>}
          {tag && <span className={`tag${decision ? ' decided' : ' open'}`} data-testid="row-tag">{tag}</span>}
        </span>
        <span className="row-raw" translate="no">{row.raw.replace(/^\s*(?:\[\d+\]\s*|\d+[.)]\s+)/, '')}</span>
        {r && <span className="row-note">{rowNote(r, t, explain)}</span>}
      </button>
    </div>
  );
});

export interface ListProps {
  items: RowState[]; selectedId: number | null; decisions: Record<number, Decision>; onSelect: (id: number) => void;
  scrollTo: MutableRefObject<((index: number) => void) | null>; label: string;
}

function renderItems(v: VirtualItem[], p: ListProps, offset: number, measure: (el: Element | null) => void) {
  return v.map(item => {
    const row = p.items[item.index];
    return <li key={item.key} data-index={item.index} ref={measure} className="vrow" style={{ transform: `translateY(${item.start - offset}px)` }}>
      <Row row={row} selected={row.id === p.selectedId} decision={p.decisions[row.id]} onSelect={p.onSelect} index={item.index} count={p.items.length} />
    </li>;
  });
}

/** Desktop: the list scrolls inside its own pane. */
export function PaneList(p: ListProps) {
  const parent = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({ count: p.items.length, getScrollElement: () => parent.current, estimateSize: () => ESTIMATE, overscan: 8, getItemKey: i => p.items[i]?.id ?? i });
  p.scrollTo.current = i => v.scrollToIndex(i, { align: 'auto' });
  return (
    <div ref={parent} className="list-scroll" data-testid="list-scroll" tabIndex={-1}>
      <ul className="rows" aria-label={p.label} style={{ height: v.getTotalSize() }}>{renderItems(v.getVirtualItems(), p, 0, v.measureElement)}</ul>
    </div>
  );
}

/** Small screens: the page itself scrolls and only the rows near the viewport exist. */
export function PageList(p: ListProps) {
  const ul = useRef<HTMLUListElement>(null);
  const [margin, setMargin] = useState(0);
  useLayoutEffect(() => {
    const measure = () => setMargin((ul.current?.getBoundingClientRect().top ?? 0) + window.scrollY);
    measure();
    const ro = new ResizeObserver(measure); ro.observe(document.body);
    return () => ro.disconnect();
  }, []);
  const v = useWindowVirtualizer({ count: p.items.length, estimateSize: () => ESTIMATE, overscan: 8, scrollMargin: margin, getItemKey: i => p.items[i]?.id ?? i });
  p.scrollTo.current = i => v.scrollToIndex(i, { align: 'auto' });
  return <ul ref={ul} className="rows" aria-label={p.label} data-testid="page-list" style={{ height: v.getTotalSize() }}>{renderItems(v.getVirtualItems(), p, margin, v.measureElement)}</ul>;
}
