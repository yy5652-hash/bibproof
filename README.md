# Bibproof

**Catch invented references before you submit.**

Paste a bibliography, drop in a paper, or enter a DOI. Bibproof checks each reference against the scholarly record, shows the evidence, and helps you fix what it finds. No account, nothing to install. No Bibproof usage cap; public-index limits apply. In English and Chinese.

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
- cross-checks in-text citations against the reference list, in both directions, and lists the sentences that cite each problem reference;
- sorts by severity, so the worst problem comes first, with keyboard shortcuts for working through them;
- lets you keep, replace or remove each entry, offers close real records as candidates, and opens Review & export in APA 7, MLA 9, Chicago, IEEE or Harvard, with a change log;
- exports `.txt`, `.bib`, `.ris`, a CSV report and a printable PDF report;
- gives direct search links to CNKI, Wanfang, Baidu Scholar and Google Scholar for entries it cannot check, including Chinese references;
- tracks affected citing sentences, preserves an old-to-new numeric label map, and exports manuscript edit lists;
- retries index failures without discarding finished results or decisions;
- accepts separately labelled user-reviewed source evidence without changing automated verdicts;
- opens a dated, saved live example instantly, with an explicit button to rerun live checks;
- keeps your past checks in this browser, and shares a result as a link that carries everything in its `#` fragment, so it never reaches a server.

## Privacy

Your file is read on your device and never uploaded. Only the text of individual references goes to the public scholarly indexes: Crossref, DataCite, OpenAlex, Europe PMC and Open Library. History, manual evidence and citing sentences stay in your browser and can be cleared in one click. The full document is not retained. A share link contains the reference text and any manual evidence notes, and the app warns you before copying it. There is no backend and no analytics.

## How it works

1. **Extract** the entries from pasted text or a document. PDF lines and columns are rebuilt from pdf.js text items.
2. **Look up** by identifier first, then Crossref bibliographic search, then OpenAlex, Europe PMC and Open Library. Each host has its own queue that honours its rate limit, and answers are cached on your device.
3. **Score** candidates for retrieval against the raw reference text: title containment, surnames, year, venue, plus a volume + first page + first author check that recognises entries with abbreviated or missing titles.
4. **Decide** conservatively. When a title boundary can be isolated, check title identity in both directions before marking it Verified. A failed index is never evidence of absence, and an entry with no stated title is never called fabricated.

## Measured accuracy

`npm run eval` runs on live APIs. Thresholds were tuned on one seed and reported on a separate held-out set. Full results are in [`eval/results.json`](eval/results.json).

| Test set | Result |
| --- | --- |
| 240 genuine references (60 works in 4 styles) | 0 false accusations, 240 accepted |
| 56 genuine references as real authors typed them | 1 false accusation on the first held-out run; 0 after the fix below, all 56 matched |
| 60 more typed references, drawn after the rules were frozen | 1 false accusation, 58 matched, 1 could not be checked |
| 60 synthetic fabrications | 59 of 60 flagged for review (invented 15/15, chimera 15/15, bogus DOI 15/15, mutated 14/15; the other mutated entry could not be checked) |
| 100 hallucinated citations from GPTZero's NeurIPS list | 98 flagged, 0 marked verified, 2 could not be checked |

The one false accusation was a preprint cited under a title that differs from its record, although every author and the year matched. That pattern now returns "Details differ". Because the rule came from this set, the set no longer counts as unseen; the run before the fix is kept in [`eval/summary-first-heldout.json`](eval/summary-first-heldout.json), and the fix left the synthetic results unchanged and moved one GPTZero entry from "No record found" to "Details differ", still flagged. The newer batch of 60 is the unseen figure: its one false accusation is a book chapter cited only by its book title, and no rule has been changed for it. Its results are in [`eval/fresh-results.json`](eval/fresh-results.json).

These are measurements on these sets, not population-wide accuracy claims. The synthetic set is sampled from Crossref, the same index used for lookup, and the NeurIPS labels are GPTZero's own.

## Limits

Coverage of books, reports, web pages and non-Latin scripts is uneven, so these often land in "Could not check", and an entry in a non-Latin script is never called fabricated. A missing record can still be real, and "Details differ" is a prompt to look, not proof of fabrication. Bibproof checks that a source exists and is cited accurately, not that it supports your claim. OpenAlex allows about 100 anonymous searches per network per day; beyond that, unmatched entries return "Could not check" until it resets.

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

Libraries: [React](https://react.dev), [Vite](https://vite.dev), [Radix UI](https://www.radix-ui.com) (MIT), [TanStack Virtual](https://tanstack.com/virtual) (MIT), [lz-string](https://github.com/pieroxy/lz-string) (MIT), [pdf.js](https://mozilla.github.io/pdf.js/) (Apache-2.0), [mammoth.js](https://github.com/mwilliamson/mammoth.js) (BSD-2-Clause), [Citation.js](https://citation.js.org) (MIT), CSL styles from the [Citation Style Language project](https://citationstyles.org) (CC BY-SA 3.0), Inter and Newsreader fonts through Fontsource (OFL).

Data: [Crossref](https://www.crossref.org), [DataCite](https://datacite.org), [OpenAlex](https://openalex.org), [Europe PMC](https://europepmc.org), [Open Library](https://openlibrary.org).

MIT licensed.

## Sample provenance and offline regression checks

`npx tsx scripts/record-sample.ts` records a fresh run against public indexes, verifies every intended verdict, and only then replaces `src/core/sample-snapshot.json` and the browser response fixture. It shares the existing OpenAlex daily counter, never overrides verdicts, and leaves `eval/*.json` unchanged. The sample includes explicitly constructed demonstration errors.

`npx tsx scripts/replay-eval.ts` replays the committed 300-trial evaluation from `eval/cache` without network requests or result-file changes. Cache misses are reported, never filled with invented responses.

`node --import tsx scripts/record-paper.ts` records the constructed full-paper example live. `--from-saved` explicitly assembles it from the dated existing live sample evidence, retaining that date and provenance. Neither mode changes eval result files.
