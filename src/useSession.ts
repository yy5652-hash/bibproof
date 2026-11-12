import { crossCheck } from './core/crosscheck';
import { resolveCitation, citingSentences, type Citing } from './core/citing';
import { retainSentenceReviews, type SentenceChoice, type SentenceReviews } from './core/repairs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { extractReferences, needsExtractionPreview, type Extraction } from './core/extract';
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
  const [pendingExtraction, setPendingExtraction] = useState<Extraction | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [savedExampleAt, setSavedExampleAt] = useState<string | null>(null);
  const [citing, setCiting] = useState<Citing | null>(null);
  const [reviews, setReviews] = useState<SentenceReviews>({});
  const reviewSentence = useCallback((key: string, choice: SentenceChoice) => setReviews(prev => ({...prev, [key]: choice})), []);
  const [decisions, setDecisions] = useState<Decisions>({});
  const [meta, setMeta] = useState<{ id: string; at: string } | null>(null);
  const [text, setText] = useState('');
  const [doi, setDoi] = useState('');
  const [imported, setImported] = useState<SharedRun | null>(null);
  const [fileText, setFileText] = useState<{ name: string; text: string; note?: string } | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  const begin = useCallback((entries: string[], ex: Extraction | null, fresh = false) => {
    setPendingExtraction(null); setSavedExampleAt(null); setCiting(ex?.fullDocument ? citingSentences(ex.body, entries, true) : null); setReviews({});
    setExtraction(ex ? {...ex,cross:ex.fullDocument?crossCheck(ex.body,entries):undefined} : listOnly(entries)); setDecisions({}); setMeta({ id: newId(), at: new Date().toISOString() });
    void checker.start(entries, fresh);
  }, [checker.start]);
  const check = useCallback((source: string) => { const ex = extractReferences(source); if (!ex.entries.length) return false; if(needsExtractionPreview(ex)) setPendingExtraction(ex); else begin(ex.entries, ex); return true; }, [begin]);
  const recheck = useCallback((entries: string[], fresh = false) => begin(entries, null, fresh), [begin]);
  const reopen = useCallback((run: StoredRun) => {
    setSavedExampleAt(run.savedExampleAt ?? null); setCiting(run.citing ?? null); setReviews(run.reviews ?? {});
    setExtraction({...listOnly(run.entries),fullDocument:run.fullDocument??Boolean(run.citing),cross:run.cross}); setDecisions(run.decisions); setMeta({ id: run.id, at: run.at }); checker.load(run.entries, run.results);
  }, [checker.load]);
  const loadFixture = useCallback((entries: string[], results: CheckResult[]) => {
    setSavedExampleAt(null); setCiting(null); setReviews({}); setExtraction(listOnly(entries)); setDecisions({}); setMeta(null); checker.load(entries, results);
  }, [checker.load]);
  const loadSample = useCallback(async () => {
    const snapshot = (await import('./core/sample-snapshot.json')).default;
    setPendingExtraction(null); setSavedExampleAt(snapshot.runAt); setCiting(null); setReviews({}); setDecisions({});
    setExtraction(listOnly(snapshot.entries)); setMeta({ id: newId(), at: snapshot.runAt });
    checker.load(snapshot.entries, snapshot.results as CheckResult[]);
  }, [checker.load]);
  const loadPaper = useCallback(async () => {
    const snapshot=(await import('./core/paper-snapshot.json')).default;
    const ex=extractReferences(snapshot.document);
    setPendingExtraction(null); setSavedExampleAt(snapshot.runAt); setReviews({});setDecisions({});
    setCiting(citingSentences(ex.body,ex.entries,true));setExtraction({...ex,cross:crossCheck(ex.body,ex.entries)});
    setMeta({id:newId(),at:snapshot.runAt});checker.load(snapshot.entries,snapshot.results as CheckResult[]);
  },[checker.load]);
  const runLive=useCallback(()=>{
    setSavedExampleAt(null);setReviews({});setDecisions({});setMeta({id:newId(),at:new Date().toISOString()});
    void checker.start(checker.rows.map(r=>r.raw),true);
  },[checker.start,checker.rows]);
  const decide = useCallback((id: number, d: Decision | undefined) => {
    const next = {...decisions}; if (d) next[id]=d; else delete next[id];
    setReviews(prev=>retainSentenceReviews(checker.rows,decisions,next,prev)); setDecisions(next);
  }, [decisions,checker.rows]);
  const decideMany = useCallback((patch: Decisions) => {
    const next={...decisions,...patch};
    setReviews(prev=>retainSentenceReviews(checker.rows,decisions,next,prev)); setDecisions(next);
  }, [decisions,checker.rows]);
  const chooseCitation=useCallback((key:string,id:number|undefined)=>{setCiting(prev=>prev?resolveCitation(prev,key,id,checker.rows.map(r=>r.raw)):prev);setReviews({});},[checker.rows]);
  const newCheck = useCallback(() => { checker.reset(); setPendingExtraction(null); setSavedExampleAt(null); setCiting(null); setReviews({}); setExtraction(null); setDecisions({}); setMeta(null); }, [checker.reset]);

  // A finished run is saved on this device. Later decisions update the same entry.
  const rowsRef = useRef(checker.rows); rowsRef.current = checker.rows;
  useEffect(() => {
    if (!meta || (checker.phase !== 'done' && checker.phase !== 'cancelled')) return;
    const rows = rowsRef.current; if (!rows.some(r => r.result)) return;
    const h = setTimeout(() => { void history.put({ id: meta.id, at: meta.at, entries: rows.map(r => r.raw), results: rows.map(r => r.result ?? null), decisions, citing, reviews, savedExampleAt: savedExampleAt ?? undefined, fullDocument:extraction?.fullDocument, cross:extraction?.cross }).then(() => setHistoryVersion(v => v + 1)); }, 250);
    return () => clearTimeout(h);
  }, [checker.phase, checker.rows, decisions, meta, citing, reviews, savedExampleAt, extraction]);

  return useMemo(() => ({ ...checker, chooseCitation, pendingExtraction, setPendingExtraction, extraction, decisions, citing, reviews, reviewSentence, savedExampleAt, loadSample, loadPaper, runLive, meta, text, setText, doi, setDoi, fileText, setFileText, imported, setImported, historyVersion, check, begin, recheck, reopen, loadFixture, decide, decideMany, newCheck }),
    [checker, chooseCitation, pendingExtraction, extraction, decisions, citing, reviews, reviewSentence, savedExampleAt, loadSample, loadPaper, runLive, meta, text, doi, fileText, imported, historyVersion, check, begin, recheck, reopen, loadFixture, decide, decideMany, newCheck]);
}
export type Session = ReturnType<typeof useSession>;
