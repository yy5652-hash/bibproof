import { rebuildPdfPage, type PdfTextItem } from '../core/extract';
export async function readInputFile(file:File):Promise<{text:string;note?:string}>{
  const ext=file.name.split('.').pop()?.toLowerCase();
  if(!['pdf','docx','bib','ris','txt'].includes(ext??''))throw new Error('Choose a .pdf, .docx, .bib, .ris, or .txt file.');
  if(ext==='docx'){
    const mammoth=await import('mammoth');const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
    return {text:result.value,note:result.messages.length?'Some document elements could not be read. Review the extracted text.':undefined};
  }
  if(ext==='pdf'){
    const pdfjs=await import('pdfjs-dist');const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
    const loading=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())});
    loading.onPassword=()=>{void loading.destroy();};
    const pdf=await loading.promise;const pages:string[]=[];
    try{for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p);const content=await page.getTextContent();pages.push(rebuildPdfPage(content.items.filter((item):item is typeof item & PdfTextItem=>'str' in item),page.getViewport({scale:1}).width));} }
    finally{await loading.destroy();}
    if(!pages.join('').trim())throw new Error('This PDF has no readable text. Scanned PDFs need OCR first; paste the references instead.');
    return {text:pages.join('\n'),note:'PDF layout was reconstructed locally. Review entry boundaries, especially in complex layouts.'};
  }
  const text=await file.text();
  if(ext==='bib')return {text};
  if(ext==='ris'){const {importBibliography}=await import('../core/format');return {text:(await importBibliography(text)).join('\n\n'),note:'Bibliography imported locally. In-text checks require a full document.'};}
  return {text};
}
export function download(name:string,text:string,type:string){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
