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

Before settling on Fast Track, we built an engine that checks a city's checklist against current California law: a master agent directing parser, compliance and producer subagents behind `POST /api/check` ([`web/lib/agents/`](web/lib/agents), rules in [`fast-path-check/SKILL.md`](fast-path-check/SKILL.md)). It flags renumbered statute citations, states the legal clock (Gov 66317), cites HCD's letters to the city, and flags requirements that look stricter than state law as "possible conflict, confirm with city staff or counsel." It's deployed but **not wired into the website**. Its research is below under [Early findings](#early-findings).

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
