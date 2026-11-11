import { sampleEntries } from './sample';
/** Constructed short manuscript for demonstrating repair handoff, not research claims. */
export const paperEntries=[sampleEntries[2],sampleEntries[4],sampleEntries[0]];
export const PAPER_BODY=`Checking references before submission

Abstract
This constructed teaching manuscript demonstrates reference review. Its citation mistakes are deliberate; it does not establish that any cited source supports a claim.

Background
The draft dates an overview of deep learning incorrectly (LeCun et al., 2022). A separate statement cites a source absent from the bibliography (Smith, 2020).

Discussion
The draft cites residual learning using a conflicting identifier (He et al., 2016). A second sentence cites that same conflicting entry (He et al., 2016).

Conclusion
Metadata repairs require reviewing both the bibliography and the labels in the manuscript.`;
export const PAPER= PAPER_BODY+'\n\nReferences\n'+paperEntries.map(e=>e.raw).join('\n\n');
