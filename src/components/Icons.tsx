import type { SVGProps } from 'react';
import type { Verdict } from '../core/types';
const base: SVGProps<SVGSVGElement> = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false };
type P = SVGProps<SVGSVGElement>;
export const IconCheck = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="9.5" /><path d="M7.8 12.4l3 3 5.4-6.2" /></svg>;
export const IconDiffer = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="9.5" /><path d="M8 10h8M8 14h8M9 18l6-12" /></svg>;
export const IconConflict = (p: P) => <svg {...base} {...p}><path d="M4 8h13l-3-3M20 16H7l3 3" /></svg>;
export const IconRetracted = (p: P) => <svg {...base} {...p}><path d="M6 3h8l4 4v14H6z" /><path d="M3 12h18" /></svg>;
export const IconNoRecord = (p: P) => <svg {...base} {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.9-4.9M8 8l5 5M13 8l-5 5" /></svg>;
export const IconUnchecked = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="9.5" strokeDasharray="3 3.2" /><path d="M8.5 12h7" /></svg>;
export const IconUpload = (p: P) => <svg {...base} {...p}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>;
export const IconDownload = (p: P) => <svg {...base} {...p}><path d="M12 4v12M7 11l5 5 5-5M4 20h16" /></svg>;
export const IconCopy = (p: P) => <svg {...base} {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></svg>;
export const IconPrint = (p: P) => <svg {...base} {...p}><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" /></svg>;
export const IconChevron = (p: P) => <svg {...base} {...p}><path d="M9 6l6 6-6 6" /></svg>;
export const IconSun = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
export const IconMoon = (p: P) => <svg {...base} {...p}><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" /></svg>;
export const IconGithub = (p: P) => <svg {...base} {...p} viewBox="0 0 16 16" fill="currentColor" stroke="none"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>;
export const IconStop = (p: P) => <svg {...base} {...p}><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>;
export const IconFile = (p: P) => <svg {...base} {...p}><path d="M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6" /></svg>;
export const IconSpinner = (p: P) => <svg {...base} {...p} className={`spin ${p.className ?? ''}`}><path d="M12 3a9 9 0 019 9" /></svg>;

export const verdictMeta: Record<Verdict, { slug: string; Icon: (p: P) => React.JSX.Element; short: string }> = {
  'Verified': { slug: 'verified', Icon: IconCheck, short: 'Record found; title and authors agree' },
  'Details differ': { slug: 'differ', Icon: IconDiffer, short: 'The work exists; some fields disagree' },
  'Identifier conflict': { slug: 'conflict', Icon: IconConflict, short: 'The DOI or arXiv id points at a different work' },
  'Retracted': { slug: 'retracted', Icon: IconRetracted, short: 'The matched work has been retracted' },
  'No record found': { slug: 'norecord', Icon: IconNoRecord, short: 'Nothing close in any index that answered' },
  'Could not check': { slug: 'unchecked', Icon: IconUnchecked, short: 'Not enough coverage to say either way' },
};
export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const { slug, Icon } = verdictMeta[verdict];
  return <span className={`badge v-${slug}`}><Icon /><span>{verdict}</span></span>;
}
