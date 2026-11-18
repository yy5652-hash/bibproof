/** User testimony is separate from the automated identity verdict. Never feeds matching. */
export interface UserEvidence { url?: string; title: string; authors: string; year: string; venue: string; note: string }
const field = (x: unknown, max: number) => typeof x === 'string' ? x.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0,max) : '';
export function sanitizeUserEvidence(value: unknown): UserEvidence | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string,unknown>; const title = field(v.title,400); const note = field(v.note,2000);
  if (!title || !note) return undefined;
  let url: string | undefined;
  try { const u = new URL(field(v.url,600)); if (['http:','https:'].includes(u.protocol)) url=u.href; } catch { /* metadata and note can stand alone */ }
  return { ...(url ? {url} : {}), title, note, authors:field(v.authors,600), year:field(v.year,20), venue:field(v.venue,400) };
}
export function userEvidenceText(rows: {id:number; result?: {userEvidence?: UserEvidence}}[], heading = 'User-reviewed evidence'): string {
  const entries = rows.filter(r => r.result?.userEvidence);
  if (!entries.length) return '';
  return heading + '\n' + entries.map(r => {
    const e=r.result!.userEvidence!;
    return `#${r.id+1} ${e.title}\n${[e.authors,e.year,e.venue,e.url].filter(Boolean).join(' · ')}\n${e.note}`;
  }).join('\n\n') + '\n';
}
