import { useRef, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { SAMPLE, sampleEntries } from '../core/sample';
import { extractReferences } from '../core/extract';
import { readInputFile } from '../browser/files';
import { useI18n } from '../i18n';
import type { Session } from '../useSession';
import { IconArrowRight, IconFile, IconSpinner, IconUpload, VerdictBadge } from './Icons';

type Tab = 'paste' | 'file' | 'doi';
const ACCEPT = '.docx,.pdf,.bib,.ris,.txt';
const DOI_PATTERN = /10\.\d{4,9}\/[^\s<>"]+/i;

/** One real entry from the built-in sample, with the year the Crossref record gives for its DOI (recorded in tests/e2e/fixtures). */
function Illustration() {
  const { t } = useI18n();
  const entry = sampleEntries.find(e => e.kind === 'Details differ' && /doi\.org/.test(e.raw))!;
  const written = entry.raw.match(/\((\d{4})\)/)?.[1] ?? '';
  const [head, tail] = entry.raw.split(`(${written})`);
  return (
    <figure className="demo" aria-labelledby="demo-h">
      <figcaption id="demo-h" className="eyebrow">{t('demo.title')}</figcaption>
      <div className="demo-step">
        <span className="demo-label">{t('demo.before')}</span>
        <p className="demo-raw">{head}(<mark>{written}</mark>){tail}</p>
      </div>
      <div className="demo-arrow" aria-hidden="true"><IconArrowRight /></div>
      <div className="demo-step demo-result">
        <span className="demo-label">{t('demo.after')}</span>
        <VerdictBadge verdict={entry.kind} />
        <dl className="demo-fields">
          <div><dt>{t('demo.field')}</dt><dd><span className="bad">{t('demo.you')} {written}</span><span className="good">{t('demo.record')} 2015</span></dd></div>
          <div><dt>{t('demo.source')}</dt><dd>Deep learning · LeCun, Bengio, Hinton · Nature · Crossref</dd></div>
        </dl>
      </div>
      <p className="demo-note">{t('demo.note')}</p>
    </figure>
  );
}

export default function Home({ s }: { s: Session }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('paste');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const preview = s.text.trim() ? extractReferences(s.text) : null;
  const busy = s.phase === 'running' || reading;

  async function load(file: File | undefined) {
    if (!file) return;
    setTab('file'); setReading(true); setError('');
    try { const { text, note } = await readInputFile(file); s.setFileText({ name: file.name, text, note }); }
    catch (e) { s.setFileText(null); setError(e instanceof Error ? e.message : t('err.file')); }
    finally { setReading(false); if (picker.current) picker.current.value = ''; }
  }
  function submit() {
    setError('');
    if (tab === 'doi') {
      const doi = s.doi.match(DOI_PATTERN)?.[0].replace(/[.,;]+$/, '');
      if (!doi) { setError(t('err.doi')); return; }
      // The prefix keeps a leading "10." from being read as a list number by the reference parser.
      s.begin([`https://doi.org/${doi}`], null); return;
    }
    if (!s.check(tab === 'file' ? s.fileText?.text ?? '' : s.text)) setError(t('err.none'));
  }
  const ready = tab === 'paste' ? Boolean(s.text.trim()) : tab === 'file' ? Boolean(s.fileText?.text.trim()) : Boolean(s.doi.trim());
  const fileEntries = s.fileText ? extractReferences(s.fileText.text) : null;

  return (
    <section className="hero" aria-labelledby="tool-h"
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={e => { e.preventDefault(); setDragging(false); void load(e.dataTransfer.files[0]); }}>
      <div className="hero-main">
        <h1 id="tool-h">{t('hero.a')} <em>{t('hero.b')}</em> {t('hero.c')}</h1>
        <p className="lede">{t('hero.lede')}</p>
        <div className={`input-card${dragging ? ' dragging' : ''}`}>
          <Tabs.Root value={tab} onValueChange={v => { setTab(v as Tab); setError(''); }}>
            <Tabs.List className="tab-list" aria-label={t('tabs.label')}>
              <Tabs.Trigger value="paste" className="tab">{t('tabs.paste')}</Tabs.Trigger>
              <Tabs.Trigger value="file" className="tab">{t('tabs.file')}</Tabs.Trigger>
              <Tabs.Trigger value="doi" className="tab">{t('tabs.doi')}</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="paste" className="tab-panel">
              <label htmlFor="refs" className="sr-only">{t('paste.label')}</label>
              <textarea id="refs" value={s.text} onChange={e => s.setText(e.target.value)} spellCheck={false} placeholder={t('paste.placeholder')} />
            </Tabs.Content>
            <Tabs.Content value="file" className="tab-panel">
              <div className="dropzone">
                <IconUpload width={26} height={26} />
                {reading ? <p><IconSpinner /> {t('file.reading')}</p>
                  : s.fileText ? <><p className="drop-title"><IconFile /> {t('file.done', { name: s.fileText.name })}</p>{s.fileText.note && <p className="muted">{s.fileText.note}</p>}</>
                  : <p className="drop-title">{t('file.drop')}</p>}
                <p className="muted">{t('file.or')}</p>
                <button type="button" className="button" onClick={() => picker.current?.click()} disabled={busy}>{s.fileText ? t('file.replace') : t('file.choose')}</button>
                <span className="formats">{t('file.formats')}</span>
                <input ref={picker} type="file" accept={ACCEPT} hidden aria-label={t('file.aria')} onChange={e => void load(e.target.files?.[0])} />
              </div>
            </Tabs.Content>
            <Tabs.Content value="doi" className="tab-panel">
              <div className="doi-field">
                <label htmlFor="doi-input">{t('doi.label')}</label>
                <input id="doi-input" type="text" inputMode="url" autoComplete="off" spellCheck={false} value={s.doi} placeholder={t('doi.placeholder')}
                  onChange={e => s.setDoi(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && ready && !busy) submit(); }} />
                <p className="muted">{t('doi.hint')}</p>
              </div>
            </Tabs.Content>
          </Tabs.Root>
          <div className="input-actions">
            <button className="button primary" onClick={submit} disabled={busy || !ready}>{tab === 'doi' ? t('cta.checkDoi') : t('cta.check')}</button>
            <button className="button" onClick={() => { s.setText(SAMPLE); setTab('paste'); setError(''); void s.loadSample().catch(() => setError(t('sample.failed'))); }} disabled={busy}>{t('cta.sample')}</button>
          </div>
          <div className="input-status" aria-live="polite">
            {error ? <p role="alert" className="error">{error}</p>
              : tab === 'paste' && preview?.entries.length ? <p className="muted">{t('detected', { n: preview.entries.length })}{preview.fullDocument ? t('detected.doc') : t('detected.list')}</p>
              : tab === 'file' && fileEntries?.entries.length ? <p className="muted">{t('detected', { n: fileEntries.entries.length })}{fileEntries.fullDocument ? t('detected.doc') : t('detected.list')}</p>
              : null}
          </div>
        </div>
        <p className="fine-print">{t('sample.intro')}</p>
        <p className="hero-trust">{t('hero.trust')}</p>
      </div>
      <div className="hero-aside"><Illustration /></div>
    </section>
  );
}
