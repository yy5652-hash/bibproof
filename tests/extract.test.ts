import { describe, expect, it } from 'vitest';
import { extractReferences, rebuildPdfPage, type PdfTextItem } from '../src/core/extract';

describe('extractReferences', () => {
  it('splits numbered entries and joins wrapped lines and hyphenated breaks', () => {
    const { entries } = extractReferences('[1] Smith, J. (2020). Graph sampling for tiny net-\nworks. Journal of Examples, 12, 1-10.\n[2] Garcia, M. (2019). A second paper about\nsomething else. Other Journal.\n3. Lee, K. (2018). Third paper title here. Venue.');
    expect(entries).toHaveLength(3);
    expect(entries[0]).toContain('tiny networks.');
    expect(entries[1]).toBe('[2] Garcia, M. (2019). A second paper about something else. Other Journal.');
  });

  it('splits unnumbered author-year lists with blank lines, hanging indents and bare author starts', () => {
    const blank = extractReferences('Smith, J. (2020). Graph sampling. Journal of Examples.\n\nGarcia, M. (2019). Second paper. Other Journal.');
    expect(blank.entries).toHaveLength(2);
    const hanging = extractReferences('Smith, J. (2020). Graph sampling for tiny\n   networks. Journal of Examples.\nGarcia, M. (2019). Second paper\n   continues here. Other Journal.');
    expect(hanging.entries).toHaveLength(2);
    expect(hanging.entries[0]).toContain('tiny networks.');
    const bare = extractReferences('Smith, J. (2020). Graph sampling. Journal of Examples.\nGarcia, M. (2019). Second paper. Other Journal.\nLee, K. (2018). Third paper. Venue.');
    expect(bare.entries).toHaveLength(3);
  });

  it('finds the reference section of a full document and keeps the body for the in-text check', () => {
    const doc = 'Introduction\nPrior work [1] matters.\n\n7. References\n[1] Smith, J. (2020). Graph sampling for tiny networks. Journal of Examples.\n\nAppendix A\nExtra table 12';
    const r = extractReferences(doc);
    expect(r.fullDocument).toBe(true);
    expect(r.body).toContain('Prior work [1]');
    expect(r.entries).toEqual(['[1] Smith, J. (2020). Graph sampling for tiny networks. Journal of Examples.']);
  });

  it('treats text without a heading as a bare list and says so', () => {
    const r = extractReferences('[1] Smith, J. (2020). Graph sampling for tiny networks. Journal of Examples.');
    expect(r.fullDocument).toBe(false);
    expect(r.warnings[0]).toMatch(/No reference-section heading/);
  });

  it('drops bare PDF page numbers that interrupt an entry', () => {
    const r = extractReferences('References\n[1] Smith, J. (2020). Graph sampling for tiny\n12\nnetworks. Journal of Examples.');
    expect(r.entries[0]).toBe('[1] Smith, J. (2020). Graph sampling for tiny networks. Journal of Examples.');
  });
});

describe('rebuildPdfPage', () => {
  const item = (str: string, x: number, y: number, width = str.length * 5): PdfTextItem => ({ str, transform: [1, 0, 0, 1, x, y], width, height: 10 });
  it('reads a two-column page column by column, not across the gutter', () => {
    const left = [item('Left one', 40, 700, 100), item('left two', 40, 686, 100), item('left three', 40, 672, 100), item('left four', 40, 658, 100)];
    const right = [item('Right one', 330, 700, 100), item('right two', 330, 686, 100), item('right three', 330, 672, 100), item('right four', 330, 658, 100)];
    const text = rebuildPdfPage([...right, ...left], 612);
    expect(text.indexOf('left four')).toBeLessThan(text.indexOf('Right one'));
    expect(text.split('\n')).toHaveLength(8);
  });
  it('keeps full-width lines above the columns in front of them, so body text never lands inside the reference list', () => {
    const intro = [item('Title of the paper', 40, 740, 150), item('Transformers [1] replaced recurrence and more words follow here', 40, 720, 520), item('A short last line [9].', 40, 706, 100), item('References', 40, 680, 60)];
    const left = [item('[1] Left one', 40, 660, 100), item('left two', 40, 646, 100), item('left three', 40, 632, 100), item('left four', 40, 618, 100)];
    const right = [item('[2] Right one', 330, 660, 100), item('right two', 330, 646, 100), item('right three', 330, 632, 100), item('right four', 330, 618, 100)];
    const lines = rebuildPdfPage([...right, ...left, ...intro], 612).split('\n');
    expect(lines.slice(0, 4).join('|')).toContain('Transformers [1]');
    expect(lines.indexOf('References')).toBeLessThan(lines.findIndex(l => l.includes('[1] Left one')));
    expect(lines.slice(-1)[0]).toContain('right four');
  });
  it('keeps a single column in reading order and marks indented continuation lines', () => {
    const text = rebuildPdfPage([item('Smith, J. (2020). Title.', 72, 700, 200), item('continued line', 90, 688, 100), item('Garcia, M. (2019). Other.', 72, 660, 200)], 612);
    expect(text.split('\n')[1]).toMatch(/^ {2}continued line/);
  });
});

it.each(['References','Bibliography','Works Cited','Literature Cited','Reference List','参考文献','参考资料','引用文献','文献'])('excludes prose above %s', heading => {
 const ex=extractReferences(`这是私人正文，不应发送。\n${heading}\n（1）张三. 标题. 2020.\n[2] 李四. 第二篇. 2021.`);
 expect(ex.entries).toHaveLength(2); expect(ex.entries.join('')).not.toContain('私人');expect(ex.fullDocument).toBe(true);
});

import { needsExtractionPreview } from '../src/core/extract';
it('requires confirmation for uncertain boundaries, while keeping short reference lists one-click',()=>{
 expect(needsExtractionPreview(extractReferences('Smith, J. (2020). A real title.\n\nJones, A. (2021). Another title.'))).toBe(false);
 expect(needsExtractionPreview(extractReferences('A body paragraph without bibliographic metadata.'))).toBe(true);
 expect(needsExtractionPreview(extractReferences('Smith argues that progress accelerated in 2020. This is private manuscript prose.'))).toBe(true);
 expect(needsExtractionPreview(extractReferences('这是正文，在 2020 年发生了一件事。'))).toBe(true);
 expect(needsExtractionPreview(extractReferences('Smith, J. (2020). '+ 'long prose '.repeat(100)))).toBe(true);
 expect(needsExtractionPreview(extractReferences('A claim [1].\nReferences\n[1] Smith, J. (2020). A title.'))).toBe(true);
});
