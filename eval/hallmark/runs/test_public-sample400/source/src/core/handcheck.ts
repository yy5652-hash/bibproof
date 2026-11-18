import type { ParsedReference } from './types';

export interface HandCheckLink { id: 'cnki' | 'wanfang' | 'baidu' | 'scholar'; label: string; url: string }

export const hasCjk = (text: string) => /[㐀-鿿豈-﫿]/.test(text);

/** The part of an entry worth searching for: its title. Handles GB/T 7714 "Author. Title[J]. Journal, 2020" entries. */
export function handCheckTitle(ref: Pick<ParsedReference, 'raw' | 'title'>): string {
  const text = ref.raw.replace(/^\s*(?:\[\d+\]|\d+[.)](?!\d))\s*/, '').replace(/\s+/g, ' ').trim();
  const book = text.match(/《([^》]{2,})》/);
  if (book) return book[1].trim();
  if (hasCjk(text)) {
    const gbt = text.match(/(?:^|[.．。]\s*)([^.．。\[\]]{3,}?)\s*\[[A-Z/]{1,6}\]/);
    if (gbt) return gbt[1].trim();
    if (!hasCjk(ref.title)) {
      const longest = [...text.matchAll(/[㐀-鿿豈-﫿A-Za-z0-9：:，、（）() -]{4,}/g)].map(m => m[0].trim()).sort((a, b) => b.length - a.length)[0];
      if (longest) return longest;
    }
  }
  return (ref.title || text).slice(0, 200).trim();
}

/** Plain search links. They only open when the person clicks; nothing is fetched from these sites. */
export function handCheckLinks(title: string): HandCheckLink[] {
  const q = encodeURIComponent(title.replace(/\s+/g, ' ').trim().slice(0, 200));
  const links: Record<HandCheckLink['id'], HandCheckLink> = {
    cnki: { id: 'cnki', label: 'CNKI', url: `https://kns.cnki.net/kns8s/defaultresult/index?kw=${q}` },
    wanfang: { id: 'wanfang', label: 'Wanfang', url: `https://s.wanfangdata.com.cn/paper?q=${q}` },
    baidu: { id: 'baidu', label: 'Baidu Scholar', url: `https://xueshu.baidu.com/s?wd=${q}` },
    scholar: { id: 'scholar', label: 'Google Scholar', url: `https://scholar.google.com/scholar?q=${q}` },
  };
  return title.trim() ? [links.cnki, links.wanfang, links.baidu, links.scholar] : [];
}

/** Chinese entries lead with the Chinese databases, everything else with Google Scholar. */
export function handCheckFor(ref: Pick<ParsedReference, 'raw' | 'title'>): { title: string; chinese: boolean; links: HandCheckLink[] } {
  const title = handCheckTitle(ref);
  const chinese = hasCjk(ref.raw);
  const links = handCheckLinks(title);
  return { title, chinese, links: chinese ? links : [links[3], links[0], links[1], links[2]].filter(Boolean) };
}
