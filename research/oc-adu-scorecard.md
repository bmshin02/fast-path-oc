# Orange County ADU scorecard

Every Orange County jurisdiction (34 cities + unincorporated county) in one table: how many ADUs it permits, how long they take to finish, and what HCD has said about its ADU rules. Built from two public sources:

- **State APR data** (data.ca.gov, Table A2): 18,808 ADU rows, merged into 12,650 projects. Fetched 2026-11-07. Script: `web/scripts/apr-oc.ts` → `data/oc-adu-apr.json`.
- **HCD letters**: 37 letters across 25 jurisdictions, found by one web search per jurisdiction on hcd.ca.gov plus a check of HCD's Dec 2025 batch-letter URL pattern. Every URL loaded on 2026-11-07. Data: `data/oc-hcd-letters.json`.

Joined by `web/scripts/oc-scorecard.ts` → `data/oc-adu-scorecard.json`. Also served at `GET /api/tools/oc` and `GET /api/tools/oc?city=<name>`.

## What stands out

1. **ADU permitting has grown every year:** 297 ADU permit units countywide in 2018, 1,019 in 2020, 2,282 in 2022 and 3,071 in 2025. That's 14,083 in total, with 7,769 certificates of occupancy reported.
2. **Most of OC has been told its ADU rules don't comply.** 25 of 35 jurisdictions have at least one HCD ADU letter. The same problems recur: citations to the sections SB 477 deleted (Anaheim, Irvine, Buena Park, Costa Mesa, Fountain Valley, Laguna Niguel, Seal Beach, Villa Park), and deed restrictions or owner-occupancy rules on ADUs (Aliso Viejo, Irvine, Laguna Niguel, Seal Beach, Fountain Valley, Dana Point). That's exactly what Fast Path Check looks for.
3. **Two jurisdictions have enforcement letters.** Dana Point has two notices of violation (Dec 2024, Aug 2025), and HCD says it has never found any Dana Point ADU ordinance compliant. Huntington Beach got a notice of potential violation (Feb 2023) for moving to stop processing ADU permits; its council reversed course.
4. **Four ordinances on file date from 2020,** per HCD's Dec 5, 2025 letters: Laguna Woods, Los Alamitos, Orange County and Yorba Linda.
5. **Time from permit to certificate of occupancy** (construction plus final inspections, not just city review) ranges from about **210 days** (La Habra, Westminster) to **388 days** (Dana Point) among the 24 jurisdictions with at least 30 measured projects. Dana Point is both the slowest and the only city with notices of violation. **That's a correlation in two numbers, not evidence that one causes the other.**
6. **Data gaps worth saying out loud:** Huntington Beach reports 496 ADU permit units but zero certificates of occupancy; Irvine reports only 15 ADU permit units in total; Rancho Santa Margarita's dates give 0-day medians. Report these as-is and don't rank cities on them.

## Limits

- An empty letter list means none was **found**, not that none exists. HCD's dashboard is the authoritative index.
- Only the Anaheim and Irvine letters were read in full. The other summaries are short paraphrases from search excerpts.
- A letter shows HCD's position on a date. A city may have amended its ordinance since.
- APR data is as reported by each city, and quality varies. It has no application-submitted dates and no correction cycles, so it can't measure city review time on its own.

## The table

| Jurisdiction | ADU permits (all years) | Latest year | Median permit→CO (days, n) | HCD letters | Latest HCD letter | Notes |
|---|---:|---|---|---:|---|---|
| Aliso Viejo | 3 | 2 in 2025 | 379 (n=1) | 1 | [2024-06-25 findings](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/aliso-viejo-adu-findings-062524.pdf) | Permit→CO median rests on only 1 project. |
| Anaheim | 1,866 | 441 in 2025 | 278 (n=806) | 2 | [2025-03-24 findings](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/anaheim-adu-sb9-findings-032425.pdf) |  |
| Brea | 112 | 27 in 2025 | 251 (n=44) | 0 | none found | No HCD ADU letter found (that doesn't mean none exists). |
| Buena Park | 350 | 179 in 2025 | 239 (n=119) | 2 | [2025-05-28 findings](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/buena-park-adu-findings-052825.pdf) |  |
| Costa Mesa | 420 | 89 in 2025 | 316 (n=148) | 2 | [2024-09-11 findings](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/costa-mesa-adu-findings-091124.pdf) |  |
| Cypress | 85 | 20 in 2025 | 252 (n=37) | 0 | none found | No HCD ADU letter found (that doesn't mean none exists). |
| Dana Point | 66 | 13 in 2025 | 388 (n=41) | 5 | [2025-09-30 city response](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/dana-point-nov-response-093025.pdf) | HCD enforcement letter on record. |
| Fountain Valley | 416 | 65 in 2025 | 227 (n=249) | 1 | [2024-12-06 findings](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/fountain-valley-adu-findings-120624.pdf) |  |
| Fullerton | 2,291 | 589 in 2025 | 316 (n=287) | 0 | none found | No HCD ADU letter found (that doesn't mean none exists). |
| Garden Grove | 2,603 | 434 in 2025 | 273 (n=1415) | 1 | [2026-03-30 findings](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/garden-grove-adu-findings-03302026.pdf) |  |
| Huntington Beach | 496 | 87 in 2025 | — | 1 | [2023-02-21 notice of potential violation](https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/HAU/HuntingtonBeachNOPV-ADU-022123.pdf) | Reports ADU permits but zero certificates of occupancy: likely a reporting gap. HCD enforcement letter on record. |
| Irvine | 15 | 8 in 2025 | 483 (n=6) | 2 | [2025-03-27 technical assistance](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/irvine-adu-ta-032725.pdf) | Permit→CO median rests on only 6 projects. |
| La Habra | 372 | 29 in 2025 | 210 (n=100) | 1 | [2022-04-08 findings](https://www.hcd.ca.gov/policy-research/docs/ordinance-review-letters/lahabraaduordinanceresponse040822.pdf) |  |
| La Palma | 21 | 4 in 2025 | 192 (n=7) | 0 | none found | Permit→CO median rests on only 7 projects. No HCD ADU letter found (that doesn't mean none exists). |
| Laguna Beach | 456 | 66 in 2025 | 336 (n=178) | 0 | none found | No HCD ADU letter found (that doesn't mean none exists). |
| Laguna Hills | 27 | 15 in 2025 | 191 (n=8) | 1 | [2025-08-19 technical assistance](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/laguna-hills-adu-ta-081925.pdf) | Permit→CO median rests on only 8 projects. |
| Laguna Niguel | 56 | 14 in 2025 | 294 (n=25) | 2 | [2024-08-22 findings](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/laguna-niguel-adu-findings-08222024.pdf) |  |
| Laguna Woods | — | — | — | 1 | [2025-12-05 technical assistance](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/laguna-woods-adu-ta-12052025.pdf) | No ADU rows in APR Table A2. HCD says the ordinance on file dates from 2020. |
| Lake Forest | 88 | 28 in 2025 | 284 (n=52) | 2 | [2022-10-17 compliance](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/Lake-Forest-ADU-101722.pdf) |  |
| Los Alamitos | 21 | 7 in 2025 | 303 (n=12) | 1 | [2025-12-05 technical assistance](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/los-alamitos-adu-ta-12052025.pdf) |  |
| Mission Viejo | 150 | 35 in 2025 | 248 (n=41) | 0 | none found | No HCD ADU letter found (that doesn't mean none exists). |
| Newport Beach | 250 | 57 in 2025 | 345 (n=104) | 1 | [2024-10-01 findings](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/newport-beach-adu-findings-100124.pdf) |  |
| Orange | 459 | 88 in 2025 | 236 (n=200) | 1 | [2022-10-11 findings](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/OrangeADUOrdinanceResponse101122.pdf) |  |
| Orange County | 372 | 101 in 2025 | 314 (n=189) | 1 | [2025-12-05 technical assistance](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/orange-county-adu-ta-12052025.pdf) | HCD says the ordinance on file dates from 2020. |
| Placentia | 134 | 30 in 2025 | 251 (n=57) | 1 | [2023-11-27 technical assistance](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/placentia-adu-ta-112723.pdf) |  |
| Rancho Santa Margarita | 13 | 6 in 2025 | 0 (n=4) | 1 | [2022-08-10 findings](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/RanchoSantaMargaritaADUResponse081022.pdf) | Permit→CO median rests on only 4 projects. Median permit→CO of 0 days: dates look copied, not real milestones. |
| San Clemente | 183 | 37 in 2025 | 271 (n=124) | 0 | none found | No HCD ADU letter found (that doesn't mean none exists). |
| San Juan Capistrano | 117 | 14 in 2025 | 319 (n=40) | 1 | [2022-02-23 findings](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/SanJuanCapistranoADU022322.pdf) |  |
| Santa Ana | 1,124 | 258 in 2025 | 287 (n=682) | 0 | none found | No HCD ADU letter found (that doesn't mean none exists). |
| Seal Beach | 16 | 8 in 2025 | 407 (n=7) | 2 | [2024-08-20 findings](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/seal-beach-adu-findings-08202024.pdf) | Permit→CO median rests on only 7 projects. |
| Stanton | 186 | 35 in 2025 | 275 (n=100) | 0 | none found | No HCD ADU letter found (that doesn't mean none exists). |
| Tustin | 107 | 34 in 2025 | 221 (n=46) | 0 | none found | No HCD ADU letter found (that doesn't mean none exists). |
| Villa Park | 40 | 2 in 2025 | 273 (n=3) | 1 | [2024-12-24 findings](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/villa-park-adu-findings-122424.pdf) | Permit→CO median rests on only 3 projects. |
| Westminster | 1,014 | 215 in 2025 | 211 (n=601) | 2 | [2023-12-18 findings response](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/westminster-resp-reg-adu-findings-121823.pdf) |  |
| Yorba Linda | 154 | 34 in 2025 | 258 (n=59) | 1 | [2025-12-05 technical assistance](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/yorba-linda-adu-ta-12052025.pdf) | HCD says the ordinance on file dates from 2020. |

*APR data fetched 2026-11-07; HCD letters checked 2026-11-07.*

