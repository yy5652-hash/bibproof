import { sanitizeUserEvidence, type UserEvidence } from './core/userEvidence';
import { retryUnavailable } from './core/retry';
import { useCallback, useRef, useState } from 'react';
import type { CheckResult } from './core/types';
import { IndexClient } from './core/http';
import { verifyReference } from './core/verify';
import { parseReference } from './core/parse';
import { BrowserCache } from './browser/cache';

export type RowState = { id: number; raw: string; state: 'queued' | 'running' | 'done' | 'skipped'; result?: CheckResult };
export type Phase = 'idle' | 'running' | 'done' | 'cancelled';
const CONCURRENCY = 3;

function unreadable(raw: string, message: string): CheckResult {
  return { reference: parseReference(raw), verdict: 'Could not check', explanation: `The check failed before an answer was available (${message}). No conclusion about existence is possible; try again.`, evidence: [], checkedAt: new Date().toISOString() };
}

export function useChecker() {
  const client = useRef<IndexClient>(undefined);
  const run = useRef(0);
  const [rows, setRows] = useState<RowState[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');

  const start = useCallback(async (entries: string[], fresh = false) => {
    const mine = ++run.current;
    client.current ??= new IndexClient(new BrowserCache());
    const savedCache = client.current.cache;
    const http = fresh ? new IndexClient({get: key => key.startsWith('response:') ? Promise.resolve(undefined) : savedCache.get(key), set: (key,value) => savedCache.set(key,value)}) : client.current;
    setRows(entries.map((raw, id) => ({ id, raw, state: 'queued' })));
    setPhase('running');
    const patch = (id: number, change: Partial<RowState>) => setRows(prev => prev.map(r => (r.id === id ? { ...r, ...change } : r)));
    let next = 0;
    const worker = async () => {
      while (mine === run.current) {
        const id = next++;
        if (id >= entries.length) return;
        patch(id, { state: 'running' });
        let result: CheckResult;
        try { result = await verifyReference(entries[id], http); }
        catch (e) { result = unreadable(entries[id], e instanceof Error ? e.message : 'unexpected error'); }
        if (mine !== run.current) return;
        patch(id, { state: 'done', result });
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, worker));
    if (mine === run.current) setPhase('done');
  }, []);

  const retry = useCallback(async (ids?: number[]) => {
    const mine = ++run.current;
    client.current ??= new IndexClient(new BrowserCache());
    setPhase('running');
    await retryUnavailable(rows, ids, async raw => {
      try { return await verifyReference(raw, client.current!); }
      catch (e) { return unreadable(raw, e instanceof Error ? e.message : 'unexpected error'); }
    }, (id, result) => setRows(prev => prev.map(r => r.id === id ? {...r, state:'done', result:{...result, userEvidence:r.result?.userEvidence}} : r)), () => mine === run.current);
    if (mine === run.current) setPhase('done');
  }, [rows]);

  const cancel = useCallback(() => {
    run.current++;
    setRows(prev => prev.map(r => (r.state === 'done' ? r : { ...r, state: 'skipped' })));
    setPhase('cancelled');
  }, []);

  const reset = useCallback(() => { run.current++; setRows([]); setPhase('idle'); }, []);
  /** Show a finished run (from history or a test fixture) without any lookups. */
  const load = useCallback((entries: string[], results: (CheckResult | null)[]) => {
    run.current++;
    setRows(entries.map((raw, id) => (results[id] ? { id, raw, state: 'done' as const, result: results[id]! } : { id, raw, state: 'skipped' as const })));
    setPhase(results.some(Boolean) ? 'done' : 'cancelled');
  }, []);
  const saveUserEvidence = useCallback((id: number, evidence?: UserEvidence) => setRows(prev => prev.map(r => r.id === id && r.result ? {...r, result:{...r.result, userEvidence:sanitizeUserEvidence(evidence)}} : r)), []);
  const clearCache = useCallback(async () => { client.current ??= new IndexClient(new BrowserCache()); await client.current.cache.clear?.(); }, []);
  return { rows, phase, start, retry, cancel, reset, load, clearCache, saveUserEvidence };
}
