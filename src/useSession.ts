import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { extractReferences, type Extraction } from './core/extract';
import type { Decision, Decisions } from './core/decisions';
import type { SharedRun } from './core/share';
import type { CheckResult } from './core/types';
import { history, type StoredRun } from './browser/history';
import { useChecker } from './useChecker';

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const listOnly = (entries: string[]): Extraction => ({ entries, body: '', fullDocument: false, warnings: [] });

/** Everything that survives moving between pages: the run, the decisions on it, and what is typed in the input. */
export function useSession() {
  const checker = useChecker();
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [decisions, setDecisions] = useState<Decisions>({});
  const [meta, setMeta] = useState<{ id: string; at: string } | null>(null);
  const [text, setText] = useState('');
  const [doi, setDoi] = useState('');
  const [imported, setImported] = useState<SharedRun | null>(null);
  const [fileText, setFileText] = useState<{ name: string; text: string; note?: string } | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  const begin = useCallback((entries: string[], ex: Extraction | null) => {
    setExtraction(ex ?? listOnly(entries)); setDecisions({}); setMeta({ id: newId(), at: new Date().toISOString() });
    void checker.start(entries);
  }, [checker.start]);
  const check = useCallback((source: string) => { const ex = extractReferences(source); if (!ex.entries.length) return false; begin(ex.entries, ex); return true; }, [begin]);
  const recheck = useCallback((entries: string[]) => begin(entries, null), [begin]);
  const reopen = useCallback((run: StoredRun) => {
    setExtraction(listOnly(run.entries)); setDecisions(run.decisions); setMeta({ id: run.id, at: run.at }); checker.load(run.entries, run.results);
  }, [checker.load]);
  const loadFixture = useCallback((entries: string[], results: CheckResult[]) => {
    setExtraction(listOnly(entries)); setDecisions({}); setMeta(null); checker.load(entries, results);
  }, [checker.load]);
  const decide = useCallback((id: number, d: Decision | undefined) => setDecisions(prev => {
    const next = { ...prev }; if (d) next[id] = d; else delete next[id]; return next;
  }), []);
  const decideMany = useCallback((patch: Decisions) => setDecisions(prev => ({ ...prev, ...patch })), []);
  const newCheck = useCallback(() => { checker.reset(); setExtraction(null); setDecisions({}); setMeta(null); }, [checker.reset]);

  // A finished run is saved on this device. Later decisions update the same entry.
  const rowsRef = useRef(checker.rows); rowsRef.current = checker.rows;
  useEffect(() => {
    if (!meta || (checker.phase !== 'done' && checker.phase !== 'cancelled')) return;
    const rows = rowsRef.current; if (!rows.some(r => r.result)) return;
    const h = setTimeout(() => { void history.put({ id: meta.id, at: meta.at, entries: rows.map(r => r.raw), results: rows.map(r => r.result ?? null), decisions }).then(() => setHistoryVersion(v => v + 1)); }, 250);
    return () => clearTimeout(h);
  }, [checker.phase, decisions, meta]);

  return useMemo(() => ({ ...checker, extraction, decisions, meta, text, setText, doi, setDoi, fileText, setFileText, imported, setImported, historyVersion, check, begin, recheck, reopen, loadFixture, decide, decideMany, newCheck }),
    [checker, extraction, decisions, meta, text, doi, fileText, imported, historyVersion, check, begin, recheck, reopen, loadFixture, decide, decideMany, newCheck]);
}
export type Session = ReturnType<typeof useSession>;
