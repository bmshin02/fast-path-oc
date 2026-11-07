# Plan: Fast Path Check, a Claude skill (Lane 2 · Clear it)

**One line:** Give it an OC city and a project. The skill finds the fastest legal path (ADU, SB 9, SB 684 small map or streamlined multifamily) and its legal clock. It then checks the city's own checklist against **current** state law, flagging stale statute citations, requirements that go beyond state law, and items missing from the applicant's package.

**Build approach:** No code. It's a **Claude skill**: a folder with `SKILL.md` and a few reference files. The "tools" are Claude's built-in **web search + web fetch**, pointed at a curated list of live sources (leginfo, HCD, data.ca.gov's open API, and city pages). The skill never trusts its own notes when a live source can be checked.

**Why it fits the brief:** This combines Lane 2 ideas #1 ("Pick the path for one address"), #2 ("Catch old law in live documents") and #3 ("Audit a city's checklist"). It covers all three made-up users in `scenarios.json`.

---

## 1. The real user

Primary: **C03, the city permit tech.** *"I want to tell applicants the right answer the first time, even when our form is out of date."*
Also serves C01 (homeowner adding an ADU) and C02 (nonprofit PM comparing two cities).

**Before:** The city checklist still cites Gov Code 65852.2, which SB 477 renumbered in 2024. The tech can't tell which lines state law still backs. The applicant follows the form, gets corrections, and resubmits.

**After:** The tech pastes the checklist URL or uploads the PDF and gets back a dated report:
- **Path:** which ministerial path fits and its legal clock, with the statute cited
- **Stale law:** each old citation mapped to its current section, with a link to the source
- **Beyond state law:** any checklist item that looks stricter than state law allows, flagged "confirm with counsel," never stated as a ruling
- **Package gaps:** what the applicant hasn't provided yet

---

## 2. Scope (lock by 11:00)

- **Project types:** ADU/JADU first, since the lane's city data is richest there. Add SB 9 two-unit/lot split and SB 684 (10 or fewer parcels) once ADU works. Streamlined multifamily (SB 35/423, AB 2011) is a stretch goal.
- **Cities:** **Anaheim** is the hero demo: its Nov 2025 ADU checklist still cites 65852.2 and 65852.22, which DATA-SOURCES.md has already verified. **Irvine** is the second city and its pages fetch cleanly. That gives you a two-city comparison for C02.
- **Out of scope:** submitting anything, scraping at volume, personal info, and financing (Lane 3's job).

---

## 3. The skill

### Folder layout (this goes in the repo)
```
fast-path-check/
  SKILL.md                 ← workflow + rules (draft below)
  reference/
    sources.md             ← live-source registry: URL, what it's for, fetchable?, last checked
    renumbering.md         ← old → new statute map (only confirmed rows)
    pathways.md            ← each path: statute, clock, key tests, HCD guidance link
    cities.md              ← per-city permit page / checklist / fee URLs + fetch status
    report-template.md     ← output format
evals/
  test-cases.md            ← C01–C03 + trick cases, expected results, pass/fail log
```
Install: upload the zipped folder as a skill in claude.ai, or drop it into `.claude/skills/` for Claude Code. Make sure **web search** is on.

### The "tools" (all live lookups, no code)
Fetch results below were tested on 2026-11-07. Full URLs and working queries are in `fast-path-check/reference/sources.md`.

| Tool | Hits | Used for | Tested 2026-11-07 |
|---|---|---|---|
| Web fetch → leginfo section pages | `leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=N.` | Current statute text before citing it | **Blocked: 403** for both curl and Claude's web fetch. The pages open in a normal browser. Fallback: HCD guidance PDFs + web search. Team members check sections by hand in a browser and record them in `reference/sources.md` |
| Web fetch → HCD guidance | ADU Handbook (Mar 2026), Housing Law Fact Sheets (Apr 2026), SB 9 fact sheet, SB 35 guidelines, AB 2011 draft guidelines | Plain-English rules with current section numbers | OK, all load. HCD has **no SB 684 / SB 1123 guidance** yet |
| Web fetch → HCD SMAP dashboard | `hcd.ca.gov/planning-and-community-development/streamlined-ministerial-approval-process-dashboard` | Is SB 35/423 streamlining available in this city? | OK |
| Web fetch → **data.ca.gov CKAN API** (free, no key) | APR Table A `c78b769d-cc02-4050-91ef-79ded665b5a8` and A2 `fe505d9b-8c36-42ba-ba30-08bc4f34e022`, filtered with `filters={"JURIS_NAME":"ANAHEIM"}` (**not** `q=`, which also matches street addresses) | Real local numbers, e.g. "this city reported N ADU permits," and entitlement→permit→CO dates if time allows | OK. A working SQL query for ADU permits by year is in `reference/sources.md` |
| Web fetch → city pages | Irvine | The city's current checklist + fees | Irvine OK. Santa Ana, Garden Grove and Huntington Beach not re-tested |
| **User upload** | Anaheim (confirmed 403), Costa Mesa, Fullerton, Orange | Download the PDF in a browser, attach it. Honest workaround, no scraping. | Anaheim Z412 PDF saved in `evals/fixtures/` |
| Web search | Anything not in the registry | New HCD letters, a newer checklist version, 2025–26 law changes | OK |

### SKILL.md (draft, paste it in and tune during testing)
```markdown
---
name: fast-path-check
description: Use when someone asks which approval path an Orange County housing
  project qualifies for (ADU, JADU, SB 9, SB 684, SB 35/423), or wants a city
  permit checklist checked against current California law. Finds the ministerial
  path and its clock, flags stale statute citations and checklist items that
  exceed state law, and lists package gaps.
---

# Fast Path Check

Prototype for the Claude Impact Lab. Not legal advice.

## Inputs
- City (one of OC's 34) and project type, or a description to infer it from
- Optional: the city's checklist (URL or uploaded PDF), the applicant's draft package

## Workflow
1. **Identify the path.** Read reference/pathways.md. Pick candidate paths.
   For each, FETCH the HCD guidance listed there and confirm the test and the
   clock before stating them. Leginfo returns 403 to web fetch, so don't expect
   to fetch statute text. Use the hand-checked statute status in
   reference/sources.md, and web search if you need more. If neither confirms
   something, mark it "unverified today."
2. **Check streamlining availability** (multifamily only): fetch the HCD SMAP dashboard.
3. **Get the city checklist.** Use the URL in reference/cities.md, a user URL, or the
   upload. If a city page returns 403, ask the user to download and attach it.
   Never retry repeatedly.
4. **Audit the checklist, line by line.**
   - Every statute citation: look it up in reference/renumbering.md. If it's an old
     number, give the current one and the source. If it's not in the map, fetch it.
   - Every requirement: is it backed by state law, a local rule, or nothing cited?
     Flag anything that looks stricter than state law as "possible conflict, confirm
     with city staff or counsel." Never call it illegal.
5. **Check the applicant's package** (if provided) against the checklist.
   Mark Present / Missing / Inconsistent / Can't tell.
6. **Optional local numbers:** query data.ca.gov APR Table A/A2 for the city,
   using the exact JURIS_NAME filter from reference/sources.md (not q=).
   Report counts and dates as-is. Say what the data can't show (no correction-cycle data).
7. **Write the report** using reference/report-template.md.

## Rules that do not bend
- Never invent a statute, section number, fee, deadline, address or parcel fact.
  If the source doesn't say, the answer is "unknown."
- Every legal or numeric claim gets: source URL + date checked (today's date).
- Live source beats reference file. If they disagree, show both with dates. Don't
  pick silently, and add a note that reference/ needs updating.
- Label assumptions ASSUMPTION.
- No personal information. If an upload contains a real person's details, stop and
  say so; tell the user to find an organizer.
- Never submit, email or file anything. Draft only.
- Be kind to servers: one fetch per page, no bulk crawling.
```

### reference/renumbering.md (seed with only what the lane repo confirms)
| Old | Current | Source |
|---|---|---|
| Gov 65852.2 (ADU) | Gov 66310–66342 (ADU approvals 66314–66331) | SB 477 (2024); HCD ADU Handbook, Mar 2026 |
| Gov 65852.22 (JADU) | Gov 66333 | same |
| Gov 66324 / 66327 / 66332 | 66311.5 / 66313.5 / 66311.7 (2025) | HCD ADU Handbook p.13 |
| 65852.23, 65852.26 | within 66310–66342; **fetch to confirm exact section** | DATA-SOURCES.md |

Anything not confirmed is marked "fetch to confirm." Don't fill gaps from memory. That's the trick test.

### reference/pathways.md (seed)
| Path | Statute | Clock / key point | Guidance |
|---|---|---|---|
| ADU / JADU | Gov 66314–66331 / 66333 | Ministerial, 60 days | HCD ADU Handbook (Mar 2026) |
| SB 9 two-unit | Gov 65852.21 | Ministerial; HCD enforces since 2024 | HCD SB 9 fact sheet |
| SB 9 lot split | Gov 66411.7 | 60-day clock | HCD SB 9 fact sheet |
| Small subdivision ≤10 parcels | Gov 66499.41 (+ 65913.4.5 permit) | Ministerial map; SB 1123 amended it, and Stats. 2026 ch. 1006 amended it again (4 versions on leginfo). **Confirm which version is operative** | leginfo (no HCD guidance yet) |
| Streamlined multifamily | Gov 65913.4 (SB 35/423) | Check SMAP dashboard per city | HCD SB 35 guidelines |
| Corridor / office-to-housing | Gov 65912.100–.140 (AB 2011) | By-right | HCD AB 2011 draft guidelines |
| Post-entitlement permits | Gov 65913.3 (AB 2234) | City must post checklists + sample apps online | leginfo |

*Clocks and tests come from the lane's DATA-SOURCES.md summaries. The skill must fetch and confirm each one before stating it.*

### Report format (the demo screen)
Ask Claude to render it as a one-page artifact:
1. Header: city, project, **date checked**, "Prototype · not legal advice"
2. Traffic light: Path found / Stale citations: N / Possible conflicts: N / Gaps: N
3. Path + clock, with the statute link
4. Checklist audit table: line → cites → status (Current / Stale → new # / Uncited / Possible conflict) → source
5. Package gaps
6. "What we couldn't verify today" (always shown)

---

## 4. Test it (this is how we win "Works")

Log results in `evals/test-cases.md`: case → expected → what the skill said → pass/fail → what we changed.

| # | Case | Must do |
|---|---|---|
| 1 | **C03 / Anaheim ADU checklist** (upload the Nov 2025 PDF) | Flag 65852.2 and 65852.22, map them to 66310–66342 / 66333, cite the HCD Handbook |
| 2 | **C01 / Irvine ADU homeowner** | Fetch Irvine's live page, list its submittal items, state the 60-day ministerial clock with its source |
| 3 | **C02 / Anaheim vs Irvine** | Side-by-side of steps, documents and published timelines, with gaps marked "unknown" |
| 4 | **Trick: unmapped old cite** (e.g., 65852.26) | Must fetch or say "unknown," never guess the new number |
| 5 | **Trick: fetch blocked** (Costa Mesa URL) | Ask for an upload; must not retry or invent content |
| 6 | **Trick: live vs reference disagree** (put a deliberately wrong row in a copy of reference/) | Show both, prefer live, flag the file |

---

## 5. Split for 3 people

Each person owns separate files, so nobody blocks anyone else. You sync at four checkpoints only.

### Person A: Skill builder ("makes it work")
**Owns:** `SKILL.md`, `reference/pathways.md`, `reference/renumbering.md`, `reference/report-template.md`
- [ ] 10:50: Create the skill folder, paste in the SKILL.md draft, install it, turn web search on
- [ ] 11:00: Run the **fetch test**: can the skill open a leginfo link and an HCD link directly? Tell B and C the result
- [ ] 11:00–11:45: Fill `pathways.md` + `renumbering.md` from DATA-SOURCES.md (confirmed rows only)
- [ ] 11:45: **First full run on the Anaheim checklist** (test 1)
- [ ] 12:30–1:30: Fix whatever C's tests break; tune the prompt and the report template
- [ ] 1:30: Freeze the skill. No changes after this.

### Person B: Sources + data ("makes it true")
**Owns:** `reference/sources.md`, `reference/cities.md`, `sources.md` (repo root), `oc-cities.json` rows we touch
- [ ] 10:30: Download Anaheim's Nov 2025 ADU checklist PDF in a browser and give it to A
- [ ] 10:50–11:30: Build `sources.md`: every URL the skill uses, what it's for, whether it fetches, and **date checked**
- [ ] 11:30–12:15: Build `cities.md` for Anaheim + Irvine (permit page, checklist, fee schedule); fill those rows in `oc-cities.json` with dates
- [ ] 12:15: Try the data.ca.gov APR query for both cities in the skill; give A the working URL
- [ ] 12:30–1:30: Grab the room mentor: *"Which checklist items cause the most resubmittals?"* Write the answer into the README as the real-user evidence
- [ ] 1:30–2:00: Write the README from `templates/TEAM-README.md`; label every ASSUMPTION
- [ ] 2:00: Repo check: no keys, no personal info, license added

### Person C: Tests + story ("proves it and sells it")
**Owns:** `evals/test-cases.md`, the report artifact look, demo script, video, live demo
- [ ] 10:50–11:30: Write all 6 test cases in `evals/test-cases.md` with expected results *before* the skill exists (keeps everyone honest)
- [ ] 11:30: Make the "wrong reference file" copy for trick test 6
- [ ] 12:00–1:15: Run tests 2–6 as soon as A's first run works; log pass/fail and hand A a fix list
- [ ] 12:30–1:15: Sketch the report layout (traffic light + audit table) and give it to A for the template
- [ ] 1:15–1:30: Write the 2-minute demo script (section 7)
- [ ] 1:30–2:00: Record the demo video from a real run
- [ ] 2:00–2:20: Submit (repo, video, user, sources); add all teammates' emails
- [ ] 2:20: Rehearse the live demo twice with A on the keyboard

### Sync checkpoints (5 min each)
| Time | Check |
|---|---|
| **11:00** | Scope locked, fetch test result known, everyone starting |
| **12:00** | Did the Anaheim run work? If not, all 3 people fix it before anything else |
| **1:30** | Freeze: skill done, tests logged, README started |
| **2:20** | Submitted. Rehearse. |

---

## 6. Timeline (it's 10:30)

| Time | Do |
|---|---|
| 10:30–10:50 | Everyone reads the Lane 2 README + DATA-SOURCES.md "Read this first." Grab the mentor and ask: *"Which checklist items cause the most resubmittals?"* Download Anaheim's checklist PDF. |
| 10:50–11:00 | **Scope locked.** Repo from template. Skill folder created and installed, web search on. |
| 11:00–12:00 | Write SKILL.md + reference files. Run test 1 (Anaheim). **Get one working run before lunch.** |
| 12:00–12:30 | Lunch while running tests 2–3. |
| 12:30–1:30 | Trick tests 4–6, tune. Designer finalizes the report artifact. Add SB 9 if ADU is solid. |
| 1:30–2:00 | Freeze. Record video. README from `templates/TEAM-README.md`. |
| 2:00–2:20 | Final check (no keys, no personal info, every source dated). Submit. |
| 2:20–2:30 | Rehearse the live demo. |

---

## 7. Demo script (2 min max)

1. **Who** (15s): "A permit tech at a city counter. Her form is out of date and she doesn't know it." (C03, made up.)
2. **Before** (15s): show Anaheim's real Nov 2025 checklist citing 65852.2, a section that was renumbered in 2024.
3. **Live** (60s): run the skill on it. Show the report: ADU path + 60-day clock, stale citations mapped to current law with HCD links, any possible conflicts, the "couldn't verify" section, and a date on everything.
4. **Scale** (20s): "Nothing's hard-coded to Anaheim. Point it at any of OC's 34 cities: it fetches live law every run, so it doesn't go stale when the law changes again." Show `oc-cities.json` partly filled.
5. **Close** (10s): sources on screen, repo link, "prototype, not legal advice."

---

## 8. Scale story

- **Doesn't rot:** every run checks live sources, and reference files are only the starting point.
- **34 cities, one skill:** adding a city means adding a row to `cities.md`, and the work feeds back into the lane's `oc-cities.json`.
- **Both sides of the counter:** applicants check before they submit, and cities audit their own forms (AB 2234 already requires checklists to be online).
- **Next step:** run it across all 34 cities to produce the first-ever OC checklist audit. DATA-SOURCES.md notes nobody has done this.

---

## 9. Submission checklist (due 2:30)

- [ ] Public repo: skill folder, `evals/test-cases.md`, `sources.md`, README from template
- [ ] No API keys, passwords or personal info anywhere (including history)
- [ ] Demo video, 30s to 2 min
- [ ] One real user: who, before, after
- [ ] Every law/dataset/link listed with date checked; every assumption labeled ASSUMPTION
- [ ] Open license (MIT)
- [ ] Teammates' emails on the team for prizes

---

## Risks

- **Fetch blocked (leginfo, some cities):** fall back to HCD PDFs or user upload; the report says so. *Tested 2026-11-07: leginfo and Anaheim both return 403 to web fetch; HCD, data.ca.gov and Irvine load fine.*
- **Web fetch only opening URLs that came from search or the user:** if the skill can't fetch registry URLs directly, have it web-search the source title first. Test this early.
- **Calling something illegal:** the skill only says "possible conflict, confirm," never issues a ruling.
- **Inventing a section number:** renumbering.md only holds confirmed rows, and trick test 4 checks for this.
- **Scope creep:** get ADU working first. Add SB 9 only after the Anaheim demo works end to end.
