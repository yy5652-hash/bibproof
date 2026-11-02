import { VERDICTS, type CheckResult } from '../core/types';
import type { Extraction } from '../core/extract';
import { crossCheck } from '../core/crosscheck';
import { closeWording } from '../core/score';
import { useI18n } from '../i18n';
import type { RowState } from '../useChecker';

/** Rendered only for the printed page: a flat, evidence-first record of the run. */
export default function PrintReport({ rows, extraction }: { rows: RowState[]; extraction: Extraction | null }) {
  const { t, verdict, explain, date } = useI18n();
  const done = rows.filter(r => r.state === 'done');
  if (!done.length) return null;
  const results = done.map(r => r.result!);
  const cross = extraction?.fullDocument ? crossCheck(extraction.body, extraction.entries) : null;
  return (
    <section className="print-only" aria-hidden="true">
      <h1>{t('print.title')}</h1>
      <p>{date(Date.now())} · {t('print.summary', { done: done.length, total: rows.length })} · https://yy5652-hash.github.io/bibproof/</p>
      <p>{VERDICTS.map(v => `${results.filter(r => r.verdict === v).length} ${verdict(v)}`).join(' · ')}</p>
      <ol>
        {done.map(row => { const r: CheckResult = row.result!; const rec = r.verdict === 'Identifier conflict' ? r.identifierRecord : r.match ?? (r.nearest && closeWording(r.reference, r.nearest) ? r.nearest : undefined); return (
          <li key={row.id}>
            <strong>{verdict(r.verdict)}</strong>
            <p translate="no">{row.raw}</p>
            <p>{explain(r.explanation)}</p>
            {rec && <p>{r.match ? t('print.record') : r.verdict === 'Identifier conflict' ? t('print.idPoints') : t('print.nearest')}: {rec.title} ({rec.authors.slice(0, 3).map(a => a.family).join(', ')}{rec.authors.length > 3 ? ' et al.' : ''}, {rec.year ?? 'n.d.'}) · {rec.url}</p>}
            {r.score && <p>{r.score.fields.filter(f => f.status !== 'unknown').map(f => `${explain(f.field)}: ${f.status === 'agree' ? t('print.agrees') : t('print.differs', { w: f.written, r: f.record })}`).join(' · ')}</p>}
          </li>); })}
      </ol>
      {cross && <><h2>{t('print.cross')} ({cross.style})</h2><p>{t('print.crossBody', { missing: cross.missing.join(', ') || t('print.none'), uncited: cross.uncited.join(', ') || t('print.none') })}</p></>}
      <p>{t('print.foot')}</p>
    </section>
  );
}
