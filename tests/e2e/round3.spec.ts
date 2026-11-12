import {test,expect,type Page} from '@playwright/test';
import {installMock} from './mock';
import {crossrefItem} from '../helpers';
import {deep,privacy,subtitle,extra,initials,bibtex,paper,distilling} from '../fixtures/round3-inputs';
const row=(page:Page,id=0)=>page.locator(`[data-testid="row"][data-id="${id}"]`);
const pick=(page:Page,id=0)=>row(page,id).locator('.row-btn');
async function paste(page:Page,raw:string){await page.goto('/');await page.getByLabel('References or document').fill(raw);await page.getByRole('button',{name:'Check references',exact:true}).click();}
function field(page:Page,name:string){return page.getByTestId('evidence').getByRole('row').filter({has:page.getByRole('cell').filter({hasText:new RegExp('^'+name)})});}

test('round3 1 DOI-bearing body never bypasses preview or reaches indexes',async({page})=>{
 const seen=await installMock(page);await paste(page,privacy);
 const preview=page.getByRole('region',{name:'Review extracted references'});
 await expect(preview.locator('textarea')).toHaveCount(1);await expect(preview.locator('textarea')).toHaveValue(deep);expect(seen.urls).toEqual([]);
 await preview.getByRole('button',{name:'Check 1 references',exact:true}).click();await expect(row(page)).toHaveAttribute('data-verdict','Verified');
 expect(seen.urls.map(decodeURIComponent).join(' ')+seen.bodies.join(' ')).not.toContain('SANDPIPER');
});
for(const [item,raw,name] of [['2a',subtitle,'Title'],['2b',extra,'Authors']] as const)test(`round3 ${item} explicit extra content differs`,async({page})=>{
 await installMock(page);await paste(page,raw);await expect(row(page)).toHaveAttribute('data-verdict','Details differ');await pick(page).click();await expect(field(page,name)).toContainText('Differs');
});
test('round3 2c incorrect first initials are visible in Authors evidence',async({page})=>{
 await installMock(page);await page.route('https://api.datacite.org/dois/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({data:{attributes:{doi:'10.48550/arxiv.1412.6980',titles:[{title:'Adam: A Method for Stochastic Optimization'}],creators:[{familyName:'Kingma',givenName:'Diederik P.'},{familyName:'Ba',givenName:'Jimmy'}],publicationYear:2014,publisher:'arXiv'}}})}));
 await paste(page,initials);await expect(row(page)).toHaveAttribute('data-verdict','Details differ');await pick(page).click();await expect(field(page,'Authors')).toContainText('Differs');await expect(field(page,'Authors')).toContainText('Z. P.');await expect(field(page,'Authors')).toContainText('Diederik');
});
test('round3 2d pasted BibTeX retains Goel and title and flags fabricated venue',async({page})=>{
 await installMock(page);await page.route('https://api.crossref.org/works/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({message:crossrefItem({doi:'10.1109/cvpr52688.2022.00844',title:'Differentiable Stereopsis: Meshes from multiple views using differentiable rendering',authors:[['Shubham','Goel'],['Georgia','Gkioxari'],['Jitendra','Malik']],year:2022,venue:'2022 IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)'})})}));
 await paste(page,bibtex);await expect(row(page)).toHaveAttribute('data-verdict','Details differ');await pick(page).click();await expect(field(page,'Title')).not.toContainText('booktitle');await expect(field(page,'Authors')).toContainText('Goel');await expect(field(page,'Venue')).toContainText('Differs');
});
test('round3 3 Hinton narrative binds only to the first-author Hinton reference',async({page})=>{
 await installMock(page);await paste(page,paper);await page.getByRole('button',{name:'Check 2 references',exact:true}).click();await expect(pick(page,1)).toBeEnabled();
 await page.locator('.cross summary').click();await expect(page.getByTestId('cross-uncited')).toContainText('Deep learning');await expect(page.getByTestId('cross-uncited')).not.toContainText('Distilling');
 await pick(page,0).click();await page.getByTestId('evidence').getByRole('button',{name:'Remove',exact:true}).click();await expect(page.getByTestId('repair-sentences')).not.toContainText('Hinton et al. (2015)');
 await pick(page,1).click();await page.getByTestId('evidence').getByRole('button',{name:'Remove',exact:true}).click();await expect(page.getByTestId('repair-sentences')).toContainText('Hinton et al. (2015)');
});
test('round3 3 ambiguous citations wait for a user choice before generating edits',async({page})=>{
 await installMock(page);await paste(page,`Hinton et al. (2015) discuss distillation.\nReferences\n${distilling}\n\n${distilling.replace('Distilling','Other Distilling')}`);
 await page.getByRole('button',{name:'Check 2 references',exact:true}).click();await expect(pick(page,0)).toBeEnabled();await expect(pick(page,1)).toBeEnabled();
 await pick(page,0).click();await page.getByTestId('evidence').getByRole('button',{name:'Remove',exact:true}).click();await expect(page.getByTestId('repair-sentences')).not.toContainText('Hinton et al. (2015)');
 await page.setViewportSize({width:375,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.setViewportSize({width:1280,height:900});
 await page.getByLabel('Choose a reference').selectOption('0');await expect(page.getByTestId('repair-sentences')).toContainText('Hinton et al. (2015)');
});
test('round3 5a skip link keeps Methodology route and focuses its main content',async({page})=>{
 await page.goto('/#/methodology');await expect(page.getByRole('heading',{level:1})).toBeVisible();const url=page.url();
 const skip=page.getByRole('link',{name:'Skip to content',exact:true});await skip.focus();await page.keyboard.press('Enter');expect(page.url()).toBe(url);await expect(page.locator('main')).toBeFocused();await expect(page.getByLabel('References or document')).toHaveCount(0);
});
test('round3 5b Escape from expanded Index trail restores the narrow-layout opener',async({page})=>{
 await page.setViewportSize({width:449,height:850});await page.goto('/');await page.getByRole('button',{name:'Try a sample',exact:true}).click();await pick(page,1).click();
 const dialog=page.getByRole('dialog');await dialog.getByText('Index trail',{exact:true}).click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(pick(page,1)).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
