import { describe, expect, it } from 'vitest';
import { MAX_FRAGMENT, decodeShare, encodeShare, parseRunFile, safeUrl, sanitizeRun, toRunFile, type SharedRun } from '../src/core/share';
import { changeLogText, planBibliography, recordsWithKeys, type Decisions } from '../src/core/decisions';
import type { CheckResult, Work } from '../src/core/types';

const run: SharedRun = { date: '2026-11-02T12:00:00.000Z', entries: [
  { raw: '[1] Vaswani, A. (2017). Attention is all you need.', verdict: 'Verified', title: 'Attention Is All You Need', doi: '10.48550/arxiv.1706.03762', url: 'https://arxiv.org/abs/1706.03762', decision: 'record' },
  { raw: '[2] Wetherquill, Z. (2023). Invented title.', verdict: 'No record found' },
] };

describe('share links', () => {
  it('round-trips a run through the URL fragment', () => {
    const enc = encodeShare(run); if (!enc.ok) throw new Error('unexpected');
    expect(enc.fragment.startsWith('#/s/')).toBe(true);
    expect(decodeShare(enc.fragment.slice(4))).toEqual(run);
  });
  it('refuses to build a broken link when the fragment is too long, and the file form still works', () => {
    const big: SharedRun = { date: run.date, entries: Array.from({ length: 400 }, (_, i) => ({ raw: `Author${i}, A. (2020). ${Math.random().toString(36).repeat(8)} paper ${i}.`, verdict: 'Verified' as const, title: Math.random().toString(36).repeat(5) })) };
    const enc = encodeShare(big);
    expect(enc).toEqual({ ok: false, reason: 'too-large' });
    expect(parseRunFile(toRunFile(big))?.entries).toHaveLength(400);
    expect(MAX_FRAGMENT).toBe(8000);
  });
  it('rejects junk, tampered and oversized input', () => {
    expect(decodeShare('')).toBeUndefined();
    expect(decodeShare('not-a-valid-payload!!')).toBeUndefined();
    expect(decodeShare('A'.repeat(MAX_FRAGMENT + 1))).toBeUndefined();
    expect(parseRunFile('{"format":"other"}')).toBeUndefined();
    expect(parseRunFile('nope')).toBeUndefined();
  });
  it('bounds and cleans every field, drops non-http links and unknown verdicts', () => {
    const r = sanitizeRun({ date: run.date, entries: [{ raw: 'x'.repeat(5000), verdict: 'Verified', title: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)', decision: 'rm -rf' }] });
    expect(r?.entries[0].raw).toHaveLength(1500);
    expect(r?.entries[0].url).toBeUndefined();
    expect(r?.entries[0].decision).toBeUndefined();
    expect(r?.entries[0].title).toBe('<img src=x onerror=alert(1)>'); // kept as inert text; the UI never renders HTML
    expect(sanitizeRun({ date: run.date, entries: [{ raw: 'x', verdict: 'Totally fine' }] })).toBeUndefined();
    expect(sanitizeRun({ date: 'yesterday', entries: [{ raw: 'x', verdict: 'Verified' }] })).toBeUndefined();
    expect(sanitizeRun({ date: run.date, entries: Array.from({ length: 1001 }, () => ({ raw: 'x', verdict: 'Verified' })) })).toBeUndefined();
    expect(safeUrl('https://doi.org/10.1/x')).toBe('https://doi.org/10.1/x');
    expect(safeUrl('data:text/html,<b>')).toBeUndefined();
    expect(safeUrl('ftp://x.org/a')).toBeUndefined();
  });
});

const work = (title: string, year = 2020): Work => ({ id: title, title, authors: [{ family: 'Smith' }], year, url: 'https://example.org', source: 'Crossref' });
const res = (verdict: CheckResult['verdict'], extra: Partial<CheckResult> = {}): CheckResult => ({ reference: { raw: '', surnames: [], title: '', kind: 'scholarly' }, verdict, explanation: '', evidence: [], checkedAt: '', ...extra });

describe('planBibliography', () => {
  const rows = [
    { id: 0, raw: '[1] a', result: res('Verified', { match: work('A') }) },
    { id: 1, raw: '[2] b', result: res('Details differ', { match: work('B'), alternatives: [work('B alt')] }) },
    { id: 2, raw: '[3] c', result: res('No record found', { alternatives: [work('C alt')] }) },
    { id: 3, raw: '[4] d', result: res('Retracted', { match: work('D') }) },
    { id: 4, raw: '[5] e', result: res('Could not check') },
  ];
  it('keeps undecided entries as written and lists the flagged ones as unresolved', () => {
    const { items, log } = planBibliography(rows, {});
    expect(items.every(i => i.action === 'original')).toBe(true);
    expect(log.map(l => [l.id, l.kind])).toEqual([[1, 'unresolved'], [2, 'unresolved'], [3, 'unresolved'], [4, 'unresolved']]);
  });
  it('applies use-record, an alternative (marked candidate), remove and keep', () => {
    const d: Decisions = { 1: { kind: 'record' }, 2: { kind: 'record', alt: 0 }, 3: { kind: 'remove' }, 4: { kind: 'keep' } };
    const { items, log } = planBibliography(rows, d);
    expect(items.map(i => i.action)).toEqual(['original', 'record', 'record', 'removed', 'original']);
    expect(items[1].work?.title).toBe('B'); expect(items[1].candidate).toBe(false);
    expect(items[2].work?.title).toBe('C alt'); expect(items[2].candidate).toBe(true);
    expect(log.map(l => l.kind)).toEqual(['replaced', 'replaced', 'removed', 'kept']);
    expect(changeLogText(log)).toContain('candidate');
  });
  it('never swaps a retracted entry for its own record, and gives unique keys', () => {
    expect(planBibliography(rows, { 3: { kind: 'record' } }).items[3].action).toBe('original');
    const keys = recordsWithKeys(planBibliography(rows, { 1: { kind: 'record' }, 0: { kind: 'record' } }).items).map(w => w.id);
    expect(keys).toEqual(['Smith2020', 'Smith2020b']);
  });
});
