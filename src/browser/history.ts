import type { Citing } from '../core/citing';
import type { SentenceReviews } from '../core/repairs';
import type { CheckResult } from '../core/types';
import type { Decisions } from '../core/decisions';

/** One saved run. Holds the reference strings and results, only citing sentences, never the full document body. */
export interface StoredRun { id: string; at: string; entries: string[]; results: (CheckResult | null)[]; decisions: Decisions; citing?: Citing | null; reviews?: SentenceReviews; savedExampleAt?: string }
export const MAX_RUNS = 50;

function valid(r: unknown): r is StoredRun {
  const o = r as StoredRun | undefined;
  return Boolean(o && typeof o.id === 'string' && typeof o.at === 'string' && Array.isArray(o.entries) && Array.isArray(o.results) && o.entries.length === o.results.length && o.entries.every(e => typeof e === 'string') && o.decisions && typeof o.decisions === 'object');
}

/** IndexedDB history, separate from the HTTP cache. Every call survives blocked storage: it falls back to memory for this tab. */
export class HistoryStore {
  private memory = new Map<string, StoredRun>();
  private db?: Promise<IDBDatabase>;
  /** Runs deleted in this tab. The open session may still hold one, and its later saves must not bring it back. */
  private removed = new Set<string>();
  /** True once storage failed and the history only lives in this tab. */
  blocked = false;
  private open() {
    this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      try {
        if (!globalThis.indexedDB) { reject(new Error('Storage unavailable')); return; }
        const r = indexedDB.open('bibproof-history', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('runs', { keyPath: 'id' });
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.onblocked = () => reject(new Error('Storage blocked'));
      } catch (e) { reject(e); }
    });
    void this.db.catch(() => {});
    return this.db;
  }
  private async tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('runs', mode); const req = run(tx.objectStore('runs'));
      tx.oncomplete = () => resolve(req.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }
  async list(): Promise<StoredRun[]> {
    let rows: StoredRun[] = [];
    try { rows = (await this.tx('readonly', s => s.getAll())) as StoredRun[]; this.blocked = false; } catch { this.blocked = true; }
    const merged = new Map<string, StoredRun>(this.memory);
    for (const r of rows) if (valid(r)) merged.set(r.id, r);
    return [...merged.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_RUNS);
  }
  async put(run: StoredRun): Promise<void> {
    if (this.removed.has(run.id)) return;
    this.memory.set(run.id, run);
    try { await this.tx('readwrite', s => s.put(run)); this.memory.delete(run.id); }
    catch { this.blocked = true; }
    const all = await this.list();
    for (const old of all.slice(MAX_RUNS)) await this.remove(old.id);
  }
  async get(id: string): Promise<StoredRun | undefined> { return (await this.list()).find(r => r.id === id); }
  async remove(id: string): Promise<void> {
    this.removed.add(id); this.memory.delete(id);
    try { await this.tx('readwrite', s => s.delete(id)); } catch { /* storage blocked: memory copy already gone */ }
  }
  async clear(): Promise<void> {
    for (const r of await this.list()) this.removed.add(r.id);
    this.memory.clear();
    try { await this.tx('readwrite', s => s.clear()); } catch { /* storage blocked: nothing persisted */ }
  }
}
export const history = new HistoryStore();
