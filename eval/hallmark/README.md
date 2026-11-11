# Bibproof × HALLMARK

Completed **30-entry dev_public pilot**, not a full benchmark result. No full test run was started and no commit was created. Project changes for this task are confined to `scripts/hallmark/` and `eval/hallmark/`.

## Data and attribution

HALLMARK by Patrik Reizinger and Wieland Brendel, [upstream repository](https://github.com/rpatrik96/hallmark), pinned to **c62d296d1d2e3e6f9cb325e37963b63350ab2ca4**, verified locally as tag **v1.2.4**. Dataset directory is `data/v1.2/` at that commit (directory version and release version differ). Cite *HALLMARK: Diagnosing Three Failure Modes in LLM Citation Verifiers*, 2026, [arXiv:2607.18360](https://arxiv.org/abs/2607.18360).

MIT License; Copyright (c) 2026 Patrik Reizinger. The complete required license notice is preserved at [data/upstream/LICENSE](data/upstream/LICENSE); upstream README, schema, evaluator and selected provenance scripts are also retained. [data/manifest.json](data/manifest.json) records the full pin, upstream paths, byte counts and SHA-256 of every downloaded artifact. Originals are unchanged, including malformed JSON numeric values.

Actual counts:

| Split | Total | VALID | HALLUCINATED |
|---|---:|---:|---:|
| dev_public | 1,119 | 504 | 615 |
| test_public | 831 | 307 | 524 |
| test_public excluding GPTZero source | 800 | 307 | 493 |

Test counts match the brief. Both splits contain all 14 hallucination types, including the three taxonomy types described upstream as stress-test types. They are retained here because they actually occur in the pinned public files; nothing was silently excluded.

The 31 test overlaps are identified by `source == "gptzero_neurips2025"`. Public split keys are hashes; raw GPTZero keys are `gptzero_neurips2025_NNN`, so direct key intersection is **zero**. Exact title matches corroborate 27/31; four titles have changed, so title equality would undercount. The source field is the exclusion authority allowed by the brief. All 31 keys are recorded in each test selection manifest. The dev split has 38 such source entries, and none are excluded from the default pilot.

## Commands

Run from the repository root, using the existing installed dependencies (no dependency or package-lock changes):

```sh
python3 scripts/hallmark/fetch.py
npx tsx --test scripts/hallmark/harness.test.ts
npx tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --esModuleInterop --types node scripts/hallmark/*.ts
npx tsx scripts/hallmark/run.ts --split dev_public --pilot 30 --openalex-budget 80
npx tsx scripts/hallmark/score.ts --split dev_public --pilot 30
python3 scripts/hallmark/check_official.py
npx tsx scripts/hallmark/replay.ts
```

The pilot command above is the command executed for the recorded live pilot. Resume refuses changed source/harness hashes to prevent pooling versions. This recorded pilot predates concurrent product edits and subsequent harness hardening, so **do not restart it against today's edited files**; use `replay.ts` to reproduce the preserved version offline. For a new live version, archive the existing run directory first, retain its evidence and score files, then invoke the pilot command; this spends a new search budget.

Only the following **preparation** commands were run for test_public. They write the fixed keys before any checking and make no network calls:

```sh
npx tsx scripts/hallmark/run.ts --split test_public --prepare-only
npx tsx scripts/hallmark/run.ts --split test_public --exclude-gptzero --prepare-only
npx tsx scripts/hallmark/run.ts --split test_public --sample 400 --prepare-only
```

Future full run, **not executed**: `npx tsx scripts/hallmark/run.ts --split test_public --openalex-budget 80`. Repeat the same command on subsequent UTC days to resume by `bibtex_key`, provided source, harness and data are unchanged. Add `--exclude-gptzero` or `--sample 400` to use those separately named manifests/runs. The 400 sample has exactly 154 VALID + 246 HALLUCINATED; hallucinations are apportioned proportionally across all 14 types. Pilot label quotas are proportional: 14 + 16. Both use Hamilton largest-remainder allocation (lexical ties), then SHA-256(bibtex_key) ascending within strata and for final run order. Selection JSON is immutable on resume; a changed selection is an error.

Scoring a chosen manifest: `npx tsx scripts/hallmark/score.ts --selection eval/hallmark/selections/dev_public-pilot30.json`. Results are saved as `results-<selection-name>.json/.md` and as the latest `results-<split>.json/.md`; every result embeds its precise selection and pilot scope.

## Production path and safeguards

- Converter accepts only blind `bibtex_key`, `bibtex_type`, `fields`, `raw_bibtex`. It follows upstream `BlindEntry.to_bibtex()` (prefer raw BibTeX, otherwise sorted fields), then calls the actual `importBibliography()` from `src/core/format.ts`, followed by the actual `extractReferences()` from `src/core/extract.ts`, as the uploaded `.bib` path does. It does not insert identifiers or fix bibliographic data. Labels/types/source are used only in selection and scoring. Conversion failure yields UNCERTAIN with its error.
- Citation.js packages are the installed **0.9.0**. Context7 was consulted for official [BibTeX plugin registration](https://github.com/citation-js/citation-js/blob/main/packages/plugin-bibtex/README.md) and [CSL text/APA formatting](https://github.com/citation-js/citation-js/blob/main/packages/core/docs/cite_output.md); Context7 did not supply a version-specific index, so the existing installed production route is the implementation authority.
- Runner calls the real `verifyReference()` and `IndexClient`, using public live APIs. Per-host queues retain the existing one-second interval, including serial Crossref retries. API call count is actual outgoing fetch attempts, including retries; cache hits are not HTTP calls. Sources queried include lookup attempts served from cache; audit records distinguish them.
- `cache/` is gitignored, with separate atomic disk response cache and UTC daily search ledger. Default budget is 80 OpenAlex **keyword-search transport attempts**, including retries, not singleton DOI lookups. Quota is reserved immediately before fetch (a crash at that instant can conservatively consume one reservation without a completed request). Provider daily-budget failures also pause the entry. The existing production client's own quota/cooldown rules still apply.
- Once the daily budget is reached, stop cleanly. If hit mid-entry, append audit to `deferred.jsonl`, save **no prediction**, and retry that key tomorrow with retained cache. Entries completed before interruption stay done. SIGINT/SIGTERM finish the current entry then stop; malformed/duplicate JSONL fails closed. A harness-local runner lock prevents competing writers; it is not a desktop/browser lock. After a crash, remove `cache/runner.lock` only after confirming its process ended.
- Full audit and HALLMARK-format prediction JSONL are in `runs/<selection>/`. Snapshot startup production/harness sources and record hashes; refuse code/data drift on resume. Raw predictions contain exactly `bibtex_key`, `label`, `confidence`, `reason`, `api_sources_queried`, `wall_clock_seconds`, `api_calls`.

Verdict mapping, fixed before pilot:

| Production verdict | HALLMARK label | Fixed confidence |
|---|---|---:|
| Verified | VALID | 0.95 |
| Details differ | HALLUCINATED | 0.80 |
| Identifier conflict | HALLUCINATED | 0.95 |
| No record found | HALLUCINATED | 0.70 |
| Could not check | UNCERTAIN | 0.50 |
| Retracted | Identity decision before retraction | Identity verdict's confidence; 0.50 if unavailable |

For Retracted, replay the same production verifier over the exact observed HTTP records, with only index retraction markers removed. No new network calls or duplicated scoring thresholds. Verified identity maps VALID; conflicting/differing metadata maps HALLUCINATED; unavailable or inconclusive identity maps UNCERTAIN and explains why. Confidence numbers are documented heuristics for probability of the predicted label being correct; **they are not calibrated**.

## Completed pilot

30 selected and completed on 2026-11-10 UTC: 14 valid, 16 hallucinated. One entry per type except plausible_fabrication and swapped_authors, two each.

| Tool, same 30 keys | DR | FPR | F1 | Tier-3 F1 | Coverage | TP / all hall | FP | U valid / hall |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Bibproof | 87.5% | 0.0% | 93.3% | 100.0% | 100.0% | 14/16 | 0 | 0 / 0 |
| Saved zero-shot GPT-5.1 | 87.5% | 21.4% | 84.8% | 60.0% | 100.0% | 14/16 | 3 | 0 / 0 |
| Saved cascade GPT-5.1 variant | 100.0% | 7.1% | 97.0% | 88.9% | 100.0% | 16/16 | 1 | 0 / 0 |

Bibproof confusion counts: TP=14, FN=2, TN=14, FP=0; no missing or uncertain inputs. Misses: `f1411ce61763` (nonexistent_venue), `fe44dcc587ce` (preprint_as_published), both Verified. Per-type details are in [results-dev_public-pilot30.md](results-dev_public-pilot30.md) and JSON. This small pilot cannot establish general accuracy, reliable zero-FPR behavior, or a leaderboard ranking. Tier-3 F1 rests on only four hallucinated inputs.

Actual resource use: **94 HTTP calls**, 80 HTTP 200 and 14 HTTP 404; no failed index responses. **16 OpenAlex keyword searches**, mean **0.533/entry**; each entry's count (0 or 1 here) is in `results-dev_public-pilot30.json` → `cost.per_entry`, and raw URLs/timings are in the audit. Total check time **58.975 s** (invocation 58.988 s). Public endpoints only, no API keys, paid calls or paid baseline reruns: observed paid API spend **$0**.

Linear pilot projection for all 831: **443.2 keyword-search attempts**, **6 daily budgets at 80/day**, about **2,604 HTTP attempts** and **27.2 minutes of active checking** if the same average holds. Wall-clock completion remains quota-bound across days. This is a rough extrapolation, not a guarantee: test mix, retries, caching, index drift and singleton quotas can change it. Existing pilot usage also consumes today's harness budget. A label-mix-adjusted projection uses the measured 3/14 searches per valid input and 13/16 per hallucinated input: `307 × 3/14 + 524 × 13/16 = 491.5` searches, or **7 daily budgets**. Thus 6–7 days is the pilot-based planning range, with seven better reflecting test label composition; neither estimate is guaranteed.

## Scoring and comparison limits

UNCERTAIN, unevaluated and missing records are excluded from TP/FP/TN/FN, as upstream does. Selective coverage = definite answers / selected inputs; response coverage additionally includes uncertain answers. All-input detection = TP / **all** selected hallucinated inputs, including uncertain/missing. Report raw FP, separate uncertain and missing counts by true label, tier-3 F1 (tier-3 hallucinations + **all valid** inputs), and per-type results with valid inputs borrowed for FPR/F1. Zero denominators return 0 as in upstream; inspect counts, especially tiny strata. Partial-run comparison rows use exactly completed Bibproof input keys including abstentions; selected-set metrics also expose unfinished inputs.

All saved test_public aggregate baseline JSONs at the pin were downloaded. Complete per-key saved zero-shot GPT-5.1 predictions exist in `results/checkpoints/llm_openai/openai_gpt-5.1.jsonl`; saved GPT-5.1 cascade predictions exist for both public splits. These are rescored on the exact same 30 keys, without API calls.

**Unfulfillable comparison at this pin:** released DOI-only and default `cascade_db_diagnosis` (Sonnet) have no complete per-key saved predictions. DOI relabel deltas cover only changed keys, insufficient to rescore the pilot/400/exclusion subset. Upstream `results/relabel_delta/regenerate_cascade.py` explicitly calls default cascade summary-only and reconstructs published scores. Their full-split aggregates are preserved as context in JSON, clearly separated from paired comparisons. The GPT-5.1 cascade is a named alternative saved variant, not the published default Sonnet run. No missing per-key decisions were invented and no new baseline API runs were substituted. Full compliance with the requested DOI-only/default-cascade subset comparison requires upstream per-entry artifacts.

Some pinned upstream aggregate files contain bare `NaN`, which is accepted by Python JSON output but invalid strict JSON. The scorer normalizes **only bare nonfinite numbers**, never quoted strings, to null for contextual aggregate inclusion, and records counts (six each for the dev DOI-only and zero-shot context files). Raw originals and hashes remain unchanged. Actual confusion metrics come from saved per-key predictions, not these normalized aggregate values. Upstream README prevalence prose also differs from the actual pinned file distribution; use measured counts.

## Reproducibility verification

Seven focused harness tests passed: uncertain/missing denominators and raw FP, deterministic selection and blind conversion without hidden networking, all download hashes, retry-inclusive budget/UTC rollover/cache, Crossref queue spacing, retraction identity replay, and a zero-network runner integration check for zero-budget stop and completed-key resume. Targeted TypeScript check passed. [official-metric-check.json](official-metric-check.json) confirms all three pilot table rows against the **exact pinned upstream Python confusion-matrix and per-tier functions**, including an abstention fixture.

The parallel product task edited `score.ts` during the live pilot and `parse.ts` afterward. The runner correctly returned a drift error **after** saving all 30 predictions; original `status.json` retains `source_changed_during_run: true`. The pilot used a single Node process whose modules were loaded at launch. Startup versions of both changed files were recovered and match their pre-network SHA-256 **byte for byte**; every other startup file also matches. All 26 recorded source/dependency files are preserved in `runs/dev_public-pilot30/source/`, verified by `source-snapshot.json`. `replay.ts` loads that archived production path, reads the retained HTTP cache without network, and reproduces **30/30 identical formatted references, verdicts, explanations and match IDs**. See `runs/dev_public-pilot30/replay.json` (network attempts: 0). Subsequent harness changes add automatic snapshots before loading production modules, but do not rewrite the pilot's evidence or provenance.

Cache responses are intentionally not tracked. Local offline replay needs the retained `cache/responses/`; a fresh clone can reproduce selection/code/scoring from tracked artifacts but must refetch live records to reproduce verification, and live index results may change. No full test_public predictions exist for this task.
