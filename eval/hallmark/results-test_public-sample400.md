# Prepared selection / run

Selected 400; completed 400. Comparison rows use exactly these 400 completed input keys, including abstentions.

| Tool | n | DR | FPR | F1 | Tier-3 F1 | Coverage | All-input DR | FP | U valid | U hall |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Bibproof | 400 | 87.1% | 35.1% | 83.3% | 64.8% | 97.8% | 85.0% | 53 | 3 | 6 |
| Zero-shot GPT-5.1 (saved) | 400 | 82.1% | 46.8% | 77.7% | 58.8% | 100.0% | 82.1% | 72 | 0 | 0 |
| Cascade GPT-5.1 variant (saved) | 400 | 97.6% | 5.2% | 97.2% | 93.3% | 100.0% | 97.6% | 8 | 0 | 0 |

DOI-only and released Sonnet cascade: exact subset rescore unavailable (no complete saved predictions at pin). Published full-split aggregates are retained in JSON as context only. GPT-5.1 cascade is explicitly a different saved variant.

| Hallucination type | Inputs | TP | FN | Uncertain | Missing | All-input DR |
|---|---:|---:|---:|---:|---:|---:|
| arxiv_version_mismatch | 21 | 18 | 3 | 0 | 0 | 85.7% |
| chimeric_title | 11 | 10 | 0 | 1 | 0 | 90.9% |
| fabricated_doi | 14 | 14 | 0 | 0 | 0 | 100.0% |
| future_date | 14 | 14 | 0 | 0 | 0 | 100.0% |
| hybrid_fabrication | 15 | 15 | 0 | 0 | 0 | 100.0% |
| merged_citation | 14 | 14 | 0 | 0 | 0 | 100.0% |
| near_miss_title | 19 | 11 | 8 | 0 | 0 | 57.9% |
| nonexistent_venue | 17 | 11 | 5 | 1 | 0 | 64.7% |
| partial_author_list | 14 | 5 | 9 | 0 | 0 | 35.7% |
| placeholder_authors | 15 | 14 | 0 | 1 | 0 | 93.3% |
| plausible_fabrication | 32 | 30 | 0 | 2 | 0 | 93.8% |
| preprint_as_published | 14 | 10 | 4 | 0 | 0 | 71.4% |
| swapped_authors | 30 | 29 | 0 | 1 | 0 | 96.7% |
| valid | 154 | 0 | 0 | 3 | 0 | 0.0% |
| wrong_venue | 16 | 14 | 2 | 0 | 0 | 87.5% |

Actual OpenAlex keyword searches: 198 (0.495/entry). Linear projection: 411.3 searches, 6 days at 80/day. Paid API spend: $0. This is a pilot extrapolation, not a benchmark result or a quota guarantee.

Adjusting for the test label mix (307 valid / 524 hallucinated): 413.4 searches, 6 days at 80/day. Small-stratum pilot estimates remain uncertain.
