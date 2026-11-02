// Usage: npx tsx scripts/shots.ts <baseUrl> <outDir>
// Saves 2x screenshots of the main states, answering every index request from the recorded fixtures. Controls that do not exist
// in the build being shot (an older version) are skipped and listed at the end.
import { chromium, devices, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { installMock } from '../tests/e2e/mock';

const [baseArg, outArg] = process.argv.slice(2);
if (!baseArg || !outArg) { console.error('Usage: npx tsx scripts/shots.ts <baseUrl> <outDir>'); process.exit(2); }
const base = baseArg.endsWith('/') ? baseArg : baseArg + '/';
const out = resolve(outArg); mkdirSync(out, { recursive: true });
const saved: string[] = []; const skipped: string[] = [];

async function find(page: Page, selectors: string[], timeout = 4000) {
  for (const sel of selectors) { const l = page.locator(sel).first(); try { await l.waitFor({ state: 'visible', timeout }); return l; } catch { /* try the next */ } }
  return null;
}
async function snap(page: Page, name: string) { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(150); await page.screenshot({ path: join(out, `${name}.png`) }); saved.push(name); }
async function newPage(browser: Browser, opts: Parameters<Browser['newContext']>[0]) {
  const ctx = await browser.newContext({ deviceScaleFactor: 2, locale: 'en-US', ...opts });
  const page = await ctx.newPage(); await installMock(page); return { ctx, page };
}
async function runSample(page: Page, label: string) {
  const btn = await find(page, ['button:has-text("Try a sample")']);
  if (!btn) { skipped.push(`${label}: no "Try a sample" button`); return false; }
  await btn.click();
  try { await page.getByRole('status').filter({ hasText: /8 references checked/ }).waitFor({ timeout: 60_000 }); } catch { skipped.push(`${label}: sample run did not finish in 60 s`); return false; }
  await page.waitForTimeout(400); return true;
}
async function select(page: Page, verdict: string) {
  const row = await find(page, [`[data-testid="row"][data-verdict="${verdict}"] .row-btn`, `.row[data-verdict="${verdict}"] .row-head`], 3000);
  if (row) await row.click(); return Boolean(row);
}

const browser = await chromium.launch();
try {
  {
    const { ctx, page } = await newPage(browser, { viewport: { width: 1280, height: 720 } });
    await page.goto(base); await page.getByRole('heading', { level: 1 }).waitFor(); await page.waitForTimeout(300);
    await snap(page, 'home');
    if (await runSample(page, 'results')) {
      if (await select(page, 'Details differ')) await snap(page, 'results-selected'); else skipped.push('results-selected: no selectable row');
      const bib = await find(page, ['button:has-text("Clean bibliography")'], 1500);
      if (bib) {
        await page.keyboard.press('u'); await page.keyboard.press('j'); await page.keyboard.press('j');
        await select(page, 'No record found'); await page.keyboard.press('x');
        await bib.click(); await page.getByTestId('bibliography').waitFor({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1200); await snap(page, 'decisions');
      } else skipped.push('decisions: no "Clean bibliography" panel in this build');
    }
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage(browser, { ...devices['iPhone 13'], viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
    await page.goto(base); await page.getByRole('heading', { level: 1 }).waitFor(); await page.waitForTimeout(300);
    await snap(page, 'mobile-home');
    if (await runSample(page, 'mobile-results')) { await page.evaluate(() => window.scrollTo(0, 0)); await snap(page, 'mobile-results'); }
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage(browser, { viewport: { width: 1280, height: 720 }, colorScheme: 'dark' });
    await page.goto(base); await page.getByRole('heading', { level: 1 }).waitFor();
    if (await runSample(page, 'dark-results')) { await select(page, 'Details differ'); await snap(page, 'dark-results'); }
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(`saved ${saved.length}: ${saved.join(', ')}`);
console.log(skipped.length ? `skipped ${skipped.length}:\n- ${skipped.join('\n- ')}` : 'skipped: none');
