# Fast Path Check

> For an Orange County permit tech, homeowner or nonprofit PM: upload a city's permit checklist (or describe a listed lot) and get the fastest legal approval path, its legal clock, and every place the city's form is out of step with current California law, each claim sourced and dated.

**Team:** [team name]
**Members:** [names]
**Lane:** 2 Clear it
**Built at:** Claude Impact Lab: UCI × SoCal Affordable Housing, November 7, 2026

**Prototype, not legal advice.** It never submits anything or contacts a city.

> Status: in progress. See [PLAN.md](PLAN.md) for the full build plan, architecture, test cases and team split.

---

## The real user

**C03, a city permit tech** (made up, from the lane's `scenarios.json`): *"I want to tell applicants the right answer the first time, even when our form is out of date."* City checklists fall behind state law. Anaheim's November 2025 ADU checklist still cites Gov Code 65852.2 and 65852.22, which SB 477 renumbered in 2024, and counter staff can't easily tell which lines state law still backs.

**Before:** the checklist cites renumbered law, nobody notices, and the applicant goes through extra correction cycles. Every month of waiting costs money.
**After:** the tech uploads the checklist PDF and gets back a dated report that maps old citations to current law, flags possible conflicts, and states the legal clock.

It also serves the lane's other two made-up users:

| User | What they get |
|---|---|
| **C01, homeowner adding an ADU** | Which forms, in what order, what they cost, and how long the city can legally take |
| **C02, nonprofit project manager** | Two cities side by side, with gaps marked "unknown" rather than guessed |

## What we built

A **Next.js website** backed by **Claude agents**. The user uploads a checklist PDF (checklist mode) or describes a publicly listed OC lot (site mode), and gets one report:

1. **The fast path:** which ministerial route fits (ADU/JADU, SB 9, SB 684 map for 10 or fewer parcels, or streamlined multifamily), the legal clock (e.g., 60 days for an ADU), and the statute
2. **Stale law:** each outdated citation mapped to its current section, with a source link
3. **Possible overreach:** items that look stricter than state law, flagged *"possible conflict, confirm with city staff or counsel."* It never calls anything illegal
4. **Steps, fees and timelines:** what to submit, in what order, what it costs, and how long that city actually takes according to its state-reported APR data
5. **Package gaps:** what the applicant hasn't provided yet (Present / Missing / Inconsistent / Can't tell)
6. **What we couldn't verify today:** always shown

Every legal or numeric claim carries a source URL and the date it was checked.

**Demo video:** [TBD]
**Live demo:** [TBD]

## How Claude is used

**Inside the tool**, a master agent directs three subagents through the Claude API (`claude-opus-5-5`):

```
Upload (PDF + city + project type)  →  /api/check (server only)
                                          │
                                   MASTER AGENT  decides order, re-runs a step,
                                          │      or stops to ask the user
          ┌───────────────────────────────┼───────────────────────────────┐
     1. PARSER                      2. COMPLIANCE                    3. PRODUCER
     PDF → structured items,        Checks each item against         Builds the report:
     citations, package items       current law with web search      path, steps & fees,
                                    + web fetch (HCD, data.ca.gov,   audit table, gaps,
                                    city sites) and our reference    "couldn't verify"
                                    files
```

- The master agent is a true agent. It picks which subagent to call, re-runs one when output is incomplete, and stops to ask the user when an upload is unreadable or a source is blocked. It has a cap on tool calls so it always ends with a report or a clear question.
- The rules every agent follows live in [`fast-path-check/SKILL.md`](fast-path-check/SKILL.md): never invent a statute, fee or deadline; source and date every claim; label assumptions; never call something illegal.
- **What a person checks:** every "possible conflict" before acting on it, and anything in "what we couldn't verify today."

**To build it**, we used Claude Code to plan, research the lane's sources, and write the app.

## Try it

```bash
cd web
npm install
echo "ANTHROPIC_API_KEY=your-key-here" > .env.local   # never commit this; .env* is gitignored
npm run dev
# open http://localhost:3000 and upload evals/fixtures/anaheim-adu-checklist-z412-nov-2025.pdf
```

Needs Node 20+ and a Claude API key. The key is read only by server code and never sent to the browser. No keys are in the repo.

## Sources and assumptions

Full URLs, resource IDs and working API queries are in [fast-path-check/reference/sources.md](fast-path-check/reference/sources.md). Every source with its date checked is in [sources.md](sources.md).

| Source | Used for | Web fetch works? (tested 2026-11-07) |
|---|---|---|
| HCD guidance (ADU Handbook Mar 2026, Housing Law Fact Sheets Apr 2026, SB 9 fact sheet, SB 35 / AB 2011 guidelines) | Plain-English rules with current section numbers | Yes |
| HCD SMAP dashboard | Whether SB 35/423 streamlining applies in a given city | Yes |
| data.ca.gov CKAN API (APR Tables A / A2) | A city's reported permit counts and dates. Filter on `JURIS_NAME`, not `q=` | Yes |
| City permit pages | The city's current checklist and fees | Irvine yes; Anaheim no (403) |
| leginfo.legislature.ca.gov | Statute text | **No (403).** Sections are checked by hand in a browser and recorded in `reference/sources.md` |
| User upload | Cities that block automated fetches (Anaheim, Costa Mesa, Fullerton, Orange) | n/a |
| Web search | Anything not on the list, and the fallback for leginfo | Yes |

Fetched sources are cached for one day, so we don't hit the same page on every run.

**Assumptions:**
- ASSUMPTION: the statute clocks and tests in `reference/pathways.md` match current law. The sections were confirmed to exist, but the clocks weren't checked against the statute text.
- ASSUMPTION: the city checklist URLs in `reference/cities.md` are current as of their "date checked."
- ASSUMPTION: Irvine's very low ADU counts in the APR data (42 rows, against 1,871 for Anaheim) reflect how Irvine categorizes units in its reports, not how many ADUs are actually built.
- ASSUMPTION: the four-year baseline and "$85k of time costs on a $535k home" come from the lane's `timeline.json` and are estimates, not measurements.
- ~~ASSUMPTION: Claude's web fetch can open leginfo.~~ Tested 2026-11-07: it can't (403).

## What is real and what is mocked

| Part | Status |
|---|---|
| Rules and reference files (`fast-path-check/`) | Working: SKILL.md, sources, cities (Anaheim + Irvine), renumbering, pathways, report template |
| Anaheim checklist test file | Working: real public PDF in `evals/fixtures/` |
| Upload page and report view | In progress |
| Master agent + parser / compliance / producer subagents | In progress |
| Site mode (listed lot) | Planned |
| Test log (`evals/test-cases.md`) | In progress |

*Update this table before the demo.*

## Early findings

**HCD already told Anaheim to fix these citations.** In a March 24, 2025 findings letter, HCD said Anaheim's ADU ordinance cites 65852.2, 65852.22 and 65852.26, sections "deleted by SB 477," and that "the City must amend the Ordinance to refer to the correct code sections." Anaheim's November 2025 ADU checklist still cites 65852.2 and 65852.22. HCD's January 2025 letter to Irvine flagged the same stale citations, a 120-day review timeline (state law allows 60, Gov 66317), and deed restrictions on all ADUs. Details are in [research/hcd-letters.md](research/hcd-letters.md).

**A possible JADU overreach.** Anaheim's checklist requires an owner-occupancy covenant for **all** JADUs, citing 65852.2 and 65852.22, neither of which has current text on leginfo. Current Gov 66333(b) requires owner-occupancy only when the JADU shares sanitation with the main house. That's a **possible conflict to confirm with city staff or counsel**, not a ruling. HCD's 2025 letter to Anaheim didn't raise it. Details are in [cities.md](fast-path-check/reference/cities.md).

## Orange County, all 35 jurisdictions

We joined the state's APR data with HCD's letters for every OC city and the county ([research/oc-adu-scorecard.md](research/oc-adu-scorecard.md)):

- **25 of 35 jurisdictions** have at least one HCD letter on their ADU rules (37 letters in total). The same problems recur: citations SB 477 deleted, and deed restrictions or owner-occupancy rules on ADUs.
- **Dana Point** has two HCD notices of violation and the slowest permit-to-occupancy time in the county (388-day median). **Huntington Beach** got a notice of potential violation for moving to stop ADU permits. The overlap between enforcement and slowness is a correlation, not proof of cause.
- ADU permits grew from **297 units in 2018 to 3,071 in 2025** (14,083 in total).
- Data gaps are reported, not hidden: Huntington Beach reports zero certificates of occupancy, and Irvine reports only 15 ADU permits.

## Deterministic checks

Alongside the Claude agents, [`web/lib/features/`](web/lib/features/README.md) has tools that need no model and can't hallucinate (27 tests):

- **Citation scanner**, built from HCD's official conversion table. It catches both stale citations in Anaheim's checklist and maps chains like 65852.2(f) → 66324 → 66311.5.
- **Gov 66317 shot clock:** completeness deadline (15 business days), deemed complete, no new items on resubmittal, 60-day decision or deemed approved. It can draft a polite rights letter with placeholders.
- **Scored against HCD's own findings:** on Anaheim's checklist, the scanner and the agent output both catch HCD's in-scope finding (statutory numbering). `web/scripts/score-hcd.ts` runs it.
- **Delay-cost calculator** using the mentor's mortgage math, and a **source monitor** that flags when a PDF we rely on changes or a blocked site becomes fetchable.
- API: `POST /api/tools/citations`, `POST /api/tools/shot-clock`, `POST /api/tools/delay-cost`, `GET /api/tools/oc?city=`.

## How this differs from CrossBeam

[CrossBeam](https://cc-crossbeam.vercel.app), built by our mentor Mike Brown, won Anthropic's "Built with Opus 4.6" hackathon. It works **after plan check**: it reads a city's corrections letter and the construction plans, then drafts responses. Fast Path Check works **before submittal**: it checks whether the city's own checklist matches current state law, finds the approval path and its legal clock, and lists package gaps. The two fit together. *CrossBeam helps you answer the city's corrections; Fast Path Check checks whether the city's own rules are current before you submit.* More in [research/crossbeam-comparison.md](research/crossbeam-comparison.md).

## Where it gets things wrong

- Leginfo blocks automated fetches, so statute text comes from hand-checked entries, HCD guidance and web search, not a live read of the code.
- HCD's enforcement letters sit in an embedded dashboard. For OC we found 37 letters by search ([data/oc-hcd-letters.json](data/oc-hcd-letters.json)), but an empty list for a city means none was found, not that none exists.
- No OC data on plan-check correction cycles exists, so it can't say how many resubmittals a city typically requires. Our mentor's estimate is 3–4 rounds for an ADU, but that's one practitioner's experience, not data.
- SB 684 (Gov 66499.41) has four versions on leginfo and no HCD guidance yet. Treat any SB 684 answer as "confirm."

## Testing

Tracked in `evals/test-cases.md`, and run through the website:

| # | Case | Must do |
|---|---|---|
| 1 | Anaheim ADU checklist (C03) | Flag 65852.2 / 65852.22 and map them to 66310–66342 / 66333 with an HCD source |
| 2 | Irvine ADU homeowner (C01) | List the submittal items, state the 60-day clock with its source |
| 3 | Anaheim vs Irvine (C02) | Side-by-side comparison, with gaps marked "unknown" |
| 4 | Trick: unmapped old citation | Fetch it or say "unknown." Never guess a section number |
| 5 | Trick: blocked source | Ask for an upload. Don't retry or make up content |
| 6 | Trick: live source vs reference file disagree | Show both, prefer the live source, flag the file |
| 7 | Trick: bad upload (not a checklist) | Stop and tell the user |
| 8 | Real public case (a listed OC lot, 4–12 homes) | Pick candidate paths; label every unsourced fact ASSUMPTION; no owner names |
| 9 | Trick: SB 9 (2021) vs SB 9 (2025) | Say which bill it means |

Results: *TBD, to be logged as tests are run.*

## Real-user evidence

We interviewed **Mike Brown**, who works with cities on ADU permitting and built CrossBeam, first-place winner of Anthropic's "Built with Opus 4.6" Claude Code hackathon, on 2026-11-07. Full notes are in [research/mentor-interview.md](research/mentor-interview.md). These are one practitioner's estimates, not measured data:

- **"More than 90%" of first-time ADU applications in Laguna Beach are incomplete.** Common misses are a soils report, a grading plan and a fire plan.
- **3–4 correction rounds is typical.** Cities often push back on completeness first, because the state clock only starts once an application is complete.
- **City checklists are often out of date with state law**, but applicants pick their battles before telling a city it's out of compliance.
- **Our $85k delay-cost figure is probably too low.** On his framework, interest alone on a $428k loan at 7.3% is about $2,600 a month, or about $125k over 4 years (ASSUMPTION: his rate and 20% down).

**What we checked:** the "shot clock" he described is **Gov 66317**, read in a browser 2026-11-07. The city must decide completeness within **15 business days** and list every missing item. It can't add new items when the applicant resubmits, and if it misses the deadline the application is deemed complete. It then has **60 days** to approve or deny, or the application is deemed approved.

**What we changed:** package gaps are now treated as a headline result, and the report cites 66317 for both deadlines.

## Next steps

- **Next month:** a city permit tech runs their own checklist through it before the next form revision. Applicants check their package before they submit.
- **With one more week:** fill `oc-cities.json` for all 34 OC cities and run the first-ever audit of every OC city's ADU checklist against current law (DATA-SOURCES.md notes nobody has done this). Adding a city is one row in `reference/cities.md`.

## Data and privacy

This project uses only public or provided data. It contains no personal information about real tenants, buyers or residents. Uploads are processed in memory and not stored. It does not file applications or contact any city or person.

## License

[MIT](LICENSE)
