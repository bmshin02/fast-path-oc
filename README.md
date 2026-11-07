# Fast Path Check

**A Claude skill that finds the fastest legal approval path for an Orange County housing project, then checks the city's permit checklist against current California law.**

Claude Impact Lab · Lane 2 ("Clear it") · **Prototype, not legal advice.**

> Status: in progress. See [PLAN.md](PLAN.md) for the full build plan, test cases and team split.

---

## The problem

City permit checklists fall behind state law. For example, Anaheim's November 2025 ADU checklist still cites Gov Code 65852.2 and 65852.22, which SB 477 renumbered in 2024. Applicants follow the form, get correction notices and resubmit. Counter staff can't easily tell which lines state law still backs.

## Who it's for

| User | Need |
|---|---|
| **C03, city permit tech** (primary) | "I want to tell applicants the right answer the first time, even when our form is out of date." |
| C01, homeowner adding an ADU | What do I submit, and how long can the city take? |
| C02, nonprofit project manager | Compare two cities' steps, documents and timelines side by side |

These are the made-up users from the lane's `scenarios.json`.

**Before:** the checklist cites renumbered law, nobody notices, and the applicant goes through extra correction cycles.
**After:** paste the checklist URL or upload the PDF, and get back a dated report.

## What it does

Give it an OC city and a project. It returns:

1. **Path:** which ministerial path fits (ADU/JADU, SB 9, SB 684 small subdivision, or streamlined multifamily) and its legal clock, with the statute cited
2. **Stale law:** each outdated statute citation mapped to its current section, with a source link
3. **Beyond state law:** checklist items that look stricter than state law allows, flagged *"possible conflict, confirm with city staff or counsel."* It never calls anything illegal.
4. **Package gaps:** what the applicant hasn't provided yet (Present / Missing / Inconsistent / Can't tell)
5. **What we couldn't verify today:** always shown

Every legal or numeric claim carries a source URL and the date it was checked.

## How it works

There's no code. It's a **Claude skill**: a folder with `SKILL.md` and some reference files. Its "tools" are Claude's built-in **web search** and **web fetch**, pointed at a curated list of live sources:

| Source | Used for |
|---|---|
| leginfo.legislature.ca.gov | Current statute text before citing it |
| HCD guidance (ADU Handbook Mar 2026, SB 9 fact sheet, SB 35 / AB 2011 guidelines) | Plain-English rules with current section numbers |
| HCD SMAP dashboard | Whether SB 35/423 streamlining applies in a given city |
| data.ca.gov CKAN API (APR Tables A / A2) | A city's reported permit counts and dates |
| City permit pages | The city's current checklist and fees |
| User upload | Cities whose pages block automated fetching (Anaheim, Costa Mesa, Fullerton, Orange) |

The skill never trusts its own notes when a live source can be checked. If a live source and a reference file disagree, the report shows both with dates and flags the file for an update.

### Repo layout (planned)

```
fast-path-check/
  SKILL.md                 workflow + rules
  reference/
    sources.md             live-source registry with fetch status and date checked
    renumbering.md         old → new statute map (confirmed rows only)
    pathways.md            each path: statute, clock, key tests, guidance link
    cities.md              per-city permit page / checklist / fee URLs
    report-template.md     output format
evals/
  test-cases.md            test cases, expected results, pass/fail log
PLAN.md                    build plan
```

## Install

1. Zip the `fast-path-check/` folder and upload it as a skill in claude.ai, **or** copy it into `.claude/skills/` for Claude Code.
2. Turn on **web search**.
3. Ask something like: *"Check Anaheim's ADU checklist against current state law"* and attach the checklist PDF.

## Scope

- **Project types:** ADU/JADU first, then SB 9 and SB 684. Streamlined multifamily (SB 35/423, AB 2011) is a stretch goal.
- **Cities:** Anaheim is the main demo and Irvine is the comparison city. Adding a city means adding a row to `reference/cities.md`.
- **Out of scope:** submitting anything, bulk scraping, personal information, financing.

The laws involved are statewide, so the only OC-specific part is the city list.

## Testing

Tracked in `evals/test-cases.md`:

| # | Case | Must do |
|---|---|---|
| 1 | Anaheim ADU checklist (C03) | Flag 65852.2 / 65852.22 and map them to 66310–66342 / 66333 with an HCD source |
| 2 | Irvine ADU homeowner (C01) | Fetch Irvine's live page, list the submittal items, state the 60-day clock with its source |
| 3 | Anaheim vs Irvine (C02) | Side-by-side comparison, with gaps marked "unknown" |
| 4 | Trick: unmapped old citation | Fetch it or say "unknown." Never guess a section number |
| 5 | Trick: blocked fetch | Ask for an upload. Don't retry or make up content |
| 6 | Trick: live source vs reference file disagree | Show both, prefer the live source, flag the file |

Results: *TBD, to be logged as tests are run.*

## Real-user evidence

*TBD: the answer from the room mentor to "Which checklist items cause the most resubmittals?"*

## Assumptions

- ASSUMPTION: Claude's web fetch can open leginfo and HCD URLs directly. If it can't, the skill falls back to web search for the source title, then to HCD PDFs.
- ASSUMPTION: the statute clocks and tests in `reference/pathways.md` match current law. The skill must fetch and confirm each one before stating it.
- ASSUMPTION: the city checklist URLs in `reference/cities.md` are current as of their "date checked."

## Sources

Every law, dataset and link the skill uses is listed with its date checked in `reference/sources.md`.

## License

MIT (LICENSE file to be added).
