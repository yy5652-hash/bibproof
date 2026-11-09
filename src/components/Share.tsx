import { UserEvidenceView } from './UserEvidence';
import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { chosenRecord, stripLabel, type Decisions } from '../core/decisions';
import { encodeShare, safeUrl, toRunFile, type SharedDecision, type SharedEntry, type SharedRun } from '../core/share';
import { download } from '../browser/files';
import { useI18n } from '../i18n';
import type { RowState } from '../useChecker';
import { IconClose, IconCopy, IconDownload, IconRefresh } from './Icons';
import { VerdictBadge } from './Icons';

export function runFrom(rows: RowState[], decisions: Decisions, at: string): SharedRun {
  const entries: SharedEntry[] = rows.map(r => {
    const res = r.result!; const d = decisions[r.id];
    const rec = res ? chosenRecord(res, d) ?? res.match : undefined;
    return { raw: r.raw, verdict: res?.verdict ?? 'Not checked', title: rec?.title, doi: rec?.doi, url: safeUrl(rec?.url), ...(d ? { decision: d.kind as SharedDecision } : {}), ...(res?.userEvidence ? {userEvidence:res.userEvidence} : {}) };
  });
  return { date: at, entries };
}

export function ShareDialog({ open, onOpenChange, run }: { open: boolean; onOpenChange: (o: boolean) => void; run: SharedRun }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false); const [error, setError] = useState('');
  const encoded = useMemo(() => (open ? encodeShare(run) : null), [open, run]);
  const link = encoded?.ok ? `${location.origin}${location.pathname}${encoded.fragment}` : '';
  async function copy() { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError(t('share.copyFail')); } }
  return (
    <Dialog.Root open={open} onOpenChange={o => { onOpenChange(o); if (!o) { setCopied(false); setError(''); } }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog" aria-describedby="share-desc" data-testid="share-dialog">
          <header className="dialog-head"><Dialog.Title>{encoded && !encoded.ok ? t('share.tooLong') : t('share.title')}</Dialog.Title><Dialog.Close className="icon-button" aria-label={t('close')}><IconClose /></Dialog.Close></header>
          <div className="dialog-body">
            {encoded?.ok ? <>
              <Dialog.Description id="share-desc" className="warn-line">{t('share.warn')}</Dialog.Description>
              <label className="sr-only" htmlFor="share-link">{t('share.link')}</label>
              <input id="share-link" className="link-field" readOnly value={link} onFocus={e => e.currentTarget.select()} />
              <div className="bib-actions"><button className="button primary" onClick={copy}><IconCopy />{copied ? t('share.copied') : t('share.copy')}</button></div>
              {error && <p role="alert" className="error">{error}</p>}
            </> : <>
              <Dialog.Description id="share-desc" className="warn-line">{t('share.tooLongBody')}</Dialog.Description>
              <div className="bib-actions"><button className="button primary" onClick={() => download('report.bibproof.json', toRunFile(run), 'application/json')}><IconDownload />{t('share.download')}</button></div>
            </>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A report from a link or an imported file. Everything is plain text; links are limited to http and https. */
export function SharedReport({ run, onRecheck }: { run: SharedRun | undefined; onRecheck: (entries: string[]) => void }) {
  const { t, date } = useI18n();
  if (!run) return <section className="page-narrow"><h1>{t('shared.title')}</h1><p role="alert" className="error">{t('shared.invalid')}</p><p><a className="button" href="#/">{t('shared.home')}</a></p></section>;
  return (
    <section className="page-narrow shared" aria-labelledby="shared-h">
      <h1 id="shared-h">{t('shared.title')}</h1>
      <p className="notice" role="note" data-testid="shared-banner">{t('shared.banner', { date: date(run.date) })}</p>
      <p className="muted">{t('shared.readonly')}</p>
      <p>{t('sum.partial', { done: run.entries.filter(e => e.verdict !== 'Not checked').length, left: run.entries.filter(e => e.verdict === 'Not checked').length })}</p>
      <div className="bib-actions"><button className="button primary" onClick={() => onRecheck(run.entries.map(e => e.raw))}><IconRefresh />{t('shared.recheck')}</button></div>
      <ol className="shared-list">
        {run.entries.map((e, i) => (
          <li key={i} data-verdict={e.verdict}>
            <div className="row-top"><span className="row-n">{i + 1}</span>{e.verdict === 'Not checked' ? <span>{t('state.skipped')}</span> : <VerdictBadge verdict={e.verdict} />}{e.decision && <span className="tag">{t(`dec.tag.${e.decision}` as 'dec.tag.keep')}</span>}</div>
            <p className="row-raw">{stripLabel(e.raw)}</p>
            {e.userEvidence && <UserEvidenceView evidence={e.userEvidence} />}
            {(e.title || e.doi || e.url) && <p className="shared-record"><span className="eyebrow">{t('shared.record')}</span>{e.title}{e.doi ? <small> · doi:{e.doi}</small> : null}{e.url ? <> <a href={e.url} target="_blank" rel="noopener noreferrer">{new URL(e.url).host} ↗</a></> : null}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
