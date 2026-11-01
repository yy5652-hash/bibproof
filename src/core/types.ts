export const VERDICTS = ['Verified', 'Details differ', 'Identifier conflict', 'Retracted', 'No record found', 'Could not check'] as const;
export type Verdict = typeof VERDICTS[number];
export type IndexName = 'Crossref' | 'DataCite' | 'OpenAlex' | 'Europe PMC' | 'Open Library';
export interface Author { family: string; given?: string }
export interface Work {
  id: string; title: string; authors: Author[]; year?: number; venue?: string;
  doi?: string; url: string; source: IndexName; retracted?: boolean; retractionUrls?: string[];
  type?: string; volume?: string; issue?: string; pages?: string; publisher?: string;
}
export interface ParsedReference {
  raw: string; label?: string; doi?: string; arxiv?: string; pmid?: string; url?: string;
  year?: number; yearSuffix?: string; surnames: string[]; title: string; venue?: string;
  kind: 'scholarly' | 'book' | 'unsupported' | 'unknown';
}
export interface IndexEvidence {
  index: IndexName; status: 'answered' | 'failed' | 'skipped'; url: string;
  count: number; cached?: boolean; detail?: string;
}
export interface FieldEvidence { field: string; written: string; record: string; status: 'agree' | 'differ' | 'unknown' }
export interface Score { title: number; authors: number; year: number; venue: number; locator?: boolean; total: number; fields: FieldEvidence[] }
export interface CheckResult {
  reference: ParsedReference; verdict: Verdict; explanation: string; evidence: IndexEvidence[];
  match?: Work; nearest?: Work; identifierRecord?: Work; score?: Score; checkedAt: string;
}
export interface Cache { get(key: string): Promise<unknown | undefined>; set(key: string, value: unknown): Promise<void>; clear?(): Promise<void> }
