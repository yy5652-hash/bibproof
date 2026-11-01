import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { extractReferences, type Extraction } from '../core/extract';
import { SAMPLE } from '../core/sample';
import { readInputFile } from '../browser/files';
import { useChecker } from '../useChecker';
import Results from './Results';
import PrintReport from './PrintReport';
import { IconFile, IconSpinner, IconUpload } from './Icons';

const ACCEPT = '.docx,.pdf,.bib,.ris,.txt';

export default function Tool() {
  const { rows, phase, start, cancel } = useChecker();
  const [text, setText] = useState('');
  const [fileNote, setFileNote] = useState('');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const deferred = useDeferredValue(text);
  const preview = useMemo(() => (deferred.trim() ? extractReferences(deferred) : null), [deferred]);
  const running = phase === 'running';

  function run(source: string) {
    const ex = extractReferences(source);
    if (!ex.entries.length) { setError('No references found. Paste a reference list or a document with a References heading, or choose a file.'); return; }
    setError(''); setExtraction(ex);
    void start(ex.entries);
    requestAnimationFrame(() => document.getElementById('results')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  }
  async function load(file: File | undefined) {
    if (!file) return;
    setReading(true); setError(''); setFileNote('');
    try {
      const { text: content, note } = await readInputFile(file);
      setText(content); setFileNote(`${file.name} was read on this device.${note ? ' ' + note : ''}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'The file could not be read.'); }
    finally { setReading(false); if (picker.current) picker.current.value = ''; }
  }

  return (
    <>
      <section className="tool no-print" aria-labelledby="tool-h"
        onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
        onDrop={e => { e.preventDefault(); setDragging(false); void load(e.dataTransfer.files[0]); }}>
        <h1 id="tool-h">Every reference, <em>proven</em> before you submit.</h1>
        <p className="lede">Paste a bibliography or drop in a paper. Each reference is checked against the scholarly record, with the evidence shown. No cap, no account.</p>
        <div className={`input-card${dragging ? ' dragging' : ''}`}>
          <label htmlFor="refs" className="input-label">References or document</label>
          <textarea id="refs" value={text} onChange={e => { setText(e.target.value); setFileNote(''); }} spellCheck={false} disabled={reading}
            placeholder={'Paste references here, one per entry:\n\n[1] Vaswani, A., et al. (2017). Attention is all you need. NeurIPS.\n[2] He, K., Zhang, X., Ren, S., & Sun, J. (2016). Deep residual learning for image recognition. CVPR.\n\nOr paste a whole paper. Bibproof finds the References section and also cross-checks the in-text citations.'} />
          <div className="drop-hint" aria-hidden="true"><IconUpload width={22} height={22} /><span>Drop a file to read it here</span></div>
          <div className="input-actions">
            <button className="button primary" onClick={() => run(text)} disabled={running || reading || !text.trim()}>Check references</button>
            <button className="button" onClick={() => { setText(SAMPLE); setFileNote(''); run(SAMPLE); }} disabled={running || reading}>Try a sample</button>
            <button className="button ghost" onClick={() => picker.current?.click()} disabled={running || reading}>{reading ? <IconSpinner /> : <IconUpload />}Upload file</button>
            <input ref={picker} type="file" accept={ACCEPT} hidden aria-label="Upload a .docx, .pdf, .bib, .ris or .txt file" onChange={e => void load(e.target.files?.[0])} />
            <span className="formats"><IconFile />.docx .pdf .bib .ris .txt</span>
          </div>
          <div className="input-status" aria-live="polite">
            {error ? <p role="alert" className="error">{error}</p>
              : fileNote ? <p className="muted">{fileNote}</p>
              : preview?.entries.length ? <p className="muted">{preview.entries.length} reference{preview.entries.length === 1 ? '' : 's'} detected{preview.fullDocument ? ' in a full document. The in-text cross-check will run.' : '.'}</p>
              : <p className="muted">Read on this device. Only the text of each reference is sent to public scholarly indexes.</p>}
          </div>
        </div>
      </section>
      <Results rows={rows} phase={phase} extraction={extraction} onCancel={cancel} />
      <PrintReport rows={rows} extraction={extraction} />
    </>
  );
}
