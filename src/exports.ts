import type { CheckResult, Work } from './core/types';
import { exportWorks, csvReport } from './core/format';
import { download } from './browser/files';

/** Only matched records the user can safely adopt: verified or merely differing. Retracted and conflicting entries need a human decision. */
export function correctable(results: CheckResult[]): Work[] {
  const used = new Map<string, number>();
  return results.flatMap(r => {
    if (!r.match || (r.verdict !== 'Verified' && r.verdict !== 'Details differ')) return [];
    const family = (r.match.authors[0]?.family ?? 'ref').normalize('NFKD').replace(/[^A-Za-z0-9]/g, '') || 'ref';
    const stem = `${family}${r.match.year ?? ''}`;
    const n = (used.get(stem) ?? 0) + 1; used.set(stem, n);
    return [{ ...r.match, id: n === 1 ? stem : `${stem}${String.fromCharCode(96 + n)}` }];
  });
}
export async function downloadBib(results: CheckResult[]) { download('bibproof-corrected.bib', await exportWorks(correctable(results), 'bibtex'), 'application/x-bibtex'); }
export async function downloadRis(results: CheckResult[]) { download('bibproof-corrected.ris', await exportWorks(correctable(results), 'ris'), 'application/x-research-info-systems'); }
export function downloadCsv(results: CheckResult[]) { download('bibproof-report.csv', csvReport(results), 'text/csv;charset=utf-8'); }
