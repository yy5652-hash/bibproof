import { useEffect, useRef, useState } from 'react';
import { history, type StoredRun } from '../browser/history';
import { needsAction } from '../core/decisions';
import { parseRunFile } from '../core/share';
import { useI18n } from '../i18n';
import type { Session } from '../useSession';
import { IconTrash, IconUpload } from './Icons';

export default function History({ s, onOpen }: { s: Session; onOpen: () => void }) {
  const { t, date } = useI18n();
  const [runs, setRuns] = useState<StoredRun[] | null>(null);
  const [confirm, setConfirm] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const refresh = () => history.list().then(setRuns);
  useEffect(() => { void refresh(); }, [s.historyVersion]);

  async function importFile(file: File | undefined) {
    if (!file) return; setError('');
    const run = file.size < 5_000_000 ? parseRunFile(await file.text()) : undefined;
    if (picker.current) picker.current.value = '';
    if (!run) { setError(t('hist.importFail')); return; }
    s.setImported(run); location.hash = '#/report';
  }
  return (
    <section className="page-narrow" aria-labelledby="hist-h">
      <h1 id="hist-h">{t('hist.title')}</h1>
      <p className="privacy-note" data-testid="history-privacy">{t('hist.private')}</p>
      {history.blocked && <p className="notice" role="note">{t('hist.blocked')}</p>}
      <div className="bib-actions">
        <button className="button" onClick={() => picker.current?.click()}><IconUpload />{t('hist.import')}</button>
        <input ref={picker} type="file" accept=".json,.bibproof.json,application/json" hidden aria-label={t('hist.import')} onChange={e => void importFile(e.target.files?.[0])} />
        {runs?.length ? (confirm
          ? <><button className="button danger" onClick={async () => { await history.clear(); setConfirm(false); setMessage(t('hist.cleared')); void refresh(); }}>{t('hist.confirm')}</button><button className="button ghost" onClick={() => setConfirm(false)}>{t('hist.cancel')}</button></>
          : <button className="button ghost" onClick={() => setConfirm(true)}><IconTrash />{t('hist.clear')}</button>) : null}
      </div>
      <div aria-live="polite">{error && <p role="alert" className="error">{error}</p>}{message && <p className="muted">{message}</p>}</div>
      {runs === null ? <p className="muted">{t('loading')}</p> : runs.length === 0 ? <p className="empty-state">{t('hist.empty')}</p> : (
        <ul className="history-list" data-testid="history-list">
          {runs.map(r => {
            const flagged = r.results.filter(x => x && needsAction(x)).length;
            return (
              <li key={r.id}>
                <div className="history-main">
                  <strong>{t('hist.when', { date: date(r.at) })}</strong>
                  <span className="muted">{t('hist.run', { n: r.entries.length, action: flagged })}</span>
                  <span className="history-first">{r.entries[0]?.replace(/^\s*(?:\[\d+\]\s*|\d+[.)]\s+)/, '')}</span>
                </div>
                <div className="history-actions">
                  <button className="button small primary" onClick={() => { s.reopen(r); onOpen(); }}>{t('hist.open')}</button>
                  <button className="button small ghost" aria-label={`${t('hist.delete')}: ${t('hist.when', { date: date(r.at) })}`} onClick={async () => { await history.remove(r.id); setMessage(t('hist.deleted')); void refresh(); }}><IconTrash />{t('hist.delete')}</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
