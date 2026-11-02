import { useEffect, useState } from 'react';
import { VERDICTS } from '../core/types';
import { useI18n } from '../i18n';
import { verdictMeta } from './Icons';

export function HowItWorks() {
  const { t, verdict, verdictShort } = useI18n();
  const steps = ([1, 2, 3, 4] as const).map(n => [t(`how.${n}.h` as 'how.1.h'), t(`how.${n}.p` as 'how.1.p')] as const);
  return (
    <section className="band" id="how" aria-labelledby="how-h">
      <div className="eyebrow">{t('how.eyebrow')}</div>
      <h2 id="how-h">{t('how.title')}</h2>
      <ol className="how-steps">{steps.map(([h, p], i) => <li key={i}><span className="step-n" aria-hidden="true">{i + 1}</span><h3>{h}</h3><p>{p}</p></li>)}</ol>
      <ul className="legend" aria-label={t('how.title')}>
        {VERDICTS.map(v => { const { Icon, slug } = verdictMeta[v]; return <li key={v} className={`v-${slug}`}><span className="legend-name"><Icon />{verdict(v)}</span><span>{verdictShort(v)}</span></li>; })}
      </ul>
      <p className="muted">{t('how.note')}</p>
    </section>
  );
}

interface Stats { fa: number; n: number; rate: string }
/** The two headline numbers come straight from eval/summary.json; none are typed in here. */
export function Trust() {
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    let live = true;
    import('../../eval/summary.json').then(m => { const x = m.default.metrics; if (live) setStats({ fa: x.falseAccusations, n: x.genuineTotal, rate: `${(x.detectionRate * 100).toFixed(1)}%` }); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return (
    <section className="band trust" id="trust" aria-labelledby="trust-h">
      <div className="eyebrow">{t('trust.eyebrow')}</div>
      <h2 id="trust-h">{t('trust.title')}</h2>
      <div className="trust-grid">
        <div><h3>{t('trust.checked.h')}</h3><p>{t('trust.checked.p')}</p></div>
        <div><h3>{t('trust.not.h')}</h3><p>{t('trust.not.p')}</p></div>
        <div><h3>{t('trust.privacy.h')}</h3><p>{t('trust.privacy.p')}</p></div>
      </div>
      <p className="trust-foot">{stats && <>{t('trust.stats', { fa: stats.fa, n: stats.n, rate: stats.rate })} </>}<a href="#/methodology">{t('trust.method')}</a></p>
    </section>
  );
}

export function Privacy({ onClear }: { onClear: () => Promise<void> }) {
  const { t } = useI18n();
  const [cleared, setCleared] = useState(false);
  return (
    <section className="band" id="privacy" aria-labelledby="privacy-h">
      <div className="eyebrow">{t('privacy.eyebrow')}</div>
      <h2 id="privacy-h">{t('privacy.title')}</h2>
      <p className="statement">{t('privacy.statement')}</p>
      <ul className="plain-list"><li>{t('privacy.1')}</li><li>{t('privacy.2')}</li><li>{t('privacy.3')}</li></ul>
      <button className="button small" onClick={async () => { await onClear(); setCleared(true); }}>{cleared ? t('privacy.cleared') : t('privacy.clear')}</button>
    </section>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="footer no-print">
      <div className="wrap footer-grid">
        <div>
          <strong className="wordmark-sm">Bibproof</strong>
          <p>{t('foot.tag')}</p>
          <p><a href="https://github.com/yy5652-hash/bibproof">{t('foot.src')}</a></p>
        </div>
        <div><h2>{t('foot.libs')}</h2><p>{t('foot.libs.p')}</p></div>
        <div>
          <h2>{t('foot.idx')}</h2>
          <p>{t('foot.idx.p')} <a href="https://www.crossref.org/">Crossref</a> · <a href="https://datacite.org/">DataCite</a> · <a href="https://openalex.org/">OpenAlex</a> · <a href="https://europepmc.org/">Europe PMC</a> · <a href="https://openlibrary.org/">Open Library</a></p>
        </div>
      </div>
    </footer>
  );
}
