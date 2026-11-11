import type { CrossCheck } from './crosscheck';
export interface Extraction { entries: string[]; body: string; fullDocument: boolean; warnings: string[]; cross?: CrossCheck }
const heading = /^\s*(?:\d+[.\s]+)?(?:references|bibliography|works cited|literature cited|reference list|参考文献|参考资料|引用文献|文献)\s*:?\s*$/im;
export function extractReferences(input: string): Extraction {
  const normalized = input.replace(/\r\n?/g,'\n').replace(/\u00ad/g,'');
  const match = heading.exec(normalized);
  const body = match ? normalized.slice(0, match.index).trim() : '';
  let referenceText = match ? normalized.slice(match.index + match[0].length) : normalized;
  referenceText = referenceText.split(/\n\s*(?:appendi(?:x|ces)(?:\s+[A-Z\d])?|acknowledg(?:e)?ments|supplementary (?:material|information))\s*\n/i)[0].trim();
  const lines = referenceText.split('\n');
  const numbered = lines.some(l => /^\s*(?:\[\d+\]|\d+[.)]|[（(]\d+[）)])\s*\S/.test(l));
  const blocks: string[] = []; let current = '';
  for (let i=0;i<lines.length;i++) {
    const line = lines[i]; const trimmed = line.trim();
    if (!trimmed) { if (!numbered && current) { blocks.push(current); current=''; } continue; }
    if (/^\d+$/.test(trimmed)) continue; // PDF page numbers
    const explicit = /^\s*(?:\[\d+\]|\d+[.)]|[（(]\d+[）)])\s*\S/.test(line);
    const authorStart = /^[\p{Lu}][\p{L}'’-]+,\s*(?:[\p{Lu}]\.|[\p{Lu}][\p{L}]+)|^[\p{Lu}][\p{L}'’-]+\s+[A-Z]{1,3}[,.]/u.test(trimmed);
    const hangingStart = !/^\s/.test(line) && /^\s+\S/.test(lines[i+1] ?? '') && Boolean(current);
    if (current && (explicit || (!numbered && (authorStart || hangingStart)))) { blocks.push(current); current=''; }
    current = current.endsWith('-') && /^[a-z]/.test(trimmed) ? current.slice(0,-1)+trimmed : [current,trimmed].filter(Boolean).join(' ');
  }
  if(current) blocks.push(current);
  return { entries:blocks.filter(x=>x.length>5), body, fullDocument:Boolean(match && body), warnings:match?[]:['No reference-section heading found. Treating the input as a reference list; in-text checks are unavailable.'] };
}
/** Short, recognisable reference lists retain one-click checks. Ambiguous text never does. */
export function needsExtractionPreview(ex: Extraction): boolean {
  return ex.fullDocument || ex.entries.some(entry => entry.length > 800 ||
    (!/10\.\d{4,9}\//.test(entry) && (!/\b(?:18|19|20)\d{2}\b/.test(entry) ||
      !/^[\s\d[\].()（）]*(?:[\p{Lu}][\p{L}’'-]+[, ]|[\p{Script=Han}]{2,})/u.test(entry))));
}
export interface PdfTextItem { str: string; transform: number[]; width: number; height: number }
export function rebuildPdfPage(items: PdfTextItem[], pageWidth: number): string {
  const text = items.filter(i=>i.str.trim());
  const mid = pageWidth / 2;
  // A real gutter needs text on both sides and few lines spanning its centre.
  const left = text.filter(i=>i.transform[4]<mid-15 && i.transform[4]+i.width<mid+5);
  const right = text.filter(i=>i.transform[4]>mid-5);
  const spanning = text.filter(i=>i.transform[4]<mid-15 && i.transform[4]+i.width>mid+15);
  const columns = left.length>=4 && right.length>=4 && spanning.length<text.length*.12;
  const arrange = (group: PdfTextItem[]) => {
    const rows: {y:number;items:PdfTextItem[]}[]=[];
    for(const item of [...group].sort((a,b)=>b.transform[5]-a.transform[5] || a.transform[4]-b.transform[4])) {
      let row=rows.find(r=>Math.abs(r.y-item.transform[5])<Math.max(2,item.height*.25));
      if(!row){row={y:item.transform[5],items:[]};rows.push(row);} row.items.push(item);
    }
    const minX = Math.min(...group.map(i=>i.transform[4]));
    return rows.sort((a,b)=>b.y-a.y).map((row,i)=>{
      const parts=row.items.sort((a,b)=>a.transform[4]-b.transform[4]);
      const indent=parts[0].transform[4]>minX+8?'  ':'';
      const gap=i>0 && rows[i-1].y-row.y>Math.max(18,parts[0].height*1.9)?'\n':'';
      return gap+indent+parts.map((x,j)=> (j && x.transform[4]-(parts[j-1].transform[4]+parts[j-1].width)>1?' ':'')+x.str).join('');
    }).join('\n');
  };
  if(!columns) return arrange(text);
  // Everything above the first line of the right column is single-column front matter (title, abstract, a heading).
  const rightTop = Math.max(...right.map(x=>x.transform[5]));
  const top = text.filter(i=>i.transform[5]>rightTop+2);
  const rest = spanning.filter(i=>!top.includes(i));
  return [arrange(top),arrange(left.filter(i=>!top.includes(i))),arrange(right),arrange(rest)].filter(Boolean).join('\n');
}
