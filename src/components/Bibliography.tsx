import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { changeLogText, planBibliography, recordsWithKeys, stripLabel, type Decisions } from '../core/decisions';
import { exportWorks, formatWork, type CitationStyle } from '../core/format';
import { download } from '../browser/files';
import { useI18n } from '../i18n';
import type { RowState } from '../useChecker';
import { STYLES, ensureStyle } from './Evidence';
import { IconClose, IconCopy, IconDownload } from './Icons';

/** The clean bibliography in the chosen style, built from the person's decisions, with a change log. */
export default function Bibliography({ open, onOpenChange, rows, decisions, style, onStyle, onVerifiedAll }: {
  open: boolean; onOpenChange: (open: boolean) => void; rows: RowState[]; decisions: Decisions; style: CitationStyle; onStyle: (s: CitationStyle) => void; onVerifiedAll: () => void;
}) {
  const { t } = useI18n();
  const { items, log } = useMemo(() => planBibliography(rows.map(r => ({ id: r.id, raw: r.raw, result: r.result })), decisions), [rows, decisions]);
  const [formatted, setFormatted] = useState<Map<number, string>>(new Map());
  const [error, setError] = useState(''); const [copied, setCopied] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);
  useEffect(() => {
    if (!open) return;
    let live = true; setError('');
    (async () => {
      await ensureStyle(style);
      const out = new Map<number, string>();
      for (const it of items) if (it.action === 'record' && it.work) out.set(it.id, (await formatWork(it.work, style)).replace(/^\[\d+\]\s*/, ''));
      if (live) setFormatted(out);
    })().catch(() => { if (live) setError(t('bib.error')); });
    return () => { live = false; };
  }, [open, items, style]);

  const kept = items.filter(i => i.action !== 'removed');
  const counts = { record: items.filter(i => i.action === 'record').length, removed: items.filter(i => i.action === 'removed').length, original: items.filter(i => i.action === 'original').length };
  const lines = kept.map(i => (i.action === 'record' ? formatted.get(i.id) ?? t('bib.formatting') : stripLabel(i.raw)));
  const text = lines.map((l, n) => (style === 'ieee' ? `[${n + 1}] ${l}` : l)).join('\n\n');
  const records = recordsWithKeys(items);
  const verifiedLeft = rows.some(r => r.result?.verdict === 'Verified' && !decisions[r.id]);
  async function copy() { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setError(t('ev.clipboard')); } }
  const groups: ['replaced' | 'removed' | 'unresolved' | 'kept', string][] = [['replaced', t('bib.log.replaced')], ['removed', t('bib.log.removed')], ['unresolved', t('bib.log.unresolved')], ['kept', t('bib.log.kept')]];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog dialog-wide" aria-describedby="bib-desc" data-testid="bibliography">
          <header className="dialog-head">
            <Dialog.Title>{t('bib.title')}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label={t('close')}><IconClose /></Dialog.Close>
          </header>
          <Dialog.Description id="bib-desc" className="muted">{t('bib.lede')}</Dialog.Description>
          <div className="dialog-body bib-grid">
            <section aria-label={t('bib.title')}>
              <div className="bib-controls">
                <label className="select-label">{t('bib.style')}<select value={style} onChange={e => onStyle(e.target.value as CitationStyle)}>{STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
                <p className="muted bib-summary" data-testid="bib-summary">{t('bib.summary', counts)}</p>
              </div>
              {verifiedLeft && <p><button className="button small" onClick={() => { onVerifiedAll(); setBulkDone(true); }}>{t('bib.verifiedAll')}</button></p>}
              {bulkDone && !verifiedLeft && <p className="ok-line" role="status">{t('bib.verifiedDone')}</p>}
              {kept.length ? <ol className="bib-list" data-testid="bib-list">{kept.map((i, n) => <li key={i.id}>
                <span className="bib-text" translate="no">{lines[n]}</span>
                <small className={i.action === 'record' ? (i.candidate ? 'tag cand' : 'tag rec') : 'tag'}>{i.action === 'record' ? (i.candidate ? t('bib.candidate') : t('dec.tag.record')) : t('bib.original')}</small>
              </li>)}</ol> : <p className="muted">{t('bib.empty')}</p>}
              <div className="bib-actions">
                <button className="button primary small" onClick={copy} disabled={!kept.length}><IconCopy />{copied ? t('bib.copied') : t('bib.copy')}</button>
                <button className="button small" onClick={() => download('bibproof-bibliography.txt', text + '\n', 'text/plain;charset=utf-8')} disabled={!kept.length}><IconDownload />{t('bib.txt')}</button>
                <button className="button small" onClick={async () => download('bibproof-bibliography.bib', await exportWorks(records, 'bibtex'), 'application/x-bibtex')} disabled={!records.length}><IconDownload />{t('bib.bib')}</button>
                <button className="button small" onClick={async () => download('bibproof-bibliography.ris', await exportWorks(records, 'ris'), 'application/x-research-info-systems')} disabled={!records.length}><IconDownload />{t('bib.ris')}</button>
              </div>
              <p className="fine-print">{t('bib.note')}</p>
              {error && <p role="alert" className="error">{error}</p>}
            </section>
            <section aria-labelledby="log-h" className="change-log" data-testid="change-log">
              <div className="section-line"><h3 id="log-h">{t('bib.log')}</h3><button className="button small ghost" onClick={() => download('bibproof-change-log.txt', changeLogText(log), 'text/plain;charset=utf-8')} disabled={!log.length}>{t('bib.logDl')}</button></div>
              {log.length ? groups.map(([kind, head]) => { const entries = log.filter(l => l.kind === kind); return entries.length ? (
                <div key={kind} className={`log-group log-${kind}`}>
                  <h4>{head} <span className="count">{entries.length}</span></h4>
                  <ul>{entries.map(l => <li key={l.id}><span className="row-n">{l.id + 1}</span><span translate="no">{stripLabel(l.raw)}{l.work && <small>{l.work.title}{l.candidate ? ` · ${t('bib.candidate')}` : ''}</small>}</span></li>)}</ul>
                </div>) : null; }) : <p className="muted">{t('bib.log.empty')}</p>}
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
