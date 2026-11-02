import { describe, expect, it } from 'vitest';
import { handCheckFor, handCheckLinks, handCheckTitle } from '../src/core/handcheck';
import { parseReference } from '../src/core/parse';

describe('handCheckLinks', () => {
  it('builds four plain https search links with the encoded title', () => {
    const links = handCheckLinks('Deep learning & 机器学习');
    expect(links.map(l => l.id)).toEqual(['cnki', 'wanfang', 'baidu', 'scholar']);
    for (const l of links) { expect(l.url).toMatch(/^https:\/\//); expect(l.url).toContain(encodeURIComponent('Deep learning & 机器学习')); expect(l.url).not.toContain(' '); }
    expect(new URL(links[3].url).host).toBe('scholar.google.com');
  });
  it('returns nothing for an empty title and bounds very long ones', () => {
    expect(handCheckLinks('   ')).toEqual([]);
    expect(decodeURIComponent(handCheckLinks('x'.repeat(900))[0].url.split('kw=')[1]).length).toBe(200);
  });
});

describe('handCheckTitle and handCheckFor', () => {
  it('takes the title out of a GB/T 7714 entry', () => {
    const raw = '[3] 王明, 李华. 基于深度学习的文献检索方法研究[J]. 情报学报, 2021, 40(3): 12-20.';
    expect(handCheckTitle({ raw, title: parseReference(raw).title })).toBe('基于深度学习的文献检索方法研究');
    const r = handCheckFor({ raw, title: parseReference(raw).title });
    expect(r.chinese).toBe(true);
    expect(r.links[0].id).toBe('cnki');
  });
  it('uses 《》 titles and puts Google Scholar first for non-Chinese entries', () => {
    expect(handCheckTitle({ raw: '钱穆. 《国史大纲》. 商务印书馆, 1940.', title: '' })).toBe('国史大纲');
    const raw = 'Smith, J. (2020). Graph sampling for tiny networks. Journal of Examples.';
    const r = handCheckFor({ raw, title: parseReference(raw).title });
    expect(r.chinese).toBe(false);
    expect(r.title).toBe('Graph sampling for tiny networks');
    expect(r.links[0].id).toBe('scholar');
  });
});
