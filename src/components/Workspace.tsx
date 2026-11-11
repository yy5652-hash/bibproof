import { retryable } from '../core/retry';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { VERDICTS, type Verdict } from '../core/types';
import { SEVERITY, needsAction, primaryRecord, completionSummary } from '../core/decisions';
import { manuscriptEdits, editsNeeded } from '../core/repairs';
import { csvReport, type CitationStyle } from '../core/format';
import { download } from '../browser/files';
import { useI18n } from '../i18n';
import { useMediaQuery } from '../useMediaQuery';
import type { Session } from '../useSession';
import type { RowState } from '../useChecker';
import { Detail } from './Evidence';
import { PageList, PaneList } from './RefList';
import CrossPanel from './CrossPanel';
import Bibliography from './Bibliography';
import { ShareDialog, runFrom } from './Share';
import { IconBack, IconBook, IconClose, IconDownload, IconKeyboard, IconPrint, IconShare, IconStop, verdictMeta } from './Icons';

const severityIndex = (r: RowState) => (r.result ? SEVERITY.indexOf(r.result.verdict) : SEVERITY.length);

export default function Workspace({ s }: { s: Session }) {
  const { t, date } = useI18n();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const { rows, phase, extraction, decisions } = s;
  const [filter, setFilter] = useState<Verdict | 'all'>('all');
  const [sort, setSort] = useState<'severity' | 'document'>('severity');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [help, setHelp] = useState(false); const [bib, setBib] = useState(false); const [share, setShare] = useState(false);
  const [style, setStyle] = useState<CitationStyle>('apa');
  const [flash, setFlash] = useState('');
  const scrollTo = useRef<((index: number) => void) | null>(null);

  const done = useMemo(() => rows.filter(r => r.state === 'done'), [rows]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(VERDICTS.map(v => [v, 0])) as Record<Verdict, number>;
    for (const r of done) c[r.result!.verdict]++;
    return c;
  }, [done]);
  const attention = done.length - counts.Verified;
  const skipped = rows.filter(r => r.state === 'skipped').length;
  const pending = rows.length - done.length - skipped;
  const finished = phase === 'done' || phase === 'cancelled';

  // Most serious first. Rows still waiting stay at the end, in document order, so nothing jumps around while checking.
  const ordered = useMemo(() => {
    const list = rows.filter(r => filter === 'all' || (r.state === 'done' && r.result!.verdict === filter));
    return sort === 'document' ? list : [...list].sort((a, b) => severityIndex(a) - severityIndex(b) || a.id - b.id);
  }, [rows, filter, sort]);
  const citing = s.citing;
  const edits = useMemo(() => manuscriptEdits(rows, decisions, citing, s.reviews), [rows, decisions, citing, s.reviews]);
  const selected = selectedId !== null ? rows[selectedId] : undefined;
  const unresolved = useMemo(() => done.filter(r => needsAction(r.result!) && !decisions[r.id]), [done, decisions]);

  // On a wide screen the evidence pane is never empty, and it opens on the most serious row until the reader picks one.
  const picked = useRef(false);
  useEffect(() => {
    if (!desktop || picked.current) return;
    const first = ordered.find(r => r.result);
    if (first && (selectedId === null || phase !== 'running') && first.id !== selectedId) setSelectedId(first.id);
  }, [selectedId, desktop, ordered, phase]);
  useEffect(() => { if (!rows.length) { picked.current = false; setSelectedId(null); setSheet(false); setFilter('all'); } }, [rows.length]);

  const select = useCallback((id: number) => { picked.current = true; setSelectedId(id); if (!desktop) setSheet(true); }, [desktop]);
  const move = useCallback((delta: 1 | -1) => {
    picked.current = true;
    const here = ordered.findIndex(r => r.id === selectedId);
    for (let i = here + delta; i >= 0 && i < ordered.length; i += delta) {
      if (ordered[i].result) { setSelectedId(ordered[i].id); scrollTo.current?.(i); requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>(`.list-pane [data-id="${ordered[i].id}"] .row-btn`)?.focus()); return; }
    }
  }, [ordered, selectedId]);
  const nextUnresolved = useCallback(() => {
    if (!unresolved.length) return;
    picked.current = true;
    const ids = new Set(unresolved.map(r => r.id));
    const here = ordered.findIndex(r => r.id === selectedId);
    const order = [...ordered.slice(here + 1), ...ordered.slice(0, here + 1)];
    const hit = order.find(r => ids.has(r.id));
    if (hit) { setSelectedId(hit.id); scrollTo.current?.(ordered.indexOf(hit)); if (!desktop) setSheet(true); }
  }, [unresolved, ordered, selectedId, desktop]);

  const decideSelected = useCallback((kind: 'record' | 'keep' | 'remove') => {
    const row = selectedId !== null ? rows[selectedId] : undefined; const res = row?.result; if (!row || !res) return;
    const now = decisions[row.id];
    if (kind === 'record' && !primaryRecord(res)) { setFlash(res.alternatives?.length ? t('alt.lede') : t('dec.noRecord')); return; }
    setFlash('');
    const same = kind === 'record' ? now?.kind === 'record' && now.alt === undefined : now?.kind === kind;
    s.decide(row.id, same ? undefined : { kind } as never);
  }, [rows, selectedId, decisions, s.decide, t]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return;
      if (e.key === '?') { e.preventDefault(); setHelp(h => !h); return; }
      if (help || bib || share || el?.closest('[role="dialog"]') || !el?.closest('.list-pane, .detail-pane')) return;
      const act: Record<string, () => void> = { arrowdown:()=>move(1), arrowup:()=>move(-1), j: () => move(1), k: () => move(-1), u: () => decideSelected('record'), o: () => decideSelected('keep'), x: () => decideSelected('remove') };
      const fn = act[e.key.toLowerCase()]; if (fn) { e.preventDefault(); fn(); }
    };
    document.addEventListener('keydown', on); return () => document.removeEventListener('keydown', on);
  }, [move, decideSelected, help, bib, share]);

  const results = done.map(r => r.result!);
  const shareRun = useMemo(() => runFrom(rows, decisions, s.meta?.at ?? new Date().toISOString()), [rows, decisions, s.meta, share]);
  const completion = completionSummary(rows);
  const summary = phase !== 'running' && completion.unchecked ? t('sum.partial', { done: completion.checked, left: completion.unchecked }) : !done.length ? t('sum.none') : phase === 'running' ? t('sum.sofar', { n: attention }) : attention ? t('sum.action', { n: attention }) : t('sum.allgood', { n: rows.length });
  const progress = phase === 'running' ? t('bar.running', { done: Math.min(done.length + 1, rows.length), total: rows.length }) : phase === 'cancelled' ? t('bar.stopped', { done: done.length, total: rows.length }) : completion.unchecked ? t('sum.partial', { done: completion.checked, left: completion.unchecked }) : t('prog.done', { n: done.length });
  const detail = selected?.result ? <Detail key={selected.id} index={selected.id} result={selected.result} raw={selected.raw} decision={decisions[selected.id]} onDecide={d => s.decide(selected.id, d)} style={style} onStyle={setStyle} citing={citing} edits={edits.filter(e => e.id === selected.id)} onReview={s.reviewSentence} onRetry={() => void s.retry([selected.id])} retryDisabled={phase === 'running'} onUserEvidence={e => s.saveUserEvidence(selected.id,e)} /> : null;
  const decided = done.filter(r => decisions[r.id]).length;
  const listProps = { items: ordered, selectedId, decisions, onSelect: select, onFocus:(id:number)=>{picked.current=true;setSelectedId(id);}, scrollTo, label: t('list.aria') };

  return (
    <section className="workspace no-print" aria-labelledby="results-h" id="results">
      {s.savedExampleAt && <div className="notice" data-testid="saved-example"><strong>{t('sample.saved', { date: date(s.savedExampleAt) })}</strong><p>{t(extraction?.fullDocument?'paper.intro':'sample.intro')}</p><button className="button small" onClick={s.runLive}>{t('sample.live')}</button></div>}
      <div className="compact-bar">
        <div className="compact-text">
          <h2 id="results-h">{summary}</h2>
          <p className="muted live" role="status" aria-live="polite">{progress}</p>
        </div>
        <div className="compact-actions">
          {rows.some(r => retryable(r.result)) && <button className="button small" onClick={() => void s.retry()} disabled={phase === 'running'}>{t('retry.all')}</button>}
          {phase === 'running' && <button className="button ghost small" onClick={s.cancel}><IconStop />{t('bar.cancel')}</button>}
          <button className="button small" onClick={s.newCheck}><IconBack />{t('bar.new')}</button>
        </div>
      </div>

      <p className="fine-print">{t('results.scope')}</p>
      <div className="meter" role="img" aria-label={`${done.length}/${rows.length}: ${VERDICTS.filter(v => counts[v]).map(v => `${counts[v]} ${t(`v.${v}` as 'v.Verified')}`).join(', ')}`}>
        {VERDICTS.map(v => counts[v] ? <span key={v} className={`mseg v-${verdictMeta[v].slug}`} style={{ flexGrow: counts[v] }} /> : null)}
        {pending > 0 && <span className="mseg pending" style={{ flexGrow: pending }} />}
        {skipped > 0 && <span className="mseg skipped" style={{ flexGrow: skipped }} />}
      </div>

      <div className="control-row">
        <div className="filters" role="group" aria-label={t('filter.group')}>
          <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t('filter.all')} <span className="count">{rows.length}</span></button>
          {SEVERITY.map(v => {
            if (!counts[v]) return null;
            const { Icon, slug } = verdictMeta[v];
            return <button key={v} className={`chip v-${slug}`} data-verdict={v} aria-pressed={filter === v} onClick={() => setFilter(filter === v ? 'all' : v)}><Icon />{t(`v.${v}` as 'v.Verified')} <span className="count">{counts[v]}</span></button>;
          })}
        </div>
        <div className="seg sort" role="group" aria-label={t('sort.label')}>
          <button className="seg-btn" aria-pressed={sort === 'severity'} onClick={() => setSort('severity')}>{t('sort.severity')}</button>
          <button className="seg-btn" aria-pressed={sort === 'document'} onClick={() => setSort('document')}>{t('sort.document')}</button>
        </div>
      </div>

      <div className="fix-row" role="group" aria-label={t('fix.group')}>
        <p className="fix-status" data-testid="fix-status" aria-live="polite">
          <strong>{t('fix.status', { made: decided, open: unresolved.length })}</strong>
          <span>{t('repair.summary', { reviewed: decided, edits: editsNeeded(edits), unchecked: completion.unchecked })}</span>
          <span className="muted">{flash || (finished && done.length && !unresolved.length && attention ? t('fix.allDone') : '')}</span>
        </p>
        <div className="fix-actions">
          <button className="button small" onClick={nextUnresolved} disabled={!unresolved.length}>{t('fix.next')}</button>
          <button className="button small primary" onClick={() => setBib(true)} disabled={!done.length}><IconBook />{t('fix.review')}</button>
          <button className="button small" onClick={() => setShare(true)} disabled={!finished || !done.length}><IconShare />{t('tool.share')}</button>
          <button className="button small" onClick={() => download('bibproof-report.csv', csvReport(results), 'text/csv;charset=utf-8')} disabled={!finished || !done.length}><IconDownload />{t('tool.csv')}</button>
          <button className="button small" onClick={() => window.print()} disabled={!finished || !done.length}><IconPrint />{t('tool.pdf')}</button>
          <button className="icon-button" onClick={() => setHelp(true)} aria-label={t('kb.title')} title={t('kb.title')}><IconKeyboard /></button>
        </div>
      </div>

      {extraction?.fullDocument ? <CrossPanel extraction={extraction} /> : extraction && s.meta && <p className="muted note-line">{t('cross.listOnly')}</p>}

      <div className="panes">
        <div className="list-pane">
          {ordered.length === 0 ? <p className="empty">{t('list.empty')}</p> : desktop ? <PaneList {...listProps} /> : <PageList {...listProps} />}
        </div>
        {desktop && <aside className="detail-pane" aria-label={t('ev.title')}>{detail ?? <p className="empty">{done.length ? t('ev.empty') : t('list.waiting')}</p>}</aside>}
      </div>

      <Dialog.Root open={sheet && !desktop && Boolean(detail)} onOpenChange={setSheet}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="dialog sheet" aria-describedby={undefined}>
            <header className="dialog-head"><Dialog.Title>{t('ev.title')}{selected ? ` · ${selected.id + 1}` : ''}</Dialog.Title><Dialog.Close className="icon-button" aria-label={t('close')}><IconClose /></Dialog.Close></header>
            <div className="dialog-body">{detail}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={help} onOpenChange={setHelp}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="dialog" aria-describedby="kb-note" data-testid="shortcuts">
            <header className="dialog-head"><Dialog.Title>{t('kb.title')}</Dialog.Title><Dialog.Close className="icon-button" aria-label={t('close')}><IconClose /></Dialog.Close></header>
            <div className="dialog-body">
              <dl className="kbd-list">
                {([['j', 'kb.next'], ['k', 'kb.prev'], ['u', 'kb.use'], ['o', 'kb.keep'], ['x', 'kb.remove'], ['?', 'kb.help']] as const).map(([k, label]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{t(label)}</dd></div>)}
              </dl>
              <Dialog.Description id="kb-note" className="muted">{t('kb.note')}</Dialog.Description>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Bibliography open={bib} onOpenChange={setBib} rows={rows} decisions={decisions} edits={edits} citing={citing} onReview={s.reviewSentence} style={style} onStyle={setStyle}
        onVerifiedAll={() => s.decideMany(Object.fromEntries(done.filter(r => r.result!.verdict === 'Verified' && !decisions[r.id] && primaryRecord(r.result!)).map(r => [r.id, { kind: 'record' as const }])))} />
      <ShareDialog open={share} onOpenChange={setShare} run={shareRun} />
    </section>
  );
}
