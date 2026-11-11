import { importBibliography } from '../../src/core/format';
import { extractReferences } from '../../src/core/extract';
import type { BlindEntry } from './common';
export function toBibtex(entry:BlindEntry):string {
 if(entry.raw_bibtex)return entry.raw_bibtex;
 // Same reconstruction as HALLMARK BlindEntry.to_bibtex(), no inferred metadata.
 return [`@${entry.bibtex_type}{${entry.bibtex_key},`,...Object.keys(entry.fields).sort().map(k=>`  ${k} = {${entry.fields[k]}},`),'}'].join('\n');
}
export async function convert(entry:BlindEntry):Promise<string>{
 // readInputFile(.bib) -> importBibliography -> extractReferences -> verifyReference.
 const imported=await importBibliography(toBibtex(entry));
 const extracted=extractReferences(imported.join('\n\n')).entries;
 if(imported.length!==1||extracted.length!==1)throw new Error(`Upload path produced ${imported.length} citations / ${extracted.length} references for ${entry.bibtex_key}`);
 return extracted[0];
}
