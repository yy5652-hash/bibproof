import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { installMock } from './mock';
import { sampleEntries } from '../../src/core/sample';
const pick = (page:Page, id:number) => page.locator(`[data-testid="row"][data-id="${id}"] .row-btn`);
async function saved(page:Page) {
  await page.goto('/'); await page.getByRole('button',{name:'Try a sample'}).click();
  await expect(page.getByTestId('saved-example')).toContainText('Saved example, checked on');
}
async function downloadText(page:Page, name:string) {
  const [d]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name,exact:true}).click()]);
  return readFileSync((await d.path())!,'utf8');
}

test('1a cancel, history and share preserve unchecked rows without an all-clear', async ({page}) => {
  await installMock(page);
  let release!:()=>void; const held=new Promise<void>(r=>{release=r;});
  await page.route('**/*',async route=>{
    const u=decodeURIComponent(route.request().url());
    if (u.includes('api.crossref.org/works/') && /10\.1038\/nature14539|10\.1016\/s0140/i.test(u)) {
      await held; return route.abort();
    }
    return route.fallback();
  });
  try {
    await page.goto('/');
    await page.getByLabel('References or document').fill([sampleEntries[1].raw,sampleEntries[2].raw,sampleEntries[6].raw].join('\n\n'));
    await page.getByRole('button',{name:'Check references',exact:true}).click();
    await expect(pick(page,0)).toBeEnabled();
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(page.locator('#results-h')).toHaveText('1 checked · 2 not checked');
    await expect(page.getByText('All 3 references are verified.')).toHaveCount(0);
    await page.getByRole('link',{name:'History',exact:true}).click();
    await page.getByRole('button',{name:'Open',exact:true}).click();
    await expect(page.locator('#results-h')).toHaveText('1 checked · 2 not checked');
    await page.getByRole('button',{name:'Share link',exact:true}).click();
    const link=await page.getByLabel('Link',{exact:true}).inputValue();
    await page.goto(link);
    await expect(page.locator('.shared-list li')).toHaveCount(3);
    await expect(page.getByText('1 checked · 2 not checked')).toBeVisible();
    await expect(page.locator('.shared-list').getByText('Not checked',{exact:true})).toHaveCount(2);
  } finally {release();}
});

test('3A removal, replacement, sentence decisions and numeric map survive review and history', async ({page}) => {
  await installMock(page); await page.goto('/');
  const doc=`First claim [1]. Unsupported claim [2]. Last claim [3].\n\nReferences\n[1] ${sampleEntries[2].raw}\n[2] ${sampleEntries[5].raw}\n[3] ${sampleEntries[1].raw}`;
  await page.getByLabel('References or document').fill(doc); await page.getByRole('button',{name:'Check references',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'3 references checked.'})).toBeVisible();
  await pick(page,0).click(); await page.getByTestId('evidence').getByRole('button',{name:'Use record',exact:true}).click();
  await expect(page.getByTestId('repair-sentences')).toContainText('This decision affects 1 sentence');
  await page.getByTestId('repair-sentences').getByLabel('Sentence action').selectOption('keep');
  await pick(page,1).click(); await page.getByTestId('evidence').getByRole('button',{name:'Remove',exact:true}).click();
  await page.getByTestId('repair-sentences').getByLabel('Sentence action').selectOption('remove');
  await page.getByRole('button',{name:'Review & export',exact:true}).click();
  const panel=page.getByTestId('bibliography');
  await expect(panel).toContainText('[2] → Removed'); await expect(panel).toContainText('[3] → [2]');
  await expect(panel).toContainText('citations needing edits');
  await expect(panel.getByTestId('repair-sentences')).toContainText('Last claim [3].');
  const manuscript=await downloadText(page,'Download manuscript edits .txt');
  expect(manuscript).toContain('Unsupported claim [2].'); expect(manuscript).toContain('[3] → [2]');
  expect(await downloadText(page,'Download change log')).toContain('Manuscript edits');
  await page.keyboard.press('Escape');
  await page.getByRole('link',{name:'History',exact:true}).click(); await page.getByRole('button',{name:'Open',exact:true}).click();
  await pick(page,1).click(); await expect(page.getByTestId('repair-sentences').getByLabel('Sentence action')).toHaveValue('remove');
});

test('3C saved example uses no index requests; live button rechecks the same entries', async ({page}) => {
  const seen=await installMock(page); await saved(page);
  expect(seen.hosts).toEqual([]);
  await expect(page.getByTestId('saved-example')).toContainText('constructed demonstration errors');
  await expect(page.getByTestId('row')).toHaveCount(8);
  await page.getByRole('button',{name:'Run live checks',exact:true}).click();
  await expect(page.getByTestId('saved-example')).toHaveCount(0);
  await expect(page.getByRole('status').filter({hasText:'8 references checked.'})).toBeVisible({timeout:60_000});
  expect(seen.hosts.length).toBeGreaterThan(0);
  for(let i=0;i<sampleEntries.length;i++) await expect(page.locator(`[data-testid="row"][data-id="${i}"]`)).toHaveAttribute('data-verdict',sampleEntries[i].kind);
  const requests=seen.urls.length;
  await page.getByRole('button',{name:'New check',exact:true}).click();
  await page.getByRole('button',{name:'Try a sample',exact:true}).click();
  await page.getByRole('button',{name:'Run live checks',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'8 references checked.'})).toBeVisible({timeout:60_000});
  expect(seen.urls.length).toBeGreaterThan(requests); // Live bypasses stored responses, not provider budgets.
});

test('3D manual evidence keeps verdict and persists in history, share, CSV, text and change log', async ({page}) => {
  await installMock(page); await saved(page); await pick(page,5).click();
  await page.getByRole('button',{name:'I found this source',exact:true}).click();
  await page.getByLabel('Source URL (optional)').fill('https://example.org/paper');
  await page.getByLabel('Source title',{exact:true}).fill('Manually located title');
  await page.getByLabel('Authors',{exact:true}).fill('Chen, L.');
  await page.getByLabel('Evidence note').fill('Publisher archive checked by the user.');
  await page.getByRole('button',{name:'Save evidence',exact:true}).click();
  await expect(page.locator('[data-testid="row"][data-id="5"]')).toHaveAttribute('data-verdict','No record found');
  await expect(page.getByTestId('evidence').getByTestId('user-evidence')).toContainText('User-reviewed evidence');
  expect(await downloadText(page,'CSV report')).toContain('Publisher archive checked by the user.');
  await page.getByRole('button',{name:'Review & export',exact:true}).click();
  expect(await downloadText(page,'Download .txt')).toContain('Manually located title');
  expect(await downloadText(page,'Download change log')).toContain('Publisher archive checked by the user.');
  await page.keyboard.press('Escape');
  await page.getByRole('link',{name:'History',exact:true}).click(); await page.getByRole('button',{name:'Open',exact:true}).click();
  await pick(page,5).click(); await expect(page.getByTestId('evidence').getByTestId('user-evidence')).toContainText('Manually located title');
  await page.getByRole('button',{name:'Share link',exact:true}).click(); const link=await page.getByLabel('Link',{exact:true}).inputValue(); await page.goto(link);
  await expect(page.locator('.shared-list li[data-verdict="No record found"]')).toContainText('Manually located title');
});

for(const chinese of [false,true]) test(`new screens fit 375 px and keyboard controls work (${chinese?'zh-CN':'English'})`, async ({page})=>{
  await page.setViewportSize({width:375,height:812}); await installMock(page); await saved(page);
  if(chinese) await page.getByTestId('lang-toggle').click();
  await pick(page,5).click();
  await page.getByRole('button',{name:chinese?'我找到了这个来源':'I found this source',exact:true}).click();
  await page.getByLabel(chinese?'来源标题':'Source title',{exact:true}).fill('A long title '.repeat(25));
  const overflow=()=>page.evaluate(()=>{
    const w=innerWidth; let worst=document.documentElement.scrollWidth-w;
    for(const el of document.querySelectorAll('[role="dialog"] *')) {
      const r=el.getBoundingClientRect(); if(r.width&&r.height) worst=Math.max(worst,Math.ceil(r.right-w),Math.ceil(-r.left));
    }
    return worst;
  });
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:chinese?'检查并导出':'Review & export',exact:true}).click();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.keyboard.press('Escape'); await expect(page.getByTestId('bibliography')).toBeHidden();
  await page.getByRole('button',{name:chinese?'重新核查':'New check',exact:true}).click();
  await page.getByLabel(chinese?'参考文献或整篇文档':'References or document').fill(`One claim [1]. Another claim [2].\n\nReferences\n[1] ${sampleEntries[1].raw}\n[2] ${sampleEntries[2].raw}`);
  await page.getByRole('button',{name:chinese?'核查参考文献':'Check references',exact:true}).click();
  await expect(pick(page,0)).toBeEnabled(); await pick(page,0).click();
  await page.getByTestId('evidence').getByRole('button',{name:chinese?'删除':'Remove',exact:true}).click();
  const action=page.getByTestId('repair-sentences').getByLabel(chinese?'句子处理':'Sentence action');
  await action.focus(); await expect(action).toBeFocused(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Tab');
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:chinese?'检查并导出':'Review & export',exact:true}).click();
  await expect(page.getByTestId('bibliography').getByTestId('repair-sentences')).toContainText('Another claim [2].');
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test('3B retry unavailable preserves finished results, decisions and manual evidence', async ({page})=>{
  const seen=await installMock(page); let unavailable=true;
  await page.route('https://api.crossref.org/works?**', async route=> {
    const raw=new URL(route.request().url()).searchParams.get('query.bibliographic')??'';
    if(unavailable && raw.includes('Citation-grounded')) return route.fulfill({status:403,body:'{}',headers:{'access-control-allow-origin':'*'}});
    return route.fallback();
  });
  await page.goto('/');
  await page.getByLabel('References or document').fill([sampleEntries[1].raw,sampleEntries[5].raw].join('\n\n'));
  await page.getByRole('button',{name:'Check references',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'2 references checked.'})).toBeVisible();
  await pick(page,0).click(); await page.getByTestId('evidence').getByRole('button',{name:'Keep original',exact:true}).click();
  await pick(page,1).click(); await expect(page.getByTestId('evidence')).toContainText('Unavailable providers: Crossref');
  await page.getByRole('button',{name:'I found this source',exact:true}).click();
  await page.getByLabel('Source title',{exact:true}).fill('My source'); await page.getByLabel('Evidence note').fill('Archive checked');
  await page.getByRole('button',{name:'Save evidence',exact:true}).click();
  const before=seen.urls.filter(u=>decodeURIComponent(u).includes('10.1109/cvpr.2016.90')).length;
  unavailable=false;
  await page.getByRole('button',{name:'Retry this entry',exact:true}).click();
  await expect(page.locator('[data-testid="row"][data-id="1"]')).toHaveAttribute('data-verdict','No record found');
  await expect(page.getByTestId('evidence')).toContainText('Archive checked');
  await expect(page.getByTestId('fix-status')).toContainText('1 decided');
  expect(seen.urls.filter(u=>decodeURIComponent(u).includes('10.1109/cvpr.2016.90')).length).toBe(before);
});
