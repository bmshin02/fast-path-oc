# Deterministic features (`more-feats`)

Tools that need **no API key and no model**, so they can't hallucinate and run in milliseconds. They sit next to the Claude agents in `lib/agents/`. Use them as cross-checks on agent output, as extra report sections, or on their own.

All of them follow the project rules: every legal claim cites a source and date, assumptions are labeled, nothing is called illegal ("possible violation", "confirm"), and no personal information is needed (letters use `[PLACEHOLDERS]`).

| Module | What it does | API route |
|---|---|---|
| `citations.ts` | Finds Gov. Code citations in text and maps renumbered ones to current law using **HCD's official SB 477 conversion table** plus the 2025 renumbers (e.g. 65852.2(f) → 66324 → 66311.5). Unknown sections come back `unverified`, never guessed. Ignores phone numbers, ZIP codes and city-code citations. | `POST /api/tools/citations` `{ text }` |
| `shot-clock.ts` | **Gov. Code 66317** deadlines: completeness decision within 15 business days (weekends and federal holidays excluded; add city closures), deemed complete if late, no new items on resubmittal, 60 days to decide or deemed approved, tolling, and the new-dwelling exception. Returns flags with subdivision citations. | `POST /api/tools/shot-clock` |
| `completeness-letter.ts` | Drafts a polite letter asserting the applicant's 66317 rights, based on the shot-clock flags. Placeholders only; "not legal advice" footer with assumptions. | `POST /api/tools/shot-clock` with `letter: { city }` |
| `delay-cost.ts` | Interest carrying cost of delay (our mentor's framework). All inputs are labeled ASSUMPTION. | `POST /api/tools/delay-cost` |
| `apr.ts` | Merges APR Table A2 rows into projects and computes permit → certificate-of-occupancy medians and percentiles, plus units by year. | (via `oc` below) |
| `scorecard.ts` | Joins APR stats with HCD letters into one row per OC jurisdiction, with data-quality flags. | `GET /api/tools/oc[?city=Anaheim]` |
| `hcd-score.ts` | Scores an audit (scanner and/or agent output) against **HCD's own findings** for that city (`data/hcd-findings.json`). Counts only findings whose subject appears in the audited document. | script only |
| `source-monitor.ts` | Checks every source we depend on against a saved baseline: PDF hashes, page status, APR dataset refresh date. Flags it if a blocked site (Anaheim, leginfo) starts returning 200. | script only |

## Scripts (from `web/`)

```bash
npx tsx --test lib/features/__tests__/*.test.ts          # 27 tests, offline
npx tsx scripts/apr-oc.ts                                 # refresh data/oc-adu-apr.json (data.ca.gov, no key)
npx tsx scripts/oc-scorecard.ts                           # rebuild data/oc-adu-scorecard.json + print table
npx tsx scripts/score-hcd.ts                              # score the scanner on Anaheim's checklist vs HCD
npx tsx scripts/score-hcd.ts --compliance lib/agents/fixtures/anaheim-compliance.sample.json
npx tsx scripts/check-sources.ts                          # compare sources to data/source-baselines.json
npx tsx scripts/check-sources.ts --update                 # save a new baseline
```

## Example requests

```bash
curl -s -X POST localhost:3000/api/tools/shot-clock -H 'content-type: application/json' -d '{
  "submissions": [
    { "received": "2026-09-01", "noticeDate": "2026-09-10", "noticeResult": "incomplete", "listedItems": ["soils report"] },
    { "received": "2026-10-01", "newItemsRequested": ["fire plan"] }
  ],
  "existingDwelling": true, "today": "2026-11-07",
  "letter": { "city": "Anaheim", "projectLabel": "detached ADU" }
}'
# → flags 66317(a)(2)(F) (no notice within 15 business days → deemed complete)
#   and 66317(a)(2)(D) (new item on resubmittal), decision due 2026-11-30, plus a draft letter

curl -s 'localhost:3000/api/tools/oc?city=Dana%20Point'
# → 5 HCD letters incl. two notices of violation; median permit→CO 388 days (n=41)
```

## Wiring ideas for the agents (not done here, to avoid editing Person A/C files)

- **Compliance agent:** run `scanText` on the parsed checklist and pass the results in as hard facts, then reject any agent output whose stale-citation mapping contradicts the scanner.
- **Report:** add a "Your clock" box from `computeClock` when the applicant gives a submittal date, and a "What HCD has said about this city" section from `/api/tools/oc?city=`.
- **Evals:** add `scripts/score-hcd.ts` to the test log as the "checked against the state's own findings" result.

## Assumptions to keep visible

- Business days exclude weekends and U.S. federal holidays. Cities may close on other days too; pass those dates in `extraClosures`.
- When an application is deemed complete because the city missed its deadline, the 60 days run from that submission's receipt date.
- APR data is as reported by cities. Permit → CO time includes construction, so it isn't city review time.
