import { describe, expect, it } from 'vitest';
import { cleanDoi, normalize, parseReference } from '../src/core/parse';

describe('parseReference', () => {
  it('reads an APA entry: label, surnames, year, title and a DOI with trailing punctuation', () => {
    const r = parseReference('[3] He, K., Zhang, X., Ren, S., & Sun, J. (2016). Deep residual learning for image recognition. CVPR. https://doi.org/10.1109/CVPR.2016.90.');
    expect(r).toMatchObject({ label: '3', year: 2016, doi: '10.1109/cvpr.2016.90', kind: 'scholarly', title: 'Deep residual learning for image recognition' });
    expect(r.surnames).toEqual(expect.arrayContaining(['He', 'Zhang', 'Ren', 'Sun']));
  });
  it('takes the quoted title in IEEE style and ignores the year inside the DOI', () => {
    const r = parseReference('K. He, X. Zhang, "Deep residual learning for image recognition," in Proc. CVPR, 2016, doi: 10.1109/CVPR.2016.90');
    expect(r.title).toBe('Deep residual learning for image recognition');
    expect(r.year).toBe(2016);
    expect(r.doi).toBe('10.1109/cvpr.2016.90');
  });
  it('extracts arXiv ids from the common spellings and strips the version', () => {
    expect(parseReference('Vaswani, A. (2017). Attention is all you need. arXiv:1706.03762v5').arxiv).toBe('1706.03762');
    expect(parseReference('Vaswani, A. (2017). Attention is all you need. https://arxiv.org/abs/1706.03762').arxiv).toBe('1706.03762');
  });
  it('marks web pages and reports as unsupported, so they can never be called fabricated', () => {
    expect(parseReference('World Health Organization. (2024). Climate change. https://www.who.int/news-room/fact-sheets').kind).toBe('unsupported');
    expect(parseReference('Acme Corp. (2022). Annual report 2021.').kind).toBe('unsupported');
  });
  it('does not call an entry without year or authors scholarly', () => {
    expect(parseReference('some words without structure at all here').kind).toBe('unknown');
  });
});
describe('normalisation', () => {
  it('folds case, accents, markup and punctuation', () => { expect(normalize('<i>Déjà</i> Vu: A-B!')).toBe('deja vu a b'); });
  it('keeps balanced parentheses inside a DOI and drops an unbalanced closer', () => {
    expect(cleanDoi('10.1016/S0140-6736(97)11096-0)')).toBe('10.1016/s0140-6736(97)11096-0');
    expect(cleanDoi('doi:10.1000/ABC.')).toBe('10.1000/abc');
  });
});
