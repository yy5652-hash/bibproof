import { useEffect, useState } from 'react';
import type { CheckResult, Work } from '../core/types';
import { formatWork, registerStyle, type CitationStyle } from '../core/format';
import { canUseRecord, isCandidate, needsAction, primaryRecord, stripLabel, type Decision } from '../core/decisions';
import { handCheckFor } from '../core/handcheck';
import type { Citing } from '../core/citing';
import { closeWording } from '../core/score';
import { useI18n } from '../i18n';
import { IconCopy, IconSearch, VerdictBadge } from './Icons';

export const STYLES: { id: CitationStyle; label: string }[] = [
  { id: 'apa', label: 'APA 7' }, { id: 'mla', label: 'MLA 9' }, { id: 'chicago', label: 'Chicago' }, { id: 'ieee', label: 'IEEE' }, { id: 'harvard1', label: 'Harvard' },
];
const BUILT_IN = ['apa', 'vancouver', 'harvard1'];
const styleLoads = new Map<string, Promise<void>>();
export async function ensureStyle(style: CitationStyle) {
  if (BUILT_IN.includes(style)) return;
  let task = styleLoads.get(style);
  if (!task) {
    task = fetch(`${import.meta.env.BASE_URL}styles/${style}.csl`).then(r => { if (!r.ok) throw new Error('style'); return r.text(); }).then(xml => registerStyle(style, xml));
    styleLoads.set(style, task); task.catch(() => styleLoads.delete(style));
  }
  await task;
}
/** Only http and https addresses become links; they open in a new tab without handing over the opener. */
export function SourceLink({ url, children }: { url: string; children: React.ReactNode }) {
  return /^https?:\/\//i.test(url) ? <a href={url} target="_blank" rel="noopener noreferrer">{children}<span aria-hidden="true"> ↗</span></a> : <span>{children}</span>;
}
export function authorsLine(work: Work) { return `${work.authors.slice(0, 6).map(a => a.family).join(', ')}${work.authors.length > 6 ? ' et al.' : ''}`; }

function Record({ work, label }: { work: Work; label: string }) {
  const { t } = useI18n();
  return <div className="record"><span className="eyebrow">{label}</span><p><SourceLink url={work.url}>{work.title}</SourceLink></p><small>{authorsLine(work)} · {work.year ?? t('ev.noDoi')} · {work.source}</small></div>;
}

export function DecisionBar({ result, decision, onDecide }: { result: CheckResult; decision?: Decision; onDecide: (d: Decision | undefined) => void }) {
  const { t } = useI18n();
  const usable = Boolean(primaryRecord(result));
  const pressed = (kind: Decision['kind']) => (kind === 'record' ? decision?.kind === 'record' && decision.alt === undefined : decision?.kind === kind);
  const item = (kind: Decision['kind'], label: string, disabled = false) => (
    <button type="button" className="seg-btn" data-decision={kind} aria-pressed={pressed(kind)} disabled={disabled} onClick={() => onDecide(pressed(kind) ? undefined : { kind } as Decision)}>{label}</button>
  );
  const note = decision ? (isCandidate(result, decision) ? t('bib.candidate') : '') : needsAction(result) ? t('dec.none') : t('dec.noneOk');
  return (
    <div className="decision" role="group" aria-label={t('dec.group')}>
      <div className="seg">{item('keep', t('dec.keep'))}{item('record', t('dec.record'), !usable)}{item('remove', t('dec.remove'))}</div>
      <p className="muted decision-note">
        {note}{!usable && !decision && !canUseRecord(result) ? ` ${t('dec.noRecord')}` : ''}
        {decision && <button type="button" className="link-button" onClick={() => onDecide(undefined)}>{t('dec.clear')}</button>}
      </p>
    </div>
  );
}

export function Detail({ index, result, raw, decision, onDecide, style, onStyle, citing }: {
  index: number; result: CheckResult; raw: string; decision?: Decision; onDecide: (d: Decision | undefined) => void; style: CitationStyle; onStyle: (s: CitationStyle) => void; citing: Citing | null;
}) {
  const { t, explain, date } = useI18n();
  const [corrected, setCorrected] = useState(''); const [error, setError] = useState(''); const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true; setCorrected(''); setError(''); setCopied(false);
    if (result.match) void ensureStyle(style).then(() => formatWork(result.match!, style)).then(text => { if (active) setCorrected(text); }).catch(() => { if (active) setError(t('ev.styleFail')); });
    return () => { active = false; };
  }, [result.match, style]);
  async function copy() { try { await navigator.clipboard.writeText(corrected); setCopied(true); } catch { setError(t('ev.clipboard')); } }
  const problem = needsAction(result);
  // The nearest hit is only shown when its wording is close; otherwise it reads like a suggestion it is not.
  const lead = Boolean(result.nearest && closeWording(result.reference, result.nearest));
  const hand = (result.verdict === 'No record found' || result.verdict === 'Could not check') ? handCheckFor(result.reference) : null;
  const sentences = citing?.byEntry[index] ?? [];
  const more = citing ? Math.max(0, (citing.counts[index] ?? 0) - sentences.length) : 0;
  return (
    <div className="evidence" data-testid="evidence">
      <div className="ev-head"><span className="row-n">{index + 1}</span><VerdictBadge verdict={result.verdict} /></div>
      <p className="verdict-explanation">{explain(result.explanation)}</p>
      <blockquote className="as-written"><span className="eyebrow">{t('ev.written')}</span>{stripLabel(raw)}</blockquote>
      <DecisionBar result={result} decision={decision} onDecide={onDecide} />

      {result.identifierRecord && <Record work={result.identifierRecord} label={t('ev.identifier')} />}
      {result.match && <Record work={result.match} label={result.identifierRecord ? t('ev.closest') : t('ev.matched')} />}
      {!result.match && lead && <Record work={result.nearest!} label={t('ev.nearest')} />}
      {result.match?.retractionUrls?.map(url => <p key={url}><SourceLink url={url}>{t('ev.retraction')}</SourceLink></p>)}

      {result.alternatives?.length ? (
        <section className="alts" aria-labelledby="alts-h">
          <h4 id="alts-h">{t('alt.title')}</h4>
          <p className="muted">{t('alt.lede')}</p>
          <ul>{result.alternatives.map((w, i) => {
            const chosen = decision?.kind === 'record' && decision.alt === i;
            return <li key={w.id + i} className={chosen ? 'chosen' : ''}>
              <div><SourceLink url={w.url}>{w.title}</SourceLink><small>{authorsLine(w)} · {w.year ?? t('ev.noDoi')} · {w.source}{w.doi ? ` · ${w.doi}` : ''}</small></div>
              <button type="button" className="button small" aria-pressed={chosen} onClick={() => onDecide(chosen ? undefined : { kind: 'record', alt: i })}>{chosen ? t('alt.using') : t('alt.use')}</button>
            </li>;
          })}</ul>
        </section>
      ) : null}

      {result.score && (result.match || result.identifierRecord || lead) && (
        <div className="field-grid" role="table" aria-label={t('ev.fields')}>
          <div className="field-row field-head" role="row"><span role="columnheader">{t('ev.field')}</span><span role="columnheader">{t('ev.wrote')}</span><span role="columnheader">{t('ev.says')}</span></div>
          {result.score.fields.map(f => <div className={`field-row ${f.status}`} role="row" key={f.field}>
            <strong role="cell">{explain(f.field)}<small>{f.status === 'agree' ? `✓ ${t('ev.agrees')}` : f.status === 'differ' ? `≠ ${t('ev.differs')}` : `– ${t('ev.uncertain')}`}</small></strong>
            <span role="cell">{explain(f.written)}</span><span role="cell">{explain(f.record)}</span>
          </div>)}
        </div>
      )}

      {problem && citing && (
        <section className="citing" aria-labelledby={`cit-${index}`}>
          <h4 id={`cit-${index}`}>{t('cite.title')}</h4>
          {!citing.detected ? <p className="muted">{t('cite.nodoc')}</p>
            : sentences.length ? <><ul>{sentences.map((s, i) => <li key={i}>{s}</li>)}</ul><p className="fine-print">{t('cite.local')}{more ? ` ${t('cite.more', { n: more })}` : ''}</p></>
            : <p className="muted">{t('cite.none')}</p>}
        </section>
      )}

      {hand && hand.links.length > 0 && (
        <section className="handcheck" aria-labelledby={`hc-${index}`}>
          <h4 id={`hc-${index}`}>{t('hc.title')}</h4>
          <p className="muted">{t('hc.lede')}{hand.chinese ? ` ${t('hc.cn')}` : ''}</p>
          <ul className="hand-links">{hand.links.map(l => <li key={l.id}><a href={l.url} target="_blank" rel="noopener noreferrer"><IconSearch />{l.label}<span aria-hidden="true"> ↗</span></a></li>)}</ul>
        </section>
      )}

      <details className="index-log">
        <summary>{t('ev.trail')}</summary>
        {result.evidence.length ? <ul>{result.evidence.map((e, i) => <li key={i}>
          <span className={e.status === 'answered' ? 'index-ok' : 'index-fail'}>{e.status === 'answered' ? '✓' : '!'} {e.index}</span>
          <span>{e.status === 'answered' ? `${t('ev.records', { n: e.count })}${e.cached ? ` · ${t('ev.cached')}` : ''}` : t('ev.unavailable')} · <SourceLink url={e.url}>{t('ev.query')}</SourceLink>{e.detail && <small>{explain(e.detail)}</small>}</span>
        </li>)}</ul>
          : <p>{t('ev.noIndex')} {result.reference.url && <SourceLink url={result.reference.url}>{t('ev.openSource')}</SourceLink>}</p>}
        <p className="fine-print">{t('ev.checked', { date: date(result.checkedAt) })}</p>
      </details>

      {result.match && (
        <div className="correction">
          <div className="section-line">
            <h4>{t('ev.corrected')}</h4>
            <label className="select-label">{t('ev.style')}<select value={style} onChange={e => onStyle(e.target.value as CitationStyle)}>{STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          </div>
          <p className="corrected-text">{corrected || t('ev.formatting')}</p>
          <div className="section-line"><button className="button small" onClick={copy} disabled={!corrected}><IconCopy />{copied ? t('ev.copied') : t('ev.copy')}</button>{result.verdict !== 'Verified' && <small>{t('ev.review')}</small>}</div>
        </div>
      )}
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  );
}
