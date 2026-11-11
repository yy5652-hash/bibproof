# 30-entry dev_public pilot; NOT a benchmark result

Selected 30; completed 30. Comparison rows use exactly these 30 completed input keys, including abstentions.

| Tool | n | DR | FPR | F1 | Tier-3 F1 | Coverage | All-input DR | FP | U valid | U hall |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Bibproof | 30 | 87.5% | 0.0% | 93.3% | 100.0% | 100.0% | 87.5% | 0 | 0 | 0 |
| Zero-shot GPT-5.1 (saved) | 30 | 87.5% | 21.4% | 84.8% | 60.0% | 100.0% | 87.5% | 3 | 0 | 0 |
| Cascade GPT-5.1 variant (saved) | 30 | 100.0% | 7.1% | 97.0% | 88.9% | 100.0% | 100.0% | 1 | 0 | 0 |

DOI-only and released Sonnet cascade: exact subset rescore unavailable (no complete saved predictions at pin). Published full-split aggregates are retained in JSON as context only. GPT-5.1 cascade is explicitly a different saved variant.

| Hallucination type | Inputs | TP | FN | Uncertain | Missing | All-input DR |
|---|---:|---:|---:|---:|---:|---:|
| arxiv_version_mismatch | 1 | 1 | 0 | 0 | 0 | 100.0% |
| chimeric_title | 1 | 1 | 0 | 0 | 0 | 100.0% |
| fabricated_doi | 1 | 1 | 0 | 0 | 0 | 100.0% |
| future_date | 1 | 1 | 0 | 0 | 0 | 100.0% |
| hybrid_fabrication | 1 | 1 | 0 | 0 | 0 | 100.0% |
| merged_citation | 1 | 1 | 0 | 0 | 0 | 100.0% |
| near_miss_title | 1 | 1 | 0 | 0 | 0 | 100.0% |
| nonexistent_venue | 1 | 0 | 1 | 0 | 0 | 0.0% |
| partial_author_list | 1 | 1 | 0 | 0 | 0 | 100.0% |
| placeholder_authors | 1 | 1 | 0 | 0 | 0 | 100.0% |
| plausible_fabrication | 2 | 2 | 0 | 0 | 0 | 100.0% |
| preprint_as_published | 1 | 0 | 1 | 0 | 0 | 0.0% |
| swapped_authors | 2 | 2 | 0 | 0 | 0 | 100.0% |
| valid | 14 | 0 | 0 | 0 | 0 | 0.0% |
| wrong_venue | 1 | 1 | 0 | 0 | 0 | 100.0% |

Actual OpenAlex keyword searches: 16 (0.533/entry). Linear projection: 443.2 searches, 6 days at 80/day. Paid API spend: $0. This is a pilot extrapolation, not a benchmark result or a quota guarantee.

Adjusting for the test label mix (307 valid / 524 hallucinated): 491.5 searches, 7 days at 80/day. Small-stratum pilot estimates remain uncertain.
