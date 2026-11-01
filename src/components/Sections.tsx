import { useState } from 'react';
import { VERDICTS } from '../core/types';
import { verdictMeta } from './Icons';

export function HowItWorks() {
  const steps: [string, string][] = [
    ['Read on your device', 'The reference section is found in your pasted text, Word file, PDF, BibTeX or RIS file, and split into individual entries.'],
    ['Look up the record', 'A DOI or arXiv id is resolved directly. Anything else is searched at Crossref, then OpenAlex, Europe PMC and Open Library when Crossref has no strong match.'],
    ['Compare field by field', 'Title, authors, year and venue are compared against your original text, so a real author list on an invented title, or a real DOI on the wrong paper, shows up.'],
    ['Show the evidence', 'Every verdict links the source record and shows what you wrote against what the record says. Matched works come with a corrected reference in APA, MLA, Chicago or IEEE.'],
  ];
  return (
    <section className="band" id="how" aria-labelledby="how-h">
      <div className="eyebrow">How it works</div>
      <h2 id="how-h">Six verdicts, each one explained.</h2>
      <ol className="how-steps">{steps.map(([h, p], i) => <li key={h}><span className="step-n" aria-hidden="true">{i + 1}</span><h3>{h}</h3><p>{p}</p></li>)}</ol>
      <ul className="legend" aria-label="The six verdicts">
        {VERDICTS.map(v => { const { Icon, slug, short } = verdictMeta[v]; return <li key={v} className={`v-${slug}`}><span className="legend-name"><Icon />{v}</span><span>{short}</span></li>; })}
      </ul>
      <p className="muted">A genuine paper flagged as fabricated is the worst error, so Bibproof only says “No record found” after at least two indexes have answered. An index that is down or out of budget leads to “Could not check”, never to an accusation. <a href="#/methodology">Read the methodology and measured results</a>.</p>
    </section>
  );
}

export function Privacy({ onClear }: { onClear: () => Promise<void> }) {
  const [cleared, setCleared] = useState(false);
  return (
    <section className="band" id="privacy" aria-labelledby="privacy-h">
      <div className="eyebrow">Privacy</div>
      <h2 id="privacy-h">Your document stays on your device.</h2>
      <p className="statement">Your file is read on your device and never uploaded. Only the text of each individual reference is sent to public scholarly indexes: Crossref, DataCite, OpenAlex, Europe PMC and Open Library.</p>
      <ul className="plain-list">
        <li>No account, no sign-up, no analytics, no cookies, and no API keys.</li>
        <li>No server of ours is involved. The site is static files; your browser talks to the indexes directly.</li>
        <li>Lookups are cached in this browser for seven days so a re-run is instant.</li>
      </ul>
      <button className="button small" onClick={async () => { await onClear(); setCleared(true); }}>{cleared ? 'Cache cleared' : 'Clear cached lookups'}</button>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer no-print">
      <div className="footer-grid">
        <div>
          <strong className="wordmark-sm">Bibproof</strong>
          <p>Every reference, proven before you submit. MIT licensed, built with AI coding assistance.</p>
          <p><a href="https://github.com/yy5652-hash/bibproof">Source code on GitHub ↗</a></p>
        </div>
        <div>
          <h2>Open-source libraries</h2>
          <p>pdf.js (Apache-2.0), mammoth (BSD-2-Clause), Citation.js (MIT), React and Vite (MIT), and the CSL styles for MLA, Chicago and IEEE (CC BY-SA). Type: Newsreader and Inter (SIL OFL).</p>
        </div>
        <div>
          <h2>Scholarly indexes</h2>
          <p>Records come from <a href="https://www.crossref.org/">Crossref</a>, <a href="https://datacite.org/">DataCite</a>, <a href="https://openalex.org/">OpenAlex</a>, <a href="https://europepmc.org/">Europe PMC</a> and <a href="https://openlibrary.org/">Open Library</a>. Retraction flags depend on their metadata.</p>
        </div>
      </div>
    </footer>
  );
}
