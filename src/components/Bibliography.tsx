import { userEvidenceText } from '../core/userEvidence';
import { UserEvidenceView } from './UserEvidence';
import type { Citing } from '../core/citing';
import { editsNeeded, type ManuscriptEdit, type SentenceChoice } from '../core/repairs';
import { RepairSentences } from './Repairs';
import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { numberMapText, changeLogText, planBibliography, recordsWithKeys, stripLabel, type Decisions } from '../core/decisions';
import { annotateStructuredExport, exportWorks, formatWork, type CitationStyle } from '../core/format';
import { download } from '../browser/files';
import { useI18n } from '../i18n';
import type { RowState } from '../useChecker';
import { STYLES, ensureStyle } from './Evidence';
import { IconClose, IconCopy, IconDownload } from './Icons';

/** The clean bibliography in the chosen style, built from the person's decisions, with a change log. */
export default function Bibliography({ open, onOpenChange, rows, decisions, style, onStyle, onVerifiedAll, edits, citing, onReview }: {
  edits: ManuscriptEdit[]; citing: Citing | null; onReview: (key: string, choice: SentenceChoice) => void;
  open: boolean; onOpenChange: (open: boolean) => void; rows: RowState[]; decisions: Decisions; style: CitationStyle; onStyle: (s: CitationStyle) => void; onVerifiedAll: () => void;
}) {
  const { t } = useI18n();
  const userNotes = userEvidenceText(rows, t('user.badge'));
  const ambiguous=citing?.ambiguous?.filter(a=>a.chosen===undefined)??[];
  const manuscript = t('repair.title') + '\n' + edits.map(e => `#${e.id + 1} ${e.sentence}\n  ${t(`repair.${e.choice}`)}${e.labelChange ? ` · ${e.labelChange} · ${t(e.labelDone ? 'repair.labelDone' : 'repair.labelPending')}` : ''}${e.renumber ? ` · [${e.old}] → ${e.next === null ? t('dec.tag.remove') : `[${e.next}]`}` : ''}`).join('\n\n') + '\n' + ambiguous.map(a=>`${t('cite.ambiguous')}: ${a.citation} — ${a.sentence}`).join('\n') + '\n' + (!citing ? t('repair.noDocument') : t('repair.manual'));
  const mapText = citing?.style==='numeric' || citing?.style==='mixed' ? numberMapText(rows, decisions).replace('Numeric labels (old → new)', t('repair.map')).replaceAll('removed', t('dec.tag.remove')) : edits.flatMap(e=>e.labelChange ? [e.labelChange] : []).filter((v,i,a)=>a.indexOf(v)===i).join('\n');

  const { items, log } = useMemo(() => planBibliography(rows.map(r => ({ id: r.id, raw: r.raw, result: r.result })), decisions), [rows, decisions]);
  const [formatted, setFormatted] = useState<Map<number, string>>(new Map());
  const [error, setError] = useState(''); const [copied, setCopied] = useState<'bibliography'|'notes'|null>(null);
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
  const exportNotes = mapText + '\n\n' + manuscript + '\n\n' + userNotes;
  const exportText = text + '\n\n' + exportNotes + '\n';
  const records = recordsWithKeys(items);
  const verifiedLeft = rows.some(r => r.result?.verdict === 'Verified' && !decisions[r.id]);
  async function copy(value:string,kind:'bibliography'|'notes') { try { await navigator.clipboard.writeText(value); setCopied(kind); setTimeout(() => setCopied(null), 2000); } catch { setError(t('ev.clipboard')); } }
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
              <p>{t('repair.summary', { reviewed: Object.keys(decisions).length, edits: editsNeeded(edits)+ambiguous.length, unchecked: rows.filter(r => !r.result).length })}</p>
              <p className="warn-line">{t('bib.unresolved', { n: log.filter(l => l.kind === 'unresolved').length + rows.filter(r => !r.result).length })}</p>
              {kept.length ? <ol className="bib-list" data-testid="bib-list">{kept.map((i, n) => <li key={i.id}>
                <span className="bib-text" translate="no">{lines[n]}</span>
                <small className={i.action === 'record' ? (i.candidate ? 'tag cand' : 'tag rec') : 'tag'}>{i.action === 'record' ? (i.candidate ? t('bib.candidate') : t('dec.tag.record')) : t('bib.original')}</small>
              </li>)}</ol> : <p className="muted">{t('bib.empty')}</p>}
              <h3>{t('repair.title')}</h3>
              {ambiguous.length>0 && <p>{t('cite.pickNote')}</p>}
              {citing ? <RepairSentences edits={edits} onReview={onReview} /> : <p>{t('repair.noDocument')}</p>}
              <button className="button small" onClick={() => download('bibproof-manuscript-edits.txt', manuscript + '\n\n' + mapText + '\n\n' + userNotes, 'text/plain;charset=utf-8')}>{t('repair.download')}</button>
              <pre className="number-map">{mapText}</pre>
              <div className="bib-actions">
                <button className="button primary small" onClick={()=>copy(text,'bibliography')} disabled={!kept.length}><IconCopy />{copied==='bibliography' ? t('bib.copied') : t('bib.copyBibliography')}</button>
                <button className="button small" onClick={()=>copy(exportNotes,'notes')}>{copied==='notes'?t('bib.copied'):t('bib.copyNotes')}</button>
                <button className="button small" onClick={() => download('bibproof-bibliography.txt', exportText, 'text/plain;charset=utf-8')} disabled={!kept.length}><IconDownload />{t('bib.txt')}</button>
                <button className="button small" onClick={async () => download('bibproof-bibliography.bib', annotateStructuredExport(await exportWorks(records, 'bibtex'), 'bibtex', exportNotes, t('bib.reviewNotes')), 'application/x-bibtex')} disabled={!records.length}><IconDownload />{t('bib.downloadRecords', { n: records.length, omitted: rows.length - records.length })} (.bib)</button>
                <button className="button small" onClick={async () => download('bibproof-bibliography.ris', annotateStructuredExport(await exportWorks(records, 'ris'), 'ris', exportNotes, t('bib.reviewNotes')), 'application/x-research-info-systems')} disabled={!records.length}><IconDownload />{t('bib.downloadRecords', { n: records.length, omitted: rows.length - records.length })} (.ris)</button>
              </div>
              <p className="fine-print">{t('bib.note')}</p>
              {error && <p role="alert" className="error">{error}</p>}
            </section>
            <section aria-labelledby="log-h" className="change-log" data-testid="change-log">
              {rows.filter(r=>r.result?.userEvidence).map(r=><div key={r.id}><span>#{r.id+1}</span><UserEvidenceView evidence={r.result!.userEvidence!} /></div>)}
              <div className="section-line"><h3 id="log-h">{t('bib.log')}</h3><button className="button small ghost" onClick={() => download('bibproof-change-log.txt', changeLogText(log) + '\n' + mapText + '\n\n' + manuscript + '\n\n' + userNotes, 'text/plain;charset=utf-8')} disabled={!rows.length}>{t('bib.logDl')}</button></div>
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
