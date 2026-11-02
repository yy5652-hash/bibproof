import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { VERDICTS, type Verdict } from './types';

/** The essentials of a run, small enough for a URL fragment. Everything read back from a link or a file is untrusted. */
export type SharedDecision = 'keep' | 'record' | 'remove';
export interface SharedEntry { raw: string; verdict: Verdict; title?: string; doi?: string; url?: string; decision?: SharedDecision }
export interface SharedRun { date: string; entries: SharedEntry[] }

export const MAX_FRAGMENT = 8000;
const MAX_ENTRIES = 1000;
const MAX_RAW = 1500; const MAX_TITLE = 400; const MAX_DOI = 200; const MAX_URL = 600;
const MAX_INFLATED = 2_000_000;
const DECISIONS: SharedDecision[] = ['keep', 'record', 'remove'];

const text = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max) : undefined);
/** Only http and https addresses are ever turned into links. */
export function safeUrl(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > MAX_URL) return undefined;
  try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined; } catch { return undefined; }
}
export const validDate = (v: unknown): string | undefined => {
  if (typeof v !== 'string' || v.length > 40) return undefined;
  const t = Date.parse(v); return Number.isFinite(t) && t > Date.parse('2000-01-01') && t < Date.now() + 864e5 * 2 ? new Date(t).toISOString() : undefined;
};

function entryFrom(o: unknown): SharedEntry | undefined {
  if (!o || typeof o !== 'object') return undefined;
  const e = o as Record<string, unknown>;
  const raw = text(e.raw, MAX_RAW); const verdict = VERDICTS.find(v => v === e.verdict);
  if (!raw || !verdict) return undefined;
  const decision = DECISIONS.find(d => d === e.decision);
  return { raw, verdict, title: text(e.title, MAX_TITLE), doi: text(e.doi, MAX_DOI), url: safeUrl(e.url), ...(decision ? { decision } : {}) };
}
export function sanitizeRun(o: unknown): SharedRun | undefined {
  if (!o || typeof o !== 'object') return undefined;
  const r = o as Record<string, unknown>;
  const date = validDate(r.date); if (!date || !Array.isArray(r.entries) || !r.entries.length || r.entries.length > MAX_ENTRIES) return undefined;
  const entries = r.entries.map(entryFrom);
  return entries.every(Boolean) ? { date, entries: entries as SharedEntry[] } : undefined;
}

// Compact wire form: positional arrays keep the fragment short.
export function encodeShare(run: SharedRun): { ok: true; fragment: string } | { ok: false; reason: 'too-large' | 'empty' } {
  if (!run.entries.length) return { ok: false, reason: 'empty' };
  const wire = { v: 1, d: run.date, e: run.entries.map(e => [e.raw, VERDICTS.indexOf(e.verdict), e.title ?? '', e.doi ?? '', e.url ?? '', e.decision ? DECISIONS.indexOf(e.decision) : -1]) };
  const payload = compressToEncodedURIComponent(JSON.stringify(wire));
  const fragment = `#/s/${payload}`;
  return fragment.length > MAX_FRAGMENT ? { ok: false, reason: 'too-large' } : { ok: true, fragment };
}
export function decodeShare(payload: string): SharedRun | undefined {
  if (!payload || payload.length > MAX_FRAGMENT) return undefined;
  try {
    const json = decompressFromEncodedURIComponent(payload);
    if (!json || json.length > MAX_INFLATED) return undefined;
    const wire = JSON.parse(json) as { v?: unknown; d?: unknown; e?: unknown };
    if (wire.v !== 1 || !Array.isArray(wire.e) || wire.e.length > MAX_ENTRIES) return undefined;
    return sanitizeRun({ date: wire.d, entries: wire.e.map(row => Array.isArray(row) ? { raw: row[0], verdict: VERDICTS[row[1] as number], title: row[2], doi: row[3], url: row[4], decision: DECISIONS[row[5] as number] } : null) });
  } catch { return undefined; }
}

export const FILE_FORMAT = 'bibproof-run';
export function toRunFile(run: SharedRun): string {
  return JSON.stringify({ format: FILE_FORMAT, version: 1, date: run.date, entries: run.entries }, null, 1);
}
export function parseRunFile(source: string): SharedRun | undefined {
  if (source.length > 5_000_000) return undefined;
  try { const o = JSON.parse(source) as Record<string, unknown>; return o?.format === FILE_FORMAT && o.version === 1 ? sanitizeRun(o) : undefined; } catch { return undefined; }
}
