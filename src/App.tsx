import { lazy, Suspense, useEffect, useState } from 'react';
import Tool from './components/Tool';
import { Footer, HowItWorks, Privacy } from './components/Sections';
import { IconGithub, IconMoon, IconSun } from './components/Icons';
import { BrowserCache } from './browser/cache';

const Methodology = lazy(() => import('./components/Methodology'));
const route = () => (location.hash.startsWith('#/methodology') ? 'methodology' : 'home');

function useTheme() {
  const system = () => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (document.documentElement.dataset.theme as 'light' | 'dark') || system());
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return { theme, toggle: () => { const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); try { localStorage.setItem('bibproof-theme', next); } catch { /* storage may be blocked */ } } };
}

export default function App() {
  const [page, setPage] = useState(route());
  const { theme, toggle } = useTheme();
  useEffect(() => {
    const on = () => { setPage(route()); window.scrollTo(0, 0); };
    addEventListener('hashchange', on); return () => removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { document.title = page === 'methodology' ? 'Methodology · Bibproof' : 'Bibproof · Check every reference'; }, [page]);
  const clear = async () => { await new BrowserCache().clear(); };
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header no-print">
        <div className="wrap header-row">
          <a className="brand" href="#/" aria-label="Bibproof, home">
            <svg viewBox="0 0 64 64" width="26" height="26" aria-hidden="true"><rect width="64" height="64" rx="14" fill="currentColor" /><path d="M17 33.5l10.5 10.5L47 20" fill="none" stroke="var(--paper)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M15 52h34" stroke="var(--accent-soft)" strokeWidth="4" strokeLinecap="round" /></svg>
            <span>Bibproof</span>
          </a>
          <nav aria-label="Primary">
            <a href="#/" aria-current={page === 'home' ? 'page' : undefined}>Check</a>
            <a href="#/methodology" aria-current={page === 'methodology' ? 'page' : undefined}>Methodology</a>
            <a className="icon-link" href="https://github.com/yy5652-hash/bibproof" aria-label="Bibproof on GitHub"><IconGithub width={18} height={18} /></a>
            <button className="icon-button" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>{theme === 'dark' ? <IconSun /> : <IconMoon />}</button>
          </nav>
        </div>
      </header>
      <main id="main" className="wrap">
        {page === 'home' ? <><Tool /><div className="no-print"><HowItWorks /><Privacy onClear={clear} /></div></> : <Suspense fallback={<p className="muted">Loading…</p>}><Methodology /></Suspense>}
      </main>
      <Footer />
    </>
  );
}
