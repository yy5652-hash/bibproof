import { useMemo } from 'react';
import { crossCheck } from '../core/crosscheck';
import type { Extraction } from '../core/extract';
import { useI18n } from '../i18n';

/** The in-text cross-check, kept as a collapsible summary so the workspace keeps the screen. */
export default function CrossPanel({ extraction }: { extraction: Extraction }) {
  const { t } = useI18n();
  const cross = useMemo(() => crossCheck(extraction.body, extraction.entries), [extraction]);
  const none = cross.style === 'Not detected';
  const clean = !none && !cross.missing.length && !cross.uncited.length;
  const style = t(`cross.style.${cross.style}` as 'cross.style.Numeric');
  return (
    <details className="panel cross" open={cross.missing.length > 0}>
      <summary>
        <h3 id="cross-h">{t('cross.title')}</h3>
        <span className="pill">{none ? t('cross.none') : t('cross.style', { style })}</span>
        {!none && !clean && <span className="pill warn">{cross.missing.length + cross.uncited.length}</span>}
      </summary>
      {clean && <p className="ok-line">{t('cross.ok')}</p>}
      {!none && !clean && (
        <div className="cross-grid">
          <div>
            <h4>{t('cross.missing')} <span className="count">{cross.missing.length}</span></h4>
            {cross.missing.length ? <ul className="chips" data-testid="cross-missing">{cross.missing.map(m => <li key={m}>{m}</li>)}</ul> : <p className="muted">{t('cross.noneLine')}</p>}
          </div>
          <div>
            <h4>{t('cross.uncited')} <span className="count">{cross.uncited.length}</span></h4>
            {cross.uncited.length ? <ul className="uncited" data-testid="cross-uncited">{cross.uncited.map(n => <li key={n}><span className="row-n">{n}</span><span translate="no">{extraction.entries[n - 1]}</span></li>)}</ul> : <p className="muted">{t('cross.noneLine')}</p>}
          </div>
        </div>
      )}
      <p className="fine-print">{none ? t('cross.note.none') : t('cross.note.heuristic')}</p>
    </details>
  );
}
