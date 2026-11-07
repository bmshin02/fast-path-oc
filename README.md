# Fast Track

> For an Orange County homeowner adding an ADU: upload your city's housing form (or pick one of ours), answer a few plain-language questions, and download the form filled in, with every answer showing where it came from.

**Team:** [team name]
**Members:** Brandon Shin, Asher Chok, Jeffrey Song
**Lane:** 2 Clear it
**Built at:** Claude Impact Lab: UCI × SoCal Affordable Housing, November 7, 2026

**Prototype, not legal advice.** It never submits anything or contacts a city. Use made-up details only.

**Live demo:** https://fast-path-oc.vercel.app (add `?mock=1` to the `/fill` page for the scripted run that makes no API calls)
**Demo video:** [TBD]

---

## The real user

**C01, a homeowner adding an ADU** (made up, from the lane's `scenarios.json`). City application packages are long and full of boxes that don't say what they want. Irvine's ADU package is 10 pages with 247 text boxes and 156 checkboxes.

**Why it matters:** our mentor, who works with cities on ADU permitting, estimates that **more than 90% of first-time ADU applications in Laguna Beach are incomplete**, and that a typical ADU goes through 3–4 correction rounds (one practitioner's experience, not measured data; see [Real-user evidence](#real-user-evidence)). State law already protects a complete application: under Gov 66317 the city has 15 business days to say what's missing and then 60 days to decide. The hard part is getting to "complete."

**Before:** the homeowner guesses at a 10-page form, misses something, and loses weeks to a completeness letter.
**After:** they answer about 10 plain questions, Fast Track looks up the public facts itself, and they download a filled form where every answer is labeled *you told us*, *we looked it up* (with a link and date) or *the form says so*. Anything left empty is highlighted.

## What we built

A **Next.js website** backed by **Claude**:

1. **Pick or upload a form.** One of four real city forms (below), or your own PDF or Word document up to 3 MB.
2. **Answer questions.** Fast Track reads the form, asks one question at a time, and only asks what it can't work out from the form or a public source. If an answer is unclear, it asks a follow-up. The form fills in live next to the chat.
3. **Review and download.** A preview of every field with its value, where it came from, and a source link for anything looked up. Then download the filled PDF.

**Forms ready to try** (all in [`evals/fixtures/`](evals/fixtures/README.md), downloaded 2026-11-07):

| Form | City | Pages | How it's filled |
|---|---|---|---|
| ADU application package (2025) | Irvine | 10 | In place, in the city's own PDF (the building permit application on page 2) |
| Development Standards Checklist (67-01) | Irvine | 1 | In place: Claude matches its 18 boxes to their printed labels |
| Hold Harmless Affidavit (67-02) | Irvine | 2 | In place; the SSN boxes are never filled |
| ADU Submittal Requirements Checklist (Z412, Nov 2025) | Anaheim | 1 | Flat page with no boxes, so the download is a generated "filled form" PDF |

Uploaded fillable PDFs are filled in place the same way. Flat PDFs and Word files get the generated PDF.

## How Claude is used

**Inside the tool**, each turn of the conversation is one call to `POST /api/fill` ([`web/app/api/fill/route.ts`](web/app/api/fill/route.ts)):

```
Browser (form + fields so far + conversation)  →  /api/fill (server only)  →  Claude (claude-opus-5-5)
                                                        │
                       re-checks every answer before it reaches the page:
                       no signatures, no SSN / ID / bank numbers, only real PDF boxes
```

- The form goes to Claude as a document (cached, so later turns re-read it cheaply). Word files are converted to text first.
- Claude replies in a fixed JSON format: a message, the fields it filled or changed, and the next question, or "done" with what the applicant still has to do.
- Claude may **web-search** public facts (up to 3 searches a turn), such as which school district serves an address. Claude is told to give a source link for every looked-up answer, and each one gets the date it was checked; one that comes back without a link is flagged "please double-check." If Claude can't confirm something, it's told to leave the field empty rather than guess.
- Anything Claude inferred rather than was told is marked **ASSUMPTION** with how to fix it.
- **The server has the last word on safety.** Whatever Claude replies, signature fields and anything that looks like an SSN, ID, passport or bank number are left empty, and answers only go into boxes that exist in the PDF.
- **What a person checks:** every field before signing, especially anything marked ASSUMPTION or "we looked it up."

**To build it**, we used Claude Code to plan, research the lane's sources, review each other's code, and write the app.

### Also in the repo: a checklist audit engine

Before settling on Fast Track, we built an engine that checks a city's checklist against current California law: a master agent directing parser, compliance and producer subagents behind `POST /api/check` ([`web/lib/agents/`](web/lib/agents), rules in [`fast-path-check/SKILL.md`](fast-path-check/SKILL.md)). It gives back the city's own checklist PDF, marked up: renumbered statute citations rewritten in place with the current section, requirements that look stricter than state law highlighted as "possible conflict, confirm with city staff or counsel," and one page at the end listing each change with its source. It's deployed but **not wired into the website**. Its research is below under [Early findings](#early-findings).

## Try it

```bash
cd web
npm install
cp .env.example .env        # then set ANTHROPIC_API_KEY in .env; never commit it (.env* is gitignored)
npm run dev
# open http://localhost:3000, or http://localhost:3000/fill?mock=1 for the scripted run (no key needed)
```

Needs Node 20+ and a Claude API key. The key is read only by server code and never sent to the browser. No keys are in the repo or its history.

**Cost (estimate from our test runs):** about $0.10 for the first turn, $0.02–0.04 per turn after, so roughly $0.30–0.50 for a whole form.

## What is real and what is mocked

| Part | Status |
|---|---|
| Landing page, form picker, upload (PDF/Word, 3 MB) | Working, deployed |
| Questions page with real Claude calls (`/api/fill`) | Working. Tested end to end locally on the Irvine ADU application, the Irvine hold harmless affidavit and a Word upload |
| Filled PDF download | Working: in place for fillable PDFs, generated PDF for flat PDFs and Word files |
| Scripted demo (`/fill?mock=1`) | Working: a scripted conversation, no API calls. Used as the live-demo backup |
| Checklist audit engine (`/api/check`) | Built and deployed, not shown in the website |
| Test log (`evals/test-cases.md`) | In progress |

*Update this table before the demo.*

## Sources and assumptions

Every law, dataset and link we used, with the date checked, is in [sources.md](sources.md). Fetch status and working API queries are in [fast-path-check/reference/sources.md](fast-path-check/reference/sources.md).

| Source | Used for |
|---|---|
| City forms (Irvine ADU package, 67-01, 67-02; Anaheim Z412) | The forms Fast Track fills. Source URLs and checksums in [evals/fixtures/README.md](evals/fixtures/README.md) |
| Web search at run time | Public facts for a field (e.g. school district, city permit names). Each answer carries its own link and date |
| Gov 66317 (read by hand on leginfo, 2026-11-07) | The completeness and decision deadlines quoted above |
| HCD ADU Handbook (Mar 2026) and HCD letters to Anaheim and Irvine | The checklist audit engine and our early findings |

## Orange County, all 35 jurisdictions

We joined the state's APR data with HCD's letters for every OC city and the county ([research/oc-adu-scorecard.md](research/oc-adu-scorecard.md)):

- **25 of 35 jurisdictions** have at least one HCD letter on their ADU rules (37 letters in total). The same problems recur: citations SB 477 deleted, and deed restrictions or owner-occupancy rules on ADUs.
- **Dana Point** has two HCD notices of violation and the slowest permit-to-occupancy time in the county (388-day median). **Huntington Beach** got a notice of potential violation for moving to stop ADU permits. The overlap between enforcement and slowness is a correlation, not proof of cause.
- ADU permits grew from **297 units in 2018 to 3,071 in 2025** (14,083 in total).
- Data gaps are reported, not hidden: Huntington Beach reports zero certificates of occupancy, and Irvine reports only 15 ADU permits.

## Many files at once

The model only ever holds **one document plus a small, capped summary of the rest**, so 20 files work as well as one ([details](web/lib/context/README.md)):

- **Filling several forms (`/fill`):** what the applicant told us on one form is remembered for the next (in this browser tab only), so later forms pre-fill instead of re-asking. Signatures, dates and ID numbers are never remembered. Long chats are condensed so each turn stays small.
- **Checking up to 20 checklists (`/audit`):** each file is checked in its own request, 3 at a time, with duplicates skipped and results kept for this tab. Each city's known HCD letters and APR data are reused instead of re-researched per file. The summary across files is computed in code from compact digests (about 7k tokens for 20 files vs about 23k for the full results), and the marked-up form is built only when a file is opened. Try it without an API key at `/audit?mock=1`.

## Deterministic checks

Alongside the Claude agents, [`web/lib/features/`](web/lib/features/README.md) has tools that need no model and can't hallucinate (27 tests):

- **Citation scanner**, built from HCD's official conversion table. It catches both stale citations in Anaheim's checklist and maps chains like 65852.2(f) → 66324 → 66311.5.
- **Gov 66317 shot clock:** completeness deadline (15 business days), deemed complete, no new items on resubmittal, 60-day decision or deemed approved. It can draft a polite rights letter with placeholders.
- **Scored against HCD's own findings:** on Anaheim's checklist, the scanner and the agent output both catch HCD's in-scope finding (statutory numbering). `web/scripts/score-hcd.ts` runs it.
- **Delay-cost calculator** using the mentor's mortgage math, and a **source monitor** that flags when a PDF we rely on changes or a blocked site becomes fetchable.
- API: `POST /api/tools/citations`, `POST /api/tools/shot-clock`, `POST /api/tools/delay-cost`, `GET /api/tools/oc?city=`.

**Assumptions:**
- ASSUMPTION: the mentor's figures (90% incomplete, 3–4 correction rounds) are one practitioner's estimates, not measured data.
- ASSUMPTION: the four-year baseline and "$85k of time costs on a $535k home" come from the lane's `timeline.json` and are estimates. Our mentor thinks $85k is low: interest alone on a $428k loan at 7.3% is about $2,600 a month (his rate and 20% down).
- ASSUMPTION: the cost per form is from a handful of our own test runs, not a measured average.

## Where it gets things wrong

- **Field matching can miss.** The Irvine PDFs name their boxes things like `Check Box9_D1`, so Claude matches each box to its printed label. It can pick the wrong box. Check the preview before you print.
- **Flat PDFs and Word files aren't written onto the original page.** You get a generated PDF listing each field and answer, and you copy them onto the city's form.
- **Word files lose their layout** when they're converted to text, so tables and checkboxes can read oddly.
- **Looked-up facts can be wrong or out of date.** Each one shows its source and date so you can check it. Leaving unconfirmed fields empty is an instruction to Claude, not a check the server can enforce.
- **Fast Track can't tell you whether the city will approve your project.** It fills in forms; it doesn't give legal advice.
- **Only Irvine and Anaheim forms are built in**, and only in English. Uploads work for any city's form up to 3 MB.

**The checklist audit engine and OC data:**
- Leginfo blocks automated fetches, so statute text comes from hand-checked entries, HCD guidance and web search, not a live read of the code.
- HCD's enforcement letters sit in an embedded dashboard. For OC we found 37 letters by search ([data/oc-hcd-letters.json](data/oc-hcd-letters.json)), but an empty list for a city means none was found, not that none exists.
- No OC data on plan-check correction cycles exists, so it can't say how many resubmittals a city typically requires. Our mentor's estimate is 3–4 rounds for an ADU, but that's one practitioner's experience, not data.
- SB 684 (Gov 66499.41) has four versions on leginfo and no HCD guidance yet. Treat any SB 684 answer as "confirm."

## Testing

Tracked in `evals/test-cases.md` (in progress).

**Tested so far:** in the browser with real Claude calls, the Irvine ADU application end to end (fills the real PDF), the Irvine hold harmless affidavit (Claude finds the boxes itself) and a Word upload. With the scripted run, all four sample forms and the phone layout. Type check, lint and a production build pass.

**Still to test:** an upload that isn't a form, a file over 3 MB, Claude failing or timing out, and a run on the live deployment.

## Real-user evidence

We interviewed **Mike Brown**, who works with cities on ADU permitting and built CrossBeam, first-place winner of Anthropic's "Built with Opus 4.6" Claude Code hackathon, on 2026-11-07. Full notes are in [research/mentor-interview.md](research/mentor-interview.md). These are one practitioner's estimates, not measured data:

- **"More than 90%" of first-time ADU applications in Laguna Beach are incomplete.** Common misses are a soils report, a grading plan and a fire plan. "You give them a list, but it is complicated and they never get it right."
- **3–4 correction rounds is typical.** Cities often push back on completeness first, because the state clock only starts once an application is complete.
- **Delay is expensive.** On his framework, interest alone on our $535k baseline home is about $2,600 a month (ASSUMPTION: his 7.3% rate and 20% down).

**What we checked:** the "shot clock" he described is **Gov 66317**, read in a browser 2026-11-07. The city must decide completeness within **15 business days** and list every missing item. It can't add new items when the applicant resubmits, and if it misses the deadline the application is deemed complete. It then has **60 days** to approve or deny, or the application is deemed approved.

**What we changed:** completeness became the problem we solve. A filled, complete first submission is what starts the state's clock.

## How this differs from CrossBeam

[CrossBeam](https://cc-crossbeam.vercel.app), built by our mentor, works **after plan check**: it reads a city's corrections letter and the construction plans, then drafts responses. Fast Track works **before submittal**: it helps the applicant fill in the city's forms completely the first time. *CrossBeam helps you answer the city's corrections; Fast Track helps you avoid the completeness letter in the first place.* More in [research/crossbeam-comparison.md](research/crossbeam-comparison.md).

## Early findings

From the checklist audit engine's research (details in [research/hcd-letters.md](research/hcd-letters.md) and [fast-path-check/reference/cities.md](fast-path-check/reference/cities.md)):

- **HCD already told Anaheim to fix its citations.** In a March 24, 2025 findings letter, HCD said Anaheim's ADU ordinance cites 65852.2, 65852.22 and 65852.26, sections "deleted by SB 477," and that "the City must amend the Ordinance to refer to the correct code sections." Anaheim's November 2025 ADU checklist still cites 65852.2 and 65852.22.
- **Irvine got a similar letter.** HCD's January 2025 letter flagged the same stale citations, a 120-day review timeline (state law allows 60, Gov 66317), and deed restrictions on all ADUs.
- **A possible JADU overreach.** Anaheim's checklist requires an owner-occupancy covenant for **all** JADUs. Current Gov 66333(b) requires owner-occupancy only when the JADU shares sanitation with the main house. That's a **possible conflict to confirm with city staff or counsel**, not a ruling. HCD's letter didn't raise it.

## Next steps

- **Next month:** a homeowner fills in their city's ADU application before their first submittal, and a city permit counter offers Fast Track to walk-in applicants.
- **With one more week:** write answers onto flat PDFs in their own layout, add Spanish, add more OC cities' forms, and show the checklist audit next to each form ("this form still cites a deleted section").

## Data and privacy

- **The repo holds no personal information.** The sample forms are blank public city documents; the only contacts in them are city department addresses and phone numbers.
- **Fast Track asks for the details a form needs**, such as a name, an address and project details. Please use made-up details: every page says so.
- **Those answers are sent to Claude (Anthropic's API) to fill the form, and nothing is stored.** The server keeps nothing between turns; the conversation and the uploaded file live in your browser tab and disappear when you close it.
- **It never asks for or fills** Social Security, driver's license, ID or bank numbers, or signatures. The server enforces this whatever Claude replies.
- It doesn't file applications or contact any city or person.

## License

[MIT](LICENSE)
