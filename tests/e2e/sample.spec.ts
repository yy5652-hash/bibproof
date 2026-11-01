import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Real index responses recorded once for the eight sample entries (trimmed); the one OpenAlex search that hit the daily
// keyless budget while recording is set to the empty result list it returned on an earlier run. The test never touches the network.
const recorded: Record<string, { status: number; body: unknown }> = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/sample-responses.json', import.meta.url)), 'utf8'));
const INDEX_HOSTS = ['api.crossref.org', 'api.datacite.org', 'api.openalex.org', 'www.ebi.ac.uk', 'openlibrary.org'];

test('sample: every verdict appears, evidence expands, exports download, nothing leaves except reference lookups', async ({ page }) => {
  const outbound: string[] = [];
  await page.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), async route => {
    const url = route.request().url(); outbound.push(new URL(url).host);
    const hit = recorded[url];
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (hit) return route.fulfill({ status: hit.status, headers, body: JSON.stringify(hit.body ?? {}) });
    // Anything unrecorded behaves like a healthy index with nothing to say.
    const u = new URL(url);
    const body = u.host === 'api.crossref.org' ? (u.pathname.startsWith('/works/') ? null : { message: { items: [] } }) : u.host === 'api.openalex.org' ? (u.pathname.startsWith('/works/') ? null : { results: [] }) : u.host === 'www.ebi.ac.uk' ? { resultList: { result: [] } } : { docs: [] };
    return route.fulfill(body ? { status: 200, headers, body: JSON.stringify(body) } : { status: 404, headers, body: '{}' });
  });

  await page.goto('/');
  await expect(page).toHaveTitle(/Bibproof/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Every reference');
  await expect(page.getByRole('button', { name: 'Check references' })).toBeDisabled();

  await test.step('run the sample and see all six verdicts in order', async () => {
    await page.getByRole('button', { name: 'Try a sample' }).click();
    await expect(page.getByRole('status').filter({ hasText: /8 references checked/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.row')).toHaveCount(8);
    const verdicts = await page.locator('.row').evaluateAll(rows => rows.map(r => (r as HTMLElement).dataset.verdict));
    expect(verdicts).toEqual(['Verified', 'Verified', 'Details differ', 'Details differ', 'Identifier conflict', 'No record found', 'Retracted', 'Could not check']);
    for (const [name, n] of [['Verified', 2], ['Details differ', 2], ['Identifier conflict', 1], ['Retracted', 1], ['No record found', 1], ['Could not check', 1]] as const)
      await expect(page.getByRole('group', { name: 'Filter by verdict' }).getByRole('button', { name: new RegExp(`^${name} ${n}$`) })).toBeVisible();
  });

  await test.step('filter by verdict', async () => {
    await page.getByRole('group', { name: 'Filter by verdict' }).getByRole('button', { name: /^Retracted/ }).click();
    await expect(page.locator('.row')).toHaveCount(1);
    await expect(page.locator('.row')).toContainText('Wakefield');
    await page.getByRole('group', { name: 'Filter by verdict' }).getByRole('button', { name: /^All/ }).click();
    await expect(page.locator('.row')).toHaveCount(8);
  });

  await test.step('expand field-level evidence and the corrected reference', async () => {
    const differ = page.locator('.row').nth(2);
    await differ.getByRole('button').click();
    const grid = differ.getByRole('table', { name: 'Field-level evidence' });
    await expect(grid).toBeVisible();
    await expect(grid.locator('.field-row.differ')).toContainText('Year');
    await expect(grid.locator('.field-row.differ')).toContainText('2022');
    await expect(grid.locator('.field-row.differ')).toContainText('2015');
    await expect(differ.locator('.index-log')).toContainText('Crossref');
    await expect(differ.locator('.corrected-text')).toContainText('LeCun', { timeout: 15_000 });
    await expect(differ.locator('.corrected-text')).toContainText('2015');
    await expect(differ.locator('.record a')).toHaveAttribute('href', /doi\.org\/10\.1038\/nature14539/);
    await differ.getByRole('button', { name: /Hide evidence/ }).click();
    await expect(grid).toBeHidden();
  });

  await test.step('export corrected .bib, .ris and a CSV report', async () => {
    const grab = async (name: string) => { const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name }).click()]); return { d, text: readFileSync(await d.path()!, 'utf8') }; };
    const bib = await grab('Corrected .bib');
    expect(bib.d.suggestedFilename()).toBe('bibproof-corrected.bib');
    expect(bib.text).toMatch(/@article\{Vaswani2017/);
    expect(bib.text).not.toMatch(/Wetherquill|Wakefield/); // fabricated and retracted entries are never exported as "corrected"
    const ris = await grab('Corrected .ris');
    expect(ris.text).toMatch(/^TY {2}- /m);
    const csv = await grab('CSV report');
    expect(csv.text).toContain('"Reference","Verdict"');
    expect(csv.text).toContain('"No record found"');
  });

  await test.step('only scholarly index hosts were contacted', async () => {
    expect(outbound.length).toBeGreaterThan(0);
    expect(new Set(outbound.filter(h => !INDEX_HOSTS.includes(h)))).toEqual(new Set());
  });

  await test.step('methodology view', async () => {
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Methodology' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Evidence, not intuition');
    await expect(page.getByText('Six verdicts. No hidden score.')).toBeVisible();
  });
});
