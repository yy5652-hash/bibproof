import { useMemo } from 'react';
import type { Citing } from '../core/citing';
import { crossCheck } from '../core/crosscheck';
import type { Extraction } from '../core/extract';
import { useI18n } from '../i18n';

/** The in-text cross-check, kept as a collapsible summary so the workspace keeps the screen. */
export default function CrossPanel({ extraction, citing }: { extraction: Extraction; citing?:Citing|null }) {
  const { t } = useI18n();
  const cross = useMemo(() => extraction.cross ?? crossCheck(extraction.body, extraction.entries), [extraction]);
  const ambiguous=citing?.ambiguous?.filter(a=>a.chosen===undefined);
  const unresolvedIds=new Set(ambiguous?.flatMap(a=>a.candidates));
  const current={...cross,ambiguous:ambiguous?.map(a=>a.citation)??cross.ambiguous,uncited:citing?.detected?citing.counts.flatMap((count,id)=>count===0&&!unresolvedIds.has(id)?[id+1]:[]):cross.uncited};
  const none = cross.style === 'Not detected';
  const clean = !none && !cross.missing.length && !current.uncited.length && !current.ambiguous?.length;
  const style = t(`cross.style.${cross.style}` as 'cross.style.Numeric');
  return (
    <details className="panel cross" open={cross.missing.length > 0 || Boolean(current.ambiguous?.length)}>
      <summary>
        <h3 id="cross-h">{t('cross.title')}</h3>
        <span className="pill">{none ? t('cross.none') : t('cross.style', { style })}</span>
        {!none && !clean && <span className="pill warn">{cross.missing.length + current.uncited.length + (current.ambiguous?.length??0)}</span>}
      </summary>
      {Boolean(current.ambiguous?.length) && <p>{t('cite.ambiguous')}: {current.ambiguous?.join('; ')}</p>}
      {clean && <p className="ok-line">{t('cross.ok')}</p>}
      {!none && !clean && (
        <div className="cross-grid">
          <div>
            <h4>{t('cross.missing')} <span className="count">{cross.missing.length}</span></h4>
            {cross.missing.length ? <ul className="chips" data-testid="cross-missing">{cross.missing.map(m => <li key={m}>{m}</li>)}</ul> : <p className="muted">{t('cross.noneLine')}</p>}
          </div>
          <div>
            <h4>{t('cross.uncited')} <span className="count">{current.uncited.length}</span></h4>
            {current.uncited.length ? <ul className="uncited" data-testid="cross-uncited">{current.uncited.map(n => <li key={n}><span className="row-n">{n}</span><span translate="no">{extraction.entries[n - 1]}</span></li>)}</ul> : <p className="muted">{t('cross.noneLine')}</p>}
          </div>
        </div>
      )}
      <p className="fine-print">{none ? t('cross.note.none') : t('cross.note.heuristic')}</p>
    </details>
  );
}
