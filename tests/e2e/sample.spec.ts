import { expect, test, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { INDEX_HOSTS, installMock } from './mock';

const SEVERITY_ORDER = ['Retracted', 'Identifier conflict', 'No record found', 'Details differ', 'Details differ', 'Could not check', 'Verified', 'Verified'];
const verdicts = (page: Page) => page.getByTestId('row').evaluateAll(rows => rows.map(r => (r as HTMLElement).dataset.verdict));
async function runSample(page: Page) {
  await page.getByRole('button', { name: 'Try a sample' }).click();
  await page.getByRole('button', { name: 'Run live checks' }).click();
  await expect(page.getByTestId('saved-example')).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: /8 references checked/ })).toBeVisible({ timeout: 60_000 });
}
const row = (page: Page, verdict: string) => page.locator(`[data-testid="row"][data-verdict="${verdict}"] .row-btn`).first();

test('sample: severity order, filter, evidence, decisions by keyboard, review and export, exports', async ({ page }) => {
  const seen = await installMock(page);
  await page.goto('/');
  await expect(page).toHaveTitle(/Bibproof/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Catch invented references before you submit.');
  await expect(page.getByRole('button', { name: 'Check references' })).toBeDisabled();
  await expect(page.getByRole('tab')).toHaveCount(3);

  await test.step('first result appears within seconds, then all eight, most serious first', async () => {
    const started = Date.now();
    await page.getByRole('button', { name: 'Try a sample' }).click();
    await expect(page.locator('[data-testid="row"][data-verdict="Verified"], [data-testid="row"][data-verdict="Retracted"], [data-testid="row"][data-verdict="Details differ"]').first()).toBeVisible({ timeout: 10_000 });
    expect(Date.now() - started).toBeLessThan(3000);
    await expect(page.getByRole('status').filter({ hasText: /8 references checked/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { level: 2, name: '6 references need action.' })).toBeVisible();
    expect(await verdicts(page)).toEqual(SEVERITY_ORDER);
    const chips = page.getByRole('group', { name: 'Filter by verdict' });
    for (const [name, n] of [['Verified', 2], ['Details differ', 2], ['Identifier conflict', 1], ['Retracted', 1], ['No record found', 1], ['Could not check', 1]] as const)
      await expect(chips.getByRole('button', { name: new RegExp(`^${name} ${n}$`) })).toBeVisible();
  });

  await test.step('document order toggle and verdict filter', async () => {
    await page.getByRole('button', { name: 'Document order' }).click();
    expect((await verdicts(page))[0]).toBe('Verified');
    await page.getByRole('button', { name: 'Severity' }).click();
    await page.getByRole('group', { name: 'Filter by verdict' }).getByRole('button', { name: /^Retracted/ }).click();
    await expect(page.getByTestId('row')).toHaveCount(1);
    await expect(page.getByTestId('row')).toContainText('Wakefield');
    await page.getByRole('group', { name: 'Filter by verdict' }).getByRole('button', { name: /^All/ }).click();
    await expect(page.getByTestId('row')).toHaveCount(8);
  });

  await test.step('evidence pane: field-level comparison, source record, corrected reference', async () => {
    await row(page, 'Details differ').click();
    const ev = page.getByTestId('evidence');
    const grid = ev.getByRole('table', { name: 'Field-level evidence' });
    await expect(grid.locator('.field-row.differ')).toContainText('Year');
    await expect(grid.locator('.field-row.differ')).toContainText('2022');
    await expect(grid.locator('.field-row.differ')).toContainText('2015');
    await expect(ev.locator('.record a').first()).toHaveAttribute('href', /doi\.org\/10\.1038\/nature14539/);
    await expect(ev.locator('.record a').first()).toHaveAttribute('rel', /noopener/);
    await expect(ev.locator('.corrected-text')).toContainText('LeCun', { timeout: 15_000 });
    await ev.locator('summary', { hasText: 'Index trail' }).click();
    await expect(ev.locator('.index-log')).toContainText('Crossref');
  });

  await test.step('decisions with the keyboard: u use record, x remove, ? help', async () => {
    await expect(page.getByTestId('fix-status')).toContainText('0 decided · 6 unresolved');
    await page.keyboard.press('u');
    await expect(page.getByTestId('fix-status')).toContainText('1 decided · 5 unresolved');
    await expect(page.getByTestId('evidence').getByRole('button', { name: 'Use record' })).toHaveAttribute('aria-pressed', 'true');
    await row(page, 'No record found').click();
    const hand = page.getByTestId('evidence').locator('.hand-links a');
    await expect(hand).toHaveCount(4);
    for (const a of await hand.all()) { await expect(a).toHaveAttribute('rel', 'noopener noreferrer'); await expect(a).toHaveAttribute('href', /^https:\/\//); }
    await expect(hand.filter({ hasText: 'CNKI' })).toHaveAttribute('href', /Citation-grounded/);
    await page.keyboard.press('x');
    await expect(page.getByTestId('fix-status')).toContainText('2 decided · 4 unresolved');
    await page.keyboard.press('x'); // pressing again clears it
    await expect(page.getByTestId('fix-status')).toContainText('1 decided · 5 unresolved');
    await page.keyboard.press('x');
    await page.keyboard.press('k'); await page.keyboard.press('j');
    await page.keyboard.press('?');
    await expect(page.getByTestId('shortcuts')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('shortcuts')).toBeHidden();
  });

  await test.step('review and export and change log; .bib holds only the adopted record', async () => {
    await page.getByRole('button', { name: 'Review & export' }).click();
    const panel = page.getByTestId('bibliography');
    await expect(panel.getByTestId('bib-summary')).toHaveText('1 replaced · 1 removed · 6 as written');
    await expect(panel.getByTestId('bib-list')).toContainText('(2015)');
    await expect(panel.getByTestId('bib-list')).not.toContainText('Bennett');
    await expect(panel.getByTestId('change-log')).toContainText('Unresolved, left as written');
    const grab = async (name: string) => { const [d] = await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name }).click()]); return { d, text: readFileSync(await d.path()!, 'utf8') }; };
    const bib = await grab('Download 1 record · 7 omitted (.bib)');
    expect(bib.d.suggestedFilename()).toBe('bibproof-bibliography.bib');
    expect(bib.text).toMatch(/@article\{LeCun2015/);
    expect(bib.text).not.toMatch(/Bennett|Wakefield/);
    expect((await grab('Download 1 record · 7 omitted (.ris)')).text).toMatch(/^TY {2}- /m);
    expect((await grab('Download .txt')).text).toContain('Vaswani');
    await panel.getByLabel('Style').selectOption('harvard1');
    await expect(panel.getByTestId('bib-list')).toContainText('LeCun');
    await page.keyboard.press('Escape');
  });

  await test.step('CSV report still downloads', async () => {
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV report' }).click()]);
    const csv = readFileSync(await d.path()!, 'utf8');
    expect(csv).toContain('"Reference","Verdict"'); expect(csv).toContain('"No record found"');
  });

  await test.step('the saved example contacts no host at all', async () => {
    expect(seen.hosts).toEqual([]);
    expect(new Set(seen.hosts.filter(h => !INDEX_HOSTS.includes(h)))).toEqual(new Set());
  });

  await test.step('methodology view and trust block link', async () => {
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Methodology' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Evidence, not intuition');
    await expect(page.getByText('Six verdicts. No hidden score.')).toBeVisible();
  });
});

test('DOI tab resolves a bare DOI directly', async ({ page }) => {
  await installMock(page);
  await page.goto('/');
  await page.getByRole('tab', { name: 'DOI' }).click();
  await page.getByLabel('DOI or doi.org link').fill('https://doi.org/10.1038/nature14539');
  await page.getByRole('button', { name: 'Check this DOI' }).click();
  await expect(page.getByRole('status').filter({ hasText: /1 reference checked/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('row')).toHaveAttribute('data-verdict', 'Verified');
});

test('citing sentences are found on the device and no document text leaves it', async ({ page }) => {
  const seen = await installMock(page);
  await page.goto('/');
  const doc = `We build on earlier work [1]. The private zebra-quokka-7731 sentence rests on invented work [2]. Nothing else here.\n\nReferences\n[1] He, K., Zhang, X., Ren, S., & Sun, J. (2016). Deep Residual Learning for Image Recognition. https://doi.org/10.1109/CVPR.2016.90\n[2] Wetherquill, Z., & Brindlewick, P. (2023). Chromatic jellyfish calculus for teleporting medieval libraries. Journal of Interplanetary Archival Thermodynamics, 42, 101–119.`;
  await page.getByLabel('References or document').fill(doc);
  await expect(page.getByText(/2 references detected in a full document/)).toBeVisible();
  await page.getByRole('button', { name: 'Check references' }).click();
  await expect(page.getByRole('status').filter({ hasText: /2 references checked/ })).toBeVisible({ timeout: 60_000 });
  await row(page, 'No record found').click();
  await expect(page.getByTestId('evidence').locator('.citing')).toContainText('zebra-quokka-7731');
  await expect(page.locator('details.cross')).toContainText('Numeric style');
  expect(seen.urls.filter(u => /quokka|zebra|earlier%20work/i.test(decodeURIComponent(u)))).toEqual([]);
  expect(seen.bodies.join('')).not.toMatch(/quokka|earlier work/);
  expect(new Set(seen.hosts.filter(h => !INDEX_HOSTS.includes(h)))).toEqual(new Set());
});

test('share link round trip: warning, read-only report, re-check, tampered link', async ({ page }) => {
  await installMock(page);
  await page.goto('/');
  await runSample(page);
  await row(page, 'Details differ').click(); await page.keyboard.press('u');
  await page.getByRole('button', { name: 'Share link' }).click();
  const dialog = page.getByTestId('share-dialog');
  await expect(dialog).toContainText('contains your references');
  const link = await dialog.getByLabel('Link').inputValue();
  expect(link).toContain('#/s/');
  await page.keyboard.press('Escape');

  const fresh = await page.context().newPage(); await installMock(fresh);
  await fresh.goto(link);
  await expect(fresh.getByTestId('shared-banner')).toContainText('Made on');
  await expect(fresh.getByTestId('shared-banner')).toContainText('not been re-checked');
  await expect(fresh.locator('.shared-list li')).toHaveCount(8);
  await expect(fresh.locator('.shared-list')).toContainText('Wakefield');
  await expect(fresh.locator('.shared-list li[data-verdict="Details differ"]').first()).toContainText('Record');
  expect(await fresh.locator('.shared-list a').evaluateAll(as => as.map(a => (a as HTMLAnchorElement).protocol))).toEqual(expect.arrayContaining(['https:']));
  await fresh.getByRole('button', { name: 'Re-check these references' }).click();
  await expect(fresh.getByRole('status').filter({ hasText: /8 references checked/ })).toBeVisible({ timeout: 60_000 });

  const bad = await page.context().newPage();
  await bad.goto(link.slice(0, link.length - 40));
  await expect(bad.getByRole('alert')).toContainText('could not be read');
});

test('history: a finished run is saved, reopened, deleted, and an exported file can be imported', async ({ page }) => {
  await installMock(page);
  await page.goto('/');
  await runSample(page);
  await row(page, 'Details differ').click(); await page.keyboard.press('u');
  await page.waitForTimeout(800);
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'History' }).click();
  await expect(page.getByTestId('history-privacy')).toContainText('this device only');
  await expect(page.getByTestId('history-list').locator('li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /8 references checked/ })).toBeVisible();
  await expect(page.getByTestId('fix-status')).toContainText('1 decided');
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'History' }).click();

  const file = JSON.stringify({ format: 'bibproof-run', version: 1, date: new Date().toISOString(), entries: [{ raw: 'Smith, J. (2020). A title.', verdict: 'No record found' }, { raw: 'Bad link entry', verdict: 'Verified', url: 'javascript:alert(1)' }] });
  await page.locator('input[type=file]').setInputFiles({ name: 'run.bibproof.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  await expect(page.locator('.shared-list li')).toHaveCount(2);
  await expect(page.locator('.shared-list a')).toHaveCount(0);

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'History' }).click();
  await page.getByRole('button', { name: /^Delete/ }).first().click();
  await expect(page.getByText('No saved runs yet')).toBeVisible();
});

test('language toggle: Chinese UI, translated verdicts and explanations, persisted', async ({ page }) => {
  await installMock(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByTestId('lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('找出虚构引用');
  await page.getByRole('button', { name: '试用示例' }).click();
  await expect(page.getByRole('status').filter({ hasText: /已核查 8 条/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('heading', { level: 2, name: '有 6 条需要处理。' })).toBeVisible();
  await row(page, 'Retracted').click();
  await expect(page.getByTestId('evidence')).toContainText('已撤稿');
  await expect(page.getByTestId('evidence')).toContainText('匹配到的文献在索引元数据中被标记为已撤稿');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await page.getByTestId('lang-toggle').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('invented references');
});

test('theme follows the system after load, and an explicit choice sticks', async ({ page }) => {
  await installMock(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await bg()).toBe('rgb(244, 239, 228)');
  await expect(page.getByTestId('theme-toggle')).toHaveAccessibleName('Switch to dark theme');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(bg).toBe('rgb(21, 20, 15)');
  await expect(page.getByTestId('theme-toggle')).toHaveAccessibleName('Switch to light theme');
  await page.getByTestId('theme-toggle').click(); // explicit light
  await expect.poll(bg).toBe('rgb(244, 239, 228)');
  await page.emulateMedia({ colorScheme: 'light' }); await page.emulateMedia({ colorScheme: 'dark' });
  expect(await bg()).toBe('rgb(244, 239, 228)');
});

test('300 references stay smooth: only a window of rows is in the page', async ({ page }) => {
  await page.goto('/?fixture=300');
  await expect(page.getByRole('heading', { level: 2 }).first()).toContainText('need action');
  const count = () => page.getByTestId('row').count();
  expect(await count()).toBeGreaterThan(5); expect(await count()).toBeLessThan(60);
  const t = await page.getByTestId('list-scroll').evaluate(async el => {
    const t0 = performance.now(); let frames = 0;
    for (let y = 0; y <= el.scrollHeight; y += 1200) { el.scrollTop = y; await new Promise(r => requestAnimationFrame(r)); frames++; }
    return { ms: performance.now() - t0, frames };
  });
  expect(t.ms / t.frames).toBeLessThan(120);
  expect(await count()).toBeLessThan(60);
  await page.getByTestId('list-scroll').evaluate(el => { el.scrollTop = 0; });
  await page.locator('[data-testid="row"] .row-btn').first().click();
  for (let i = 0; i < 12; i++) await page.keyboard.press('j');
  await expect(page.getByTestId('evidence')).toBeVisible();
});

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  test('no horizontal scroll, input above the fold, evidence opens as a bottom sheet, touch targets', async ({ page }) => {
    await installMock(page);
    await page.goto('/');
    // The root clips overflow, so also measure what actually sticks out: every visible box must end inside the viewport
    // (the verdict chip row scrolls inside its own container, which is the one allowed exception).
    const overflow = () => page.evaluate(() => {
      const w = window.innerWidth; let worst = document.documentElement.scrollWidth - w;
      for (const el of document.querySelectorAll('main *, header *, footer *')) {
        if (el.closest('.filters')) continue;
        const r = el.getBoundingClientRect(); if (r.width && r.height) worst = Math.max(worst, Math.ceil(r.right - w));
      }
      return worst;
    });
    expect(await overflow()).toBeLessThanOrEqual(0);
    const fold = await page.getByRole('button', { name: 'Check references' }).boundingBox();
    expect(fold!.y + fold!.height).toBeLessThan(812);
    for (const b of await page.locator('button:visible, a.icon-button:visible, [role=tab]:visible').all()) { const box = await b.boundingBox(); expect(box!.height, await b.innerText()).toBeGreaterThanOrEqual(40); }
    await runSample(page);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.locator('[data-testid="row"][data-verdict="Details differ"] .row-btn').first().click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('evidence')).toContainText('A matching work exists');
    await sheet.getByRole('button', { name: 'Use record' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('fix-status')).toContainText('1 decided');
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
});

const PAPER = ['Introduction', 'Deep networks changed vision research [1]. Attention models later replaced recurrence [2].', 'References', '[1] He, K., Zhang, X., Ren, S., & Sun, J. (2016). Deep residual learning for image recognition. CVPR.', '[2] Vaswani, A., et al. (2017). Attention is all you need. NeurIPS.'];

function pdfBytes(lines: string[]) {
  const content = `BT /F1 10 Tf 40 760 Td 14 TL ${lines.map(l => `(${l.replace(/([()\\])/g, '\\$1')}) Tj T*`).join(' ')} ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const offsets: number[] = [];
  objects.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
async function docxBytes(lines: string[]) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.map(l => `<w:p><w:r><w:t>${esc(l)}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}
for (const kind of ['pdf', 'docx'] as const) {
  test(`a real .${kind} is read on the device and its references found`, async ({ page }) => {
    await installMock(page);
    await page.goto('/');
    await page.getByRole('tab', { name: 'File' }).click();
    const buffer = kind === 'pdf' ? pdfBytes(PAPER) : await docxBytes(PAPER);
    await page.locator('input[type=file]').first().setInputFiles({ name: `paper.${kind}`, mimeType: kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer });
    await expect(page.getByText(`paper.${kind} was read on this device`)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('2 references detected in a full document')).toBeVisible();
  });
}
