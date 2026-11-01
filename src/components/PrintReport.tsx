import { VERDICTS, type CheckResult } from '../core/types';
import type { Extraction } from '../core/extract';
import { crossCheck } from '../core/crosscheck';
import type { RowState } from '../useChecker';

/** Rendered only for the printed page: a flat, evidence-first record of the run. */
export default function PrintReport({ rows, extraction }: { rows: RowState[]; extraction: Extraction | null }) {
  const done = rows.filter(r => r.state === 'done');
  if (!done.length) return null;
  const results = done.map(r => r.result!);
  const cross = extraction?.fullDocument ? crossCheck(extraction.body, extraction.entries) : null;
  return (
    <section className="print-only" aria-hidden="true">
      <h1>Bibproof reference report</h1>
      <p>{new Date().toLocaleString()} · {done.length} of {rows.length} references checked · https://yy5652-hash.github.io/bibproof/</p>
      <p>{VERDICTS.map(v => `${results.filter(r => r.verdict === v).length} ${v}`).join(' · ')}</p>
      <ol>
        {done.map(row => { const r: CheckResult = row.result!; const rec = r.verdict === 'Identifier conflict' ? r.identifierRecord : r.match ?? r.nearest; return (
          <li key={row.id}>
            <strong>{r.verdict}</strong>
            <p>{row.raw}</p>
            <p>{r.explanation}</p>
            {rec && <p>{r.match ? 'Record' : r.verdict === 'Identifier conflict' ? 'Identifier points to' : 'Nearest record'}: {rec.title} ({rec.authors.slice(0, 3).map(a => a.family).join(', ')}{rec.authors.length > 3 ? ' et al.' : ''}, {rec.year ?? 'n.d.'}) · {rec.url}</p>}
            {r.score && <p>{r.score.fields.filter(f => f.status !== 'unknown').map(f => `${f.field}: ${f.status === 'agree' ? 'agrees' : `differs (you wrote “${f.written}”; record: “${f.record}”)`}`).join(' · ')}</p>}
          </li>); })}
      </ol>
      {cross && <><h2>In-text citations ({cross.style})</h2><p>Cited without an entry: {cross.missing.join(', ') || 'none'}. Listed but never cited: {cross.uncited.join(', ') || 'none'}.</p></>}
      <p>Verdicts describe index metadata, not scientific claims. “No record found” means no close match in the indexes that answered; check by hand before deciding a reference is fabricated.</p>
    </section>
  );
}
