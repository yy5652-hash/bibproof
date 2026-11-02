# Bibproof

**Every reference, proven before you submit.**

Paste a bibliography or drop in a paper. Bibproof checks each reference against the scholarly record and shows the evidence: which record it matched, which fields disagree, and what the index actually says. No account, no cap, nothing to install.

Live: https://yy5652-hash.github.io/bibproof/

## Why

AI writing tools invent references, and the fakes are good. GPTZero found [100 hallucinated citations in accepted NeurIPS 2025 papers](https://gptzero.me/news/neurips/). The worst ones are chimeras: real authors on an invented title, or a real DOI that points at a different paper. Checking by hand is slow enough that nobody does it.

## What it does

Each reference gets one of six verdicts, always with its evidence:

| Verdict | Meaning |
| --- | --- |
| Verified | A record exists and its title and authors agree |
| Details differ | The work exists but fields disagree, shown side by side. Includes chimeras |
| Identifier conflict | The DOI or arXiv id resolves to a different work |
| Retracted | The matched work has been retracted |
| No record found | Nothing close in the indexes. Likely fabricated, check by hand |
| Could not check | An index was unavailable, or the item is outside what these indexes cover. Never counted as fake |

It also:

- reads `.docx`, `.pdf`, `.bib`, `.ris` and `.txt`, finding the reference section in a full paper;
- cross-checks in-text citations against the reference list, in both directions;
- writes the corrected reference in APA 7, MLA 9, Chicago or IEEE;
- exports a corrected `.bib` or `.ris`, a CSV report, and a printable PDF report.

## Privacy

Your file is read on your device and never uploaded. Only the text of individual references goes to the public scholarly indexes: Crossref, DataCite, OpenAlex, Europe PMC and Open Library. There is no backend and no analytics.

## How it works

1. **Extract** the entries from pasted text or a document. PDF lines and columns are rebuilt from pdf.js text items.
2. **Look up** by identifier first, then Crossref bibliographic search, then OpenAlex, Europe PMC and Open Library. Each host has its own queue that honours its rate limit, and answers are cached on your device.
3. **Score** each candidate against the raw reference text rather than a parsed guess: title containment, surnames, year, venue, plus a volume + first page + first author check that recognises entries with abbreviated or missing titles.
4. **Decide** conservatively. A failed index is never evidence of absence, and an entry with no stated title is never called fabricated.

## Measured accuracy

`npm run eval` runs on live APIs. Thresholds were tuned on one seed and reported on a separate held-out set. Full results are in [`eval/results.json`](eval/results.json).

| Test set | Result |
| --- | --- |
| 240 genuine references (60 works in 4 styles) | 0 false accusations, 240 accepted |
| 56 genuine references as real authors typed them | 1 false accusation on the first held-out run; 0 after the fix below, all 56 matched |
| 60 synthetic fabrications | 97% flagged (invented 15/15, chimera 15/15, bogus DOI 15/15, mutated 13/15) |
| 100 hallucinated citations from GPTZero's NeurIPS list | 98 flagged, 0 marked verified, 2 could not be checked |

The one false accusation was a preprint cited under a title that differs from its record, although every author and the year matched. That pattern now returns "Details differ". Because the rule came from this set, the set no longer counts as unseen; the run before the fix is kept in [`eval/summary-first-heldout.json`](eval/summary-first-heldout.json), and the fix left the synthetic results unchanged and moved one GPTZero entry from "No record found" to "Details differ", still flagged.

These are measurements on these sets, not population-wide accuracy claims. The synthetic set is sampled from Crossref, the same index used for lookup, and the NeurIPS labels are GPTZero's own.

## Limits

Coverage of books, reports, web pages and non-Latin scripts is uneven, so these often land in "Could not check". A missing record can still be real, and "Details differ" is a prompt to look, not proof of fabrication. Bibproof checks that a source exists and is cited accurately, not that it supports your claim. OpenAlex allows about 100 anonymous searches per network per day; beyond that, unmatched entries return "Could not check" until it resets.

## Run it

```bash
npm ci
npm run dev        # http://127.0.0.1:5173/bibproof/
npm run test:unit
npm run test:e2e
npm run build
npm run eval       # live network, cached in eval/cache
```

## Credits

Built for LaunchPad Hacks in November 2026 by Yi Yu, with all project code written during the event. AI coding assistants (Claude Code and OpenAI Codex) wrote much of the code under the author's direction and review.

Libraries: [React](https://react.dev), [Vite](https://vite.dev), [pdf.js](https://mozilla.github.io/pdf.js/) (Apache-2.0), [mammoth.js](https://github.com/mwilliamson/mammoth.js) (BSD-2-Clause), [Citation.js](https://citation.js.org) (MIT), CSL styles from the [Citation Style Language project](https://citationstyles.org) (CC BY-SA 3.0), Inter and Newsreader fonts through Fontsource (OFL).

Data: [Crossref](https://www.crossref.org), [DataCite](https://datacite.org), [OpenAlex](https://openalex.org), [Europe PMC](https://europepmc.org), [Open Library](https://openlibrary.org).

MIT licensed.
