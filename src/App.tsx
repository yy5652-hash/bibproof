import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import Home from './components/Home';
import Workspace from './components/Workspace';
import History from './components/History';
import PrintReport from './components/PrintReport';
import { SharedReport } from './components/Share';
import { Footer, HowItWorks, Privacy, Trust } from './components/Sections';
import { IconGithub, IconMoon, IconSun } from './components/Icons';
import { decodeShare } from './core/share';
import { useI18n } from './i18n';
import { useMediaQuery } from './useMediaQuery';
import { useSession } from './useSession';

const Methodology = lazy(() => import('./components/Methodology'));
type Page = 'home' | 'methodology' | 'history' | 'shared' | 'report';
const read = (): { page: Page; payload: string } => {
  const h = location.hash;
  if (h.startsWith('#/methodology')) return { page: 'methodology', payload: '' };
  if (h.startsWith('#/history')) return { page: 'history', payload: '' };
  if (h.startsWith('#/report')) return { page: 'report', payload: '' };
  if (h.startsWith('#/s/')) return { page: 'shared', payload: h.slice(4) };
  return { page: 'home', payload: '' };
};

/** An explicit choice wins; otherwise the page follows the system and keeps following it when the system changes. */
function useTheme() {
  const system = useMediaQuery('(prefers-color-scheme: dark)');
  const [explicit, setExplicit] = useState<'light' | 'dark' | null>(() => { const t = document.documentElement.dataset.theme; return t === 'light' || t === 'dark' ? t : null; });
  useEffect(() => { if (explicit) document.documentElement.dataset.theme = explicit; else delete document.documentElement.dataset.theme; }, [explicit]);
  const theme = explicit ?? (system ? 'dark' : 'light');
  return { theme, toggle: () => { const next = theme === 'dark' ? 'light' : 'dark'; setExplicit(next); try { localStorage.setItem('bibproof-theme', next); } catch { /* storage may be blocked */ } } };
}

export default function App() {
  const s = useSession();
  const { t, lang, setLang } = useI18n();
  const [route, setRoute] = useState(read());
  const { theme, toggle } = useTheme();
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0); };
    addEventListener('hashchange', on); return () => removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    document.title = t(route.page === 'methodology' ? 'title.method' : route.page === 'history' ? 'title.history' : route.page === 'shared' || route.page === 'report' ? 'title.shared' : 'title.home');
  }, [route.page, lang, t]);
  // Development only: ?fixture=300 loads a finished synthetic run to check scrolling with many references.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const n = Number(new URLSearchParams(location.search).get('fixture'));
    if (n > 0) void import('./dev/fixture').then(m => { const f = m.fixtureRun(Math.min(n, 2000)); s.loadFixture(f.entries, f.results); });
  }, []);
  const shared = useMemo(() => (route.page === 'shared' ? decodeShare(route.payload) : undefined), [route]);
  const hasRun = s.rows.length > 0;
  const nav = (page: Page, label: string, href: string) => <a href={href} aria-current={route.page === page ? 'page' : undefined}>{label}</a>;

  return (
    <>
      <a className="skip" href="#main">{t('skip')}</a>
      <header className="site-header no-print">
        <div className="wrap header-row">
          <a className="brand" href="#/" aria-label={t('brand.home')}>
            <svg viewBox="0 0 64 64" width="26" height="26" aria-hidden="true"><rect width="64" height="64" rx="14" fill="currentColor" /><path d="M17 33.5l10.5 10.5L47 20" fill="none" stroke="var(--paper)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M15 52h34" stroke="var(--accent-soft)" strokeWidth="4" strokeLinecap="round" /></svg>
            <span>Bibproof</span>
          </a>
          <nav aria-label={t('nav.primary')}>
            {nav('home', t('nav.check'), '#/')}
            {nav('history', t('nav.history'), '#/history')}
            {nav('methodology', t('nav.method'), '#/methodology')}
          </nav>
          <div className="header-tools">
            <button className="icon-button text-button" onClick={() => setLang(lang === 'en' ? 'zh-CN' : 'en')} aria-label={t('lang.aria')} lang={lang === 'en' ? 'zh-CN' : 'en'} data-testid="lang-toggle">{t('lang.toggle')}</button>
            <button className="icon-button" onClick={toggle} aria-label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')} data-testid="theme-toggle">{theme === 'dark' ? <IconSun /> : <IconMoon />}</button>
            <a className="icon-button" href="https://github.com/yy5652-hash/bibproof" aria-label={t('github')}><IconGithub width={18} height={18} /></a>
          </div>
        </div>
      </header>
      <main id="main" className={`wrap${route.page === 'home' && hasRun ? ' wide' : ''}`}>
        {route.page === 'home' && (hasRun
          ? <><Workspace s={s} /><PrintReport rows={s.rows} extraction={s.extraction} /></>
          : <><Home s={s} /><div className="no-print"><HowItWorks /><Trust /><Privacy onClear={s.clearCache} /></div></>)}
        {route.page === 'history' && <History s={s} onOpen={() => { location.hash = '#/'; }} />}
        {(route.page === 'shared' || route.page === 'report') && <SharedReport run={route.page === 'shared' ? shared : s.imported ?? undefined} onRecheck={entries => { s.recheck(entries); location.hash = '#/'; }} />}
        {route.page === 'methodology' && <Suspense fallback={<p className="muted">{t('loading')}</p>}><Methodology /></Suspense>}
      </main>
      <Footer />
    </>
  );
}
