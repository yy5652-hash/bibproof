import type { UserEvidence } from './userEvidence';
export const VERDICTS = ['Verified', 'Details differ', 'Identifier conflict', 'Retracted', 'No record found', 'Could not check'] as const;
export type Verdict = typeof VERDICTS[number];
export type IndexName = 'Crossref' | 'DataCite' | 'OpenAlex' | 'Europe PMC' | 'Open Library';
export interface Author { family: string; given?: string }
export interface Work {
  id: string; title: string; retrievalTitle?:string; authors: Author[]; year?: number; venue?: string;
  doi?: string; url: string; source: IndexName; retracted?: boolean; retractionUrls?: string[];
  type?: string; volume?: string; issue?: string; pages?: string; publisher?: string; isbn?: string[];
}
export interface ParsedReference {
  raw: string; label?: string; doi?: string; arxiv?: string; pmid?: string; url?: string;
  authors?: Author[]; authorsTruncated?: boolean; publisher?: string; isbn?: string;
  year?: number; yearSuffix?: string; surnames: string[]; title: string; identityTitle?: string; venue?: string;
  kind: 'scholarly' | 'book' | 'unsupported' | 'unknown';
}
export interface IndexEvidence {
  index: IndexName; status: 'answered' | 'failed' | 'skipped'; url: string;
  count: number; cached?: boolean; detail?: string;
}
export interface FieldEvidence { field: string; written: string; record: string; status: 'agree' | 'differ' | 'tolerance' | 'unknown' }
export interface Score { title: number; authors: number; year: number; venue: number; locator?: boolean; total: number; fields: FieldEvidence[] }
export interface CheckResult {
  userEvidence?: UserEvidence;
  reference: ParsedReference; verdict: Verdict; explanation: string; evidence: IndexEvidence[];
  match?: Work; nearest?: Work; identifierRecord?: Work; alternatives?: Work[]; score?: Score; checkedAt: string;
}
export interface Cache { get(key: string): Promise<unknown | undefined>; set(key: string, value: unknown): Promise<void>; clear?(): Promise<void> }
