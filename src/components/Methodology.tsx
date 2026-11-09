import { useEffect, useState } from 'react';
import { VERDICTS } from '../core/types';
import { useI18n } from '../i18n';
import fresh from '../../eval/fresh-results.json';

const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
export default function Methodology() {
  const { t, lang } = useI18n();
  const [report, setReport] = useState<any>(null); const [failed, setFailed] = useState(false);
  useEffect(() => { let active = true; import('../../eval/summary.json').then(r => { if (active) setReport(r.default); }).catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, []);
  const locale = lang === 'zh-CN' ? 'zh-CN' : 'en-GB';
  return (
    <article className="methodology page-narrow">
      <div className="eyebrow">{t('m.eyebrow')}</div>
      <h1>{t('m.title')}</h1>
      <p className="lead">{t('m.lead')}</p>
      <section><h2>{t('m.verdicts')}</h2>
        <div className="definitions">{VERDICTS.map(v => <div key={v}><h3>{t(`v.${v}` as 'v.Verified')}</h3><p>{t(`m.mean.${v}` as 'm.mean.Verified')}</p></div>)}</div>
      </section>
      <section><h2>{t('m.flow')}</h2>
        <ol className="steps">{([1, 2, 3, 4, 5] as const).map(n => <li key={n}><strong>{t(`m.s${n}` as 'm.s1')}</strong> {t(`m.s${n}p` as 'm.s1p')}</li>)}</ol>
      </section>
      <section>
        <div className="section-line"><h2>{t('m.measured')}</h2><span className="eyebrow">{t('m.live')}</span></div>
        {report ? <>
          <p>{t('m.setup', { seed: report.seed, tuning: report.tuningSeed, works: report.sampling.genuineWorks, trials: report.sampling.genuineTrials, fab: report.sampling.fabricatedTrials, date: new Date(report.runAt).toLocaleDateString(locale) })}</p>
          <div className="eval-stats paired-stats">
            <div><strong>{report.metrics.falseAccusations} / {report.metrics.genuineTotal}</strong><span>{t('m.formatTrials', { fa: report.metrics.falseAccusations, total: report.metrics.genuineTotal, works: report.sampling.genuineWorks, styles: report.sampling.styles.length })}</span></div>
            <div><strong>{fresh.falseAccusations} / {fresh.total}</strong><span>{t('m.freshTrials', { fa: fresh.falseAccusations, total: fresh.total })}</span></div>
          </div>
          <p className="fine-print">{t('m.trialExplanation', { total: report.metrics.genuineTotal, works: report.sampling.genuineWorks, styles: report.sampling.styles.length })}</p>
          <p>{t('m.syntheticCount', { n: Object.values(report.metrics.detectionByClass).reduce((n: number, x: any) => n + x.detected, 0), total: report.sampling.fabricatedTrials })}</p>
          <div className="table-wrap"><table><caption>{t('m.matrix')}</caption>
            <thead><tr><th scope="col">{t('m.truth')}</th>{VERDICTS.map(v => <th key={v} scope="col">{t(`v.${v}` as 'v.Verified')}</th>)}</tr></thead>
            <tbody>{Object.entries(report.confusionMatrix).map(([group, counts]: [string, any]) => <tr key={group}><th scope="row">{group}</th>{VERDICTS.map(v => <td key={v}>{counts[v]}</td>)}</tr>)}</tbody>
          </table></div>
          <ul>{Object.entries(report.metrics.detectionByClass).map(([group, m]: [string, any]) => <li key={group}>{t('m.class', { group, detected: m.detected, total: m.total, rate: percent(m.rate), abstained: m.abstained })}</li>)}</ul>
          <p className="fine-print">{t('m.fine')}</p>
          {report.optionalSet?.status === 'completed'
            ? <p><a href="https://gptzero.me/news/neurips/">{t('m.neurips')}</a>, {t('m.neurips.rest', { detected: report.optionalSet.detected, total: report.optionalSet.total, rate: percent(report.optionalSet.detectionRate) })}</p>
            : <p>{t('m.neurips.none', { reason: report.optionalSet?.reason ?? t('m.neurips.na') })}</p>}
          <p>{t('m.fresh', { total: fresh.total, fa: fresh.falseAccusations, accepted: fresh.accepted, abst: fresh.abstentions })}</p>
          {report.realisticGenuine && <p>{t('m.real', { total: report.realisticGenuine.total, fa: report.realisticGenuine.falseAccusations, accepted: report.realisticGenuine.accepted, abst: report.realisticGenuine.abstentions })}</p>}
          <p><a href="https://github.com/yy5652-hash/bibproof" target="_blank" rel="noopener noreferrer">{t('m.github')}</a></p>
        </> : <p>{failed ? t('m.failed') : t('m.loading')}</p>}
      </section>
      <section><h2>{t('m.limits')}</h2><p>{t('m.limits1')}</p><p>{t('m.limits2')}</p><p>{t('m.limits3')}</p></section>
    </article>
  );
}
