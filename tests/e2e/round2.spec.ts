import {test,expect,type Page} from '@playwright/test';
import {installMock} from './mock';
import {sampleEntries} from '../../src/core/sample';
const row=(page:Page,id:number)=>page.locator(`[data-testid="row"][data-id="${id}"]`);
const pick=(page:Page,id:number)=>row(page,id).locator('.row-btn');
async function paper(page:Page){await page.goto('/');await page.getByRole('button',{name:'Try a paper',exact:true}).click();await expect(page.getByTestId('saved-example')).toBeVisible();}

test('round2 title extension is Details differ and its Title field differs',async({page})=>{
 await installMock(page);await page.goto('/');
 await page.getByLabel('References or document').fill(sampleEntries[2].raw.replace('(2022)','(2015)').replace('Deep learning.','Deep learning proves astrology predicts student exam grades.'));
 await page.getByRole('button',{name:'Check references',exact:true}).click();
 await expect(row(page,0)).toHaveAttribute('data-verdict','Details differ');await pick(page,0).click();
 const title=page.getByTestId('evidence').getByRole('row').filter({has:page.getByRole('cell').filter({hasText:/^Title/})});
 await expect(title).toContainText('Differs');
});

for(const heading of ['参考文献','Reference List','Works Cited'])test(`round2 extraction privacy and editable preview: ${heading}`,async({page})=>{
 const seen=await installMock(page);await page.goto('/');
 await page.getByLabel('References or document').fill(`PRIVATE-BODY-8723 正文不能发送。\n${heading}\n（1）${sampleEntries[1].raw}\n（2）${sampleEntries[2].raw}`);
 await page.getByRole('button',{name:'Check references',exact:true}).click();
 const preview=page.getByRole('region',{name:'Review extracted references'});
 await expect(preview.locator('textarea')).toHaveCount(2);expect(seen.urls).toEqual([]);
 await expect(preview).not.toContainText('PRIVATE-BODY-8723');
 await preview.getByRole('button',{name:'Merge with previous'}).nth(1).click();await expect(preview.locator('textarea')).toHaveCount(1);
 await preview.locator('textarea').fill(`${sampleEntries[1].raw}\n${sampleEntries[2].raw}`);
 await preview.getByRole('button',{name:'Split at line breaks'}).click();await expect(preview.locator('textarea')).toHaveCount(2);
 await preview.getByRole('button',{name:'Exclude',exact:true}).nth(1).click();expect(seen.urls).toEqual([]);
 await preview.getByRole('button',{name:'Check 1 references',exact:true}).click();await expect(row(page,0)).toHaveAttribute('data-verdict','Verified');
 expect(seen.urls.map(decodeURIComponent).join(' ')+seen.bodies.join(' ')).not.toContain('PRIVATE-BODY-8723');
});

test('round2 ambiguous heading-free text waits for confirmation',async({page})=>{
 const seen=await installMock(page);await page.goto('/');await page.getByLabel('References or document').fill('Private paragraph with no reference boundary or scholarly metadata.');
 await page.getByRole('button',{name:'Check references',exact:true}).click();
 await expect(page.getByRole('region',{name:'Review extracted references'})).toBeVisible();expect(seen.urls).toEqual([]);
});

test('round2 paper snapshot, label task, separate copies and restored cross-checks',async({page})=>{
 const seen=await installMock(page);await paper(page);expect(seen.urls).toEqual([]);
 await expect(page.getByTestId('cross-missing')).toContainText('Smith, 2020');await expect(page.getByTestId('cross-uncited')).toContainText('Attention Is All You Need');
 await pick(page,1).click();await expect(page.getByTestId('evidence').locator('.citing')).toContainText('A second sentence');
 await pick(page,0).click();await page.getByTestId('evidence').getByRole('button',{name:'Use record',exact:true}).click();
 const repairs=page.getByTestId('repair-sentences');await expect(repairs).toContainText('(LeCun et al., 2022) → (LeCun et al., 2015)');
 await repairs.getByLabel('Sentence action').selectOption('keep');await expect(page.getByTestId('fix-status')).toContainText('1 citations needing edits');
 await page.getByRole('button',{name:'Review & export',exact:true}).click();
 const bib=page.getByTestId('bibliography');await expect(bib).not.toContainText('Numeric labels');await expect(bib).toContainText('(LeCun et al., 2022) → (LeCun et al., 2015)');
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).__copied=text;}}});});
 await bib.getByRole('button',{name:'Copy bibliography',exact:true}).click();expect(await page.evaluate(()=>(window as any).__copied)).not.toContain('Manuscript edits');
 await bib.getByRole('button',{name:'Copy review notes',exact:true}).click();expect(await page.evaluate(()=>(window as any).__copied)).toContain('(LeCun et al., 2022) → (LeCun et al., 2015)');
 await bib.getByLabel('Citation label edit done').check();await expect(bib).toContainText('0 citations needing edits');await page.keyboard.press('Escape');await page.waitForTimeout(800);
 await page.getByRole('link',{name:'History',exact:true}).click();await page.getByRole('button',{name:'Open',exact:true}).click();
 await expect(page.getByTestId('cross-missing')).toContainText('Smith, 2020');await expect(page.getByTestId('cross-uncited')).toContainText('Attention Is All You Need');
 await pick(page,0).click();await expect(page.getByLabel('Citation label edit done')).toBeChecked();
 await page.getByRole('button',{name:'Run live checks',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'3 references checked.'})).toBeVisible();
 await expect(page.getByTestId('cross-missing')).toContainText('Smith, 2020');expect(seen.urls.length).toBeGreaterThan(0);
});

test('round2 Tab and arrows select the focused row; shortcuts stay inside workspace panes',async({page})=>{
 await installMock(page);await paper(page);await page.getByRole('button',{name:'Document order',exact:true}).click();
 await pick(page,0).click();await page.keyboard.press('Tab');await expect(pick(page,1)).toBeFocused();await page.keyboard.press('x');
 await expect(row(page,1).getByTestId('row-tag')).toHaveText('Removed');await expect(row(page,0).getByTestId('row-tag')).not.toHaveText('Removed');
 await page.keyboard.press('ArrowDown');await expect(pick(page,2)).toBeFocused();await page.keyboard.press('x');await expect(row(page,2).getByTestId('row-tag')).toHaveText('Removed');
 await page.getByRole('button',{name:'Review & export',exact:true}).focus();await page.keyboard.press('x');await expect(row(page,2).getByTestId('row-tag')).toHaveText('Removed');
 await page.getByRole('button',{name:'Review & export',exact:true}).click();await page.keyboard.press('x');await expect(row(page,2).getByTestId('row-tag')).toHaveText('Removed');
});

for(const chinese of [false,true])test(`round2 preview and paper repairs fit 375 px (${chinese?'zh':'en'})`,async({page})=>{
 await page.setViewportSize({width:375,height:812});await installMock(page);await page.goto('/');if(chinese)await page.getByTestId('lang-toggle').click();
 await page.getByLabel(chinese?'参考文献或整篇文档':'References or document').fill(`Private body.\n参考文献\n[1] ${sampleEntries[2].raw}`);
 await page.getByRole('button',{name:chinese?'核查参考文献':'Check references',exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
 await page.getByRole('button',{name:chinese?'检查 1 条文献':'Check 1 references',exact:true}).click();await expect(pick(page,0)).toBeEnabled();await pick(page,0).click();
 await page.getByTestId('evidence').getByRole('button',{name:chinese?'采用记录':'Use record',exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
});

test('round2 live progress names the queried provider',async({page})=>{
 await installMock(page);let release!:()=>void;const held=new Promise<void>(r=>{release=r;});
 await page.route('https://api.crossref.org/works/**',async route=>{await held;return route.fallback();});
 try{
  await page.goto('/');await page.getByLabel('References or document').fill(sampleEntries[1].raw);await page.getByRole('button',{name:'Check references',exact:true}).click();
  await expect(row(page,0)).toContainText('Querying Crossref · attempt 1/3');release();await expect(row(page,0)).toHaveAttribute('data-verdict','Verified');
 }finally{release();}
});
