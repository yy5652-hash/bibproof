import { useMemo, useState } from 'react';
import { VERDICTS, type CheckResult, type Verdict } from '../core/types';
import type { Extraction } from '../core/extract';
import { crossCheck } from '../core/crosscheck';
import type { CitationStyle } from '../core/format';
import type { Phase, RowState } from '../useChecker';
import { Evidence } from './Evidence';
import { IconChevron, IconDownload, IconPrint, IconSpinner, IconStop, VerdictBadge, verdictMeta } from './Icons';
import { downloadBib, downloadCsv, downloadRis, correctable } from '../exports';

const STYLES: { id: CitationStyle; label: string }[] = [
  { id: 'apa', label: 'APA 7' }, { id: 'mla', label: 'MLA 9' }, { id: 'chicago', label: 'Chicago' }, { id: 'ieee', label: 'IEEE' },
];

function rowNote(r: CheckResult): string {
  const rec = r.verdict === 'Identifier conflict' ? r.identifierRecord : r.match ?? r.nearest;
  const who = rec?.authors[0]?.family ? `${rec.authors[0].family}${rec.authors.length > 1 ? ' et al.' : ''}` : '';
  const cite = rec ? [rec.title, [who, rec.year].filter(Boolean).join(', ')].filter(Boolean).join(' · ') : '';
  switch (r.verdict) {
    case 'Verified': return cite ? `Matched record: ${cite}` : r.explanation;
    case 'Details differ': return cite ? `Closest record: ${cite}` : r.explanation;
    case 'Identifier conflict': return cite ? `Identifier resolves to: ${cite}` : r.explanation;
    case 'Retracted': return cite ? `Matched record: ${cite}` : r.explanation;
    case 'No record found': return r.explanation;
    default: return r.explanation;
  }
}

function CrossPanel({ extraction }: { extraction: Extraction }) {
  const cross = useMemo(() => crossCheck(extraction.body, extraction.entries), [extraction]);
  const clean = cross.style !== 'Not detected' && !cross.missing.length && !cross.uncited.length;
  return (
    <section className="panel cross" aria-labelledby="cross-h">
      <div className="section-line"><h3 id="cross-h">In-text citations</h3><span className="pill">{cross.style === 'Not detected' ? 'No in-text citations detected' : `${cross.style} style`}</span></div>
      {clean && <p className="ok-line">Every in-text citation has a reference entry, and every entry is cited.</p>}
      {cross.style !== 'Not detected' && !clean && (
        <div className="cross-grid">
          <div>
            <h4>Cited, but no reference entry <span className="count">{cross.missing.length}</span></h4>
            {cross.missing.length ? <ul className="chips" data-testid="cross-missing">{cross.missing.map(m => <li key={m}>{m}</li>)}</ul> : <p className="muted">None.</p>}
          </div>
          <div>
            <h4>Listed, but never cited <span className="count">{cross.uncited.length}</span></h4>
            {cross.uncited.length ? <ul className="uncited" data-testid="cross-uncited">{cross.uncited.map(n => <li key={n}><span className="row-n">{n}</span><span>{extraction.entries[n - 1]}</span></li>)}</ul> : <p className="muted">None.</p>}
          </div>
        </div>
      )}
      <p className="fine-print">{cross.note}</p>
    </section>
  );
}

export default function Results({ rows, phase, extraction, onCancel }: { rows: RowState[]; phase: Phase; extraction: Extraction | null; onCancel: () => void }) {
  const [filter, setFilter] = useState<Verdict | 'all'>('all');
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [style, setStyle] = useState<CitationStyle>('apa');
  const [busy, setBusy] = useState('');
  const done = rows.filter(r => r.state === 'done');
  const results = done.map(r => r.result!);
  const counts = useMemo(() => {
    const c = Object.fromEntries(VERDICTS.map(v => [v, 0])) as Record<Verdict, number>;
    for (const r of results) c[r.verdict]++;
    return c;
  }, [results]);
  const skipped = rows.filter(r => r.state === 'skipped').length;
  const pending = rows.length - done.length - skipped;
  const visible = rows.filter(r => filter === 'all' || (r.state === 'done' && r.result!.verdict === filter));
  const toggle = (id: number) => setOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const finished = phase === 'done' || phase === 'cancelled';
  const fixable = correctable(results).length;
  const allOpen = done.length > 0 && done.every(r => open.has(r.id));
  async function exportAs(kind: 'bib' | 'ris' | 'csv') {
    setBusy(kind);
    try { if (kind === 'bib') await downloadBib(results); else if (kind === 'ris') await downloadRis(results); else downloadCsv(results); }
    finally { setBusy(''); }
  }
  if (!rows.length) return null;
  const attention = results.length - counts.Verified;
  return (
    <section className="results no-print" aria-labelledby="results-h" id="results">
      <div className="results-head">
        <h2 id="results-h">Results</h2>
        <p className="live" role="status" aria-live="polite">
          {phase === 'running' ? `Checking ${done.length + 1 > rows.length ? rows.length : done.length + 1} of ${rows.length}…` : phase === 'cancelled' ? `Stopped. ${done.length} of ${rows.length} checked.` : `${rows.length} reference${rows.length === 1 ? '' : 's'} checked. ${attention ? `${attention} need${attention === 1 ? 's' : ''} a look.` : 'All verified.'}`}
        </p>
        {phase === 'running' && <button className="button ghost small" onClick={onCancel}><IconStop />Cancel</button>}
      </div>

      <div className="meter" role="img" aria-label={`${done.length} of ${rows.length} checked: ${VERDICTS.filter(v => counts[v]).map(v => `${counts[v]} ${v}`).join(', ')}`}>
        {VERDICTS.map(v => counts[v] ? <span key={v} className={`seg v-${verdictMeta[v].slug}`} style={{ flexGrow: counts[v] }} /> : null)}
        {pending > 0 && <span className="seg pending" style={{ flexGrow: pending }} />}
        {skipped > 0 && <span className="seg skipped" style={{ flexGrow: skipped }} />}
      </div>

      <div className="filters" role="group" aria-label="Filter by verdict">
        <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All <span className="count">{rows.length}</span></button>
        {VERDICTS.map(v => {
          const { Icon, slug } = verdictMeta[v];
          return <button key={v} className={`chip v-${slug}`} aria-pressed={filter === v} disabled={!counts[v]} onClick={() => setFilter(filter === v ? 'all' : v)}><Icon />{v} <span className="count">{counts[v]}</span></button>;
        })}
      </div>

      <div className="toolbar">
        <label className="select-label">Correction style
          <select value={style} onChange={e => setStyle(e.target.value as CitationStyle)}>{STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        </label>
        <button className="button ghost small" onClick={() => setOpen(allOpen ? new Set() : new Set(done.map(r => r.id)))} disabled={!done.length}>{allOpen ? 'Collapse all' : 'Expand all'}</button>
        <span className="spacer" />
        <div className="exports" role="group" aria-label="Export">
          <button className="button small" onClick={() => exportAs('bib')} disabled={!finished || !fixable || busy === 'bib'} title={fixable ? 'Matched records for Verified and Details differ entries' : 'No matched records to export'}><IconDownload />Corrected .bib</button>
          <button className="button small" onClick={() => exportAs('ris')} disabled={!finished || !fixable || busy === 'ris'}><IconDownload />Corrected .ris</button>
          <button className="button small" onClick={() => exportAs('csv')} disabled={!finished || !done.length}><IconDownload />CSV report</button>
          <button className="button small" onClick={() => window.print()} disabled={!finished || !done.length}><IconPrint />PDF report</button>
        </div>
      </div>

      {extraction?.fullDocument
        ? <CrossPanel extraction={extraction} />
        : extraction && <p className="muted note-line">Treated as a reference list. The in-text cross-check needs a full document with a References heading.</p>}

      <ol className="rows">
        {visible.map(row => {
          const r = row.result;
          const isOpen = open.has(row.id) && !!r;
          return (
            <li key={row.id} className={`row ${r ? `v-${verdictMeta[r.verdict].slug}` : `is-${row.state}`}`} data-verdict={r?.verdict ?? row.state}>
              <button className="row-head" aria-expanded={isOpen} aria-controls={`ev-${row.id}`} disabled={!r} onClick={() => toggle(row.id)}>
                <span className="row-n">{row.id + 1}</span>
                <span className="row-main">
                  <span className="row-top">
                    {r ? <VerdictBadge verdict={r.verdict} />
                      : row.state === 'skipped' ? <span className="badge v-skipped">Not checked</span>
                      : row.state === 'running' ? <span className="badge v-pending"><IconSpinner />Checking</span>
                      : <span className="badge v-pending">Waiting</span>}
                  </span>
                  <span className="row-raw">{row.raw.replace(/^\s*(?:\[\d+\]|\d+[.)])\s*/, '')}</span>
                  {r && <span className="row-note">{rowNote(r)}</span>}
                </span>
                {r && <span className="row-toggle">{isOpen ? 'Hide evidence' : 'Evidence'}<IconChevron className="chev" /></span>}
              </button>
              {isOpen && <div id={`ev-${row.id}`} className="row-evidence"><Evidence result={r!} style={style} /></div>}
            </li>
          );
        })}
        {!visible.length && <li className="empty">No references with this verdict.</li>}
      </ol>
    </section>
  );
}
