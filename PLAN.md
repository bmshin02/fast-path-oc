# Plan: Fast Path Check, a multi-agent web app (Lane 2 · Clear it)

**One line:** A user uploads an OC city's permit checklist (and, if they have one, their application package), or describes a publicly listed lot, on our website. A **master agent** directs three **subagents**: one parses the input, one checks it against **current** California law, and one produces the Lane 2 deliverables. The result is the fastest legal path (ADU, SB 9, SB 684 small map or streamlined multifamily) with its legal clock, plus a line-by-line audit that flags stale statute citations, requirements that go beyond state law, and items missing from the package.

**Goal:** turn four years into two by finding the ministerial path (meet the written rules and the city must say yes) and catching paperwork errors before they cause resubmittals.

### What we deliver (one dated, sourced report)
1. **The fast path:** which route fits, the city's legal clock (e.g., 60 days for an ADU), and the statute that says so
2. **Stale law flagged:** old citations mapped to current ones (65852.2 → 66310–66342)
3. **Possible overreach:** items stricter than state law, marked "confirm with city staff or counsel," never "illegal"
4. **Steps, fees and timelines:** what to submit, in what order, what it costs, and how long that city actually takes (APR data), with "unknown" where no source says
5. **Package gaps:** what the applicant hasn't provided yet
6. **What we couldn't verify today:** always shown

Not legal advice. Never submits anything. No personal information.

**Build approach:** A **Next.js web app** (the `web/` scaffold) calls the **Claude API** with our own API key, on the server only. The master agent is a true agent: Claude decides which subagent to call, in what order, whether to re-run one, and when to stop and ask the user something. Each subagent is its own Claude API call with its own system prompt and a fixed output schema. The `fast-path-check/` skill folder stays as the source of truth for rules and reference data, and the subagent prompts load it.

**Why it fits the brief:** It combines Lane 2 ideas #1 ("Pick the path for one address"), #2 ("Catch old law in live documents") and #3 ("Audit a city's checklist"). It covers all three made-up users in `scenarios.json`. Upload-first also solves the problem of city sites that block automated fetches.

---

## 1. The real user

Primary: **C03, the city permit tech.** *"I want to tell applicants the right answer the first time, even when our form is out of date."*
Also serves C01 (homeowner adding an ADU) and C02 (nonprofit PM comparing two cities).

**Before:** The city checklist still cites Gov Code 65852.2, which SB 477 renumbered in 2024. The tech can't tell which lines state law still backs. The applicant follows the form, gets corrections, and resubmits.

**After:** The tech opens our site, uploads the checklist PDF, watches progress stream in, and gets back a dated report:
- **Path:** which ministerial path fits and its legal clock, with the statute cited
- **Stale law:** each old citation mapped to its current section, with a link to the source
- **Beyond state law:** any checklist item that looks stricter than state law allows, flagged "confirm with counsel," never stated as a ruling
- **Package gaps:** what the applicant hasn't provided yet

---

## 2. Scope (lock by 11:00)

- **Project types:** ADU/JADU first, since the lane's city data is richest there. Add SB 9 two-unit/lot split and SB 684 (10 or fewer parcels) once ADU works. Streamlined multifamily (SB 35/423, AB 2011) is a stretch goal.
- **Cities:** **Anaheim** is the hero demo: its Nov 2025 ADU checklist still cites 65852.2 and 65852.22, which DATA-SOURCES.md has already verified. **Irvine** is the second city and its pages fetch cleanly. That gives you a two-city comparison for C02.
- **Inputs:**
  - **Checklist mode:** PDF upload (city checklist, optional applicant package).
  - **Site mode:** a publicly listed OC lot or small building (address/listing text, 4–12 homes). Path selection only, from public facts; every assumed number labeled ASSUMPTION. This is the "real, public case" the judges ask for.
  - A pasted URL is a stretch goal.
- **Out of scope:** user accounts, storing uploads after the run, submitting anything, scraping at volume, personal info, owner names, and financing (Lane 3's job).

---

## 3. Architecture

### Flow
```
Browser: upload page (PDF + city + project type)
        │  POST multipart
        ▼
Next.js route handler  /api/check   (server only; reads ANTHROPIC_API_KEY)
        │  streams progress events back to the page
        ▼
MASTER AGENT  (claude-opus-5-5, adaptive thinking, effort high)
  Tool runner loop. Its tools are the three subagents:
    parse_document · check_compliance · produce_deliverables
  It decides the order, re-runs a subagent when output is incomplete,
  and stops to ask the user when something is missing or blocked.
        │
        ├──► 1. PARSER subagent         (claude-opus-5-5, effort low)
        │      In:  uploaded PDF as a document block
        │      Out: ParsedDoc JSON (structured output)
        │
        ├──► 2. COMPLIANCE subagent     (claude-opus-5-5, effort high)
        │      In:  ParsedDoc + renumbering.md + pathways.md + sources registry
        │           + HCD ADU Handbook (Mar 2026) PDF, cached, loaded as a document
        │      Tools: web_search_20260209, web_fetch_20260209
        │             (allowed_domains: leginfo.legislature.ca.gov, hcd.ca.gov,
        │              data.ca.gov, backyardadu.net, + the city's domain)
        │      Checks: statute citations, HCD ADU Ordinances page for letters about
        │              this city, APR Table A2 timelines, city fee schedule
        │      Out: ComplianceResult JSON
        │
        └──► 3. PRODUCER subagent       (claude-opus-5-5, effort medium)
               In:  ParsedDoc + ComplianceResult + report-template.md
               Out: Report JSON → rendered by the report page; Markdown export
```

### The master agent (true agent)
- **System prompt:** the job, the "rules that do not bend" (below), and when to call each subagent. It is told it may re-call a subagent with feedback, and must stop and ask the user rather than guess.
- **Tools:** three custom tools, each a thin wrapper that runs one subagent call and returns its JSON. Built with the TypeScript SDK's tool runner (`client.beta.messages.toolRunner` + `betaZodTool`), so we write the tool functions, not the loop.
- **Decisions it owns:**
  - Upload unreadable or not a checklist → ask the user
  - Parser missed lines or citations → re-run the parser with a note
  - Compliance marks something "unverified" because a fetch failed → try once more via web search, then accept "unverified today"
  - Multifamily project → tell the compliance subagent to check the HCD SMAP dashboard
  - Two uploads (Anaheim + Irvine) → run parse + check on each, then one producer call for a side-by-side (C02)
  - Site mode (a listed lot) → skip the checklist audit; parse the listing into site facts, have compliance test each path (ADU, SB 9, SB 684 for ≤10 parcels, SB 35/423), mark every fact it can't source as ASSUMPTION or "unknown"
- **Guardrails:** a cap on tool calls per run (e.g. 8), a task budget, and a timeout. If it hits the cap, it produces the report with whatever it has and lists the rest under "couldn't verify."

### Subagent contracts (lock these by 11:30 so A and C can work in parallel)
```ts
ParsedDoc = {
  city: string; projectType: string; docTitle: string; docDate: string | null;
  items: { id: string; text: string; page: number;
           citations: string[];            // exactly as written, e.g. "Gov. Code 65852.2"
           kind: "requirement" | "document" | "fee" | "info" }[];
  package?: { itemId: string; status: "present" | "missing" | "inconsistent" | "cant_tell" }[];
}

ComplianceResult = {
  checkedOn: string;                       // today's date
  path: { name: string; statute: string; clock: string; sourceUrl: string } | null;
  items: { id: string;
           status: "current" | "stale" | "uncited" | "possible_conflict" | "unverified";
           newCitation?: string; note: string; sourceUrl?: string }[];
  steps: { order: number; step: string; fee?: string; time?: string; sourceUrl?: string }[];
  hcdLetters: { title: string; date: string; url: string }[];   // empty + note if dashboard unreadable
  timelines?: { metric: string; value: string; source: string }[]; // APR A2 / BackyardADU, as-is
  unverified: string[];
}

Report = { header, trafficLight, path, stepsAndFees, auditTable, timelines,
           hcdLetters, packageGaps, couldntVerify }
```

### Claude API usage
- **Key:** one Claude API key for the team, in `web/.env.local` as `ANTHROPIC_API_KEY`. `.env*` is already gitignored. It is only read in server code (the route handler and `web/lib/agents/`) and is **never** prefixed `NEXT_PUBLIC_` or sent to the browser. Each teammate's local copy is shared privately, not in the repo or chat logs. The submission build uses the same env var on the host.
- **SDK:** `@anthropic-ai/sdk` (TypeScript), streaming with `.finalMessage()`.
- **Model:** `claude-opus-5-5` for all four agents, with `thinking: {type: "adaptive"}` and effort tuned per role (above). Note: Opus 5.5's default effort is `medium`, so set it explicitly on every call.
- **PDF input:** base64 `document` block (32 MB / 600 page limit, plenty for a checklist).
- **Structured output:** `output_config.format` with a JSON schema for each subagent, so the master always gets valid JSON.
- **Refusals:** check `stop_reason` before reading content; refusal fallback enabled (`fallbacks: "default"`).
- **Web fetch caveat:** it only opens URLs already in the conversation, so the compliance prompt includes the source registry (`reference/sources.md`) with every URL it may need.
- **Source cache (ground rules: "download once and cache"):** the server caches each fetched source for one day, keyed by URL, with its fetch date. Every run still shows the date checked, but we don't hit the same page every run.
- **Fetch test results (2026-11-07, full URLs and queries in `fast-path-check/reference/sources.md`):**
  - **Leginfo: blocked (403)** for both curl and Claude's web fetch; opens in a normal browser. Teammates check sections by hand and record them in `reference/sources.md`; the compliance agent uses that hand-checked status, the HCD guidance, and web search. It never claims to have read leginfo live.
  - **HCD guidance: OK** (ADU Handbook Mar 2026, Housing Law Fact Sheets Apr 2026, SB 9 fact sheet, SB 35 guidelines, AB 2011 draft guidelines, SMAP dashboard). HCD has **no SB 684 / SB 1123 guidance** yet.
  - **data.ca.gov APR API: OK.** Filter with `filters={"JURIS_NAME":"ANAHEIM"}`, **not** `q=` (which also matches street addresses). A working SQL query for ADU permits by year is in `reference/sources.md`.
  - **City pages:** Irvine OK; Anaheim confirmed 403 (its Z412 checklist PDF is saved in `evals/fixtures/`); Santa Ana, Garden Grove and Huntington Beach not re-tested.
- **Cost:** each run is several Opus calls plus web fetches. Log `usage` per run to the server console so we know what a demo costs.

### Repo layout
```
fast-path-check/              ← rules + reference data (source of truth for prompts)
  SKILL.md                    ← rules that do not bend, workflow
  reference/
    sources.md                ← live-source registry: URL, purpose, fetchable?, last checked
    renumbering.md            ← old → new statute map (confirmed rows only)
    pathways.md               ← each path: statute, clock, key tests, HCD guidance link
    cities.md                 ← per-city permit page / checklist / fee URLs + fetch status
    report-template.md        ← report sections
web/
  app/
    page.tsx                  ← upload page (PDF, city, project type)
    report/[id]/page.tsx      ← or render inline on the same page; report view
    api/check/route.ts        ← POST: runs the master agent, streams progress + result
  lib/agents/
    client.ts                 ← Anthropic client (server only)
    master.ts                 ← tool runner loop + system prompt
    parser.ts                 ← parser subagent + ParsedDoc schema
    compliance.ts             ← compliance subagent + ComplianceResult schema
    producer.ts               ← producer subagent + Report schema
    prompts.ts                ← loads SKILL.md + reference/*.md at build time
  components/                 ← ProgressFeed, TrafficLight, AuditTable, GapsList
evals/
  test-cases.md               ← cases, expected results, pass/fail log
  fixtures/                   ← sample PDFs + the "wrong reference" copy for test 6
```

### Rules that do not bend (every agent's system prompt)
- Never invent a statute, section number, fee, deadline, address or parcel fact. If the source doesn't say, the answer is "unknown."
- Every legal or numeric claim gets: source URL + date checked (today's date).
- Live source beats reference file. If they disagree, show both with dates, don't pick silently, and flag that `reference/` needs updating.
- Label assumptions ASSUMPTION.
- "Possible conflict, confirm with city staff or counsel." Never call anything illegal.
- No personal information. If an upload contains a real person's details, stop and tell the user. Uploads are processed in memory and not stored.
- Never submit, email or file anything. Draft only.
- Be kind to servers: one fetch per page, no bulk crawling.

### Reference data (already seeded in `fast-path-check/reference/`)
- `renumbering.md`: 65852.2 → 66310–66342, 65852.22 → 66333, the 2025 renumbers (66324 / 66327 / 66332 → 66311.5 / 66313.5 / 66311.7; 66333.5 added), and "fetch to confirm" rows for 65852.23 / .26. Confirmed rows only; don't fill gaps from memory.
- `pathways.md`: ADU/JADU, SB 9 two-unit and lot split, SB 684, SB 35/423, AB 2011, AB 2234. Clocks and tests must be fetched and confirmed before they're stated.

### Facts from the lane's DATA-SOURCES.md the agents must know
- **65852.28 has four versions on leginfo.** Never hard-code it.
- **66499.41 (SB 684) has four versions too:** SB 1123 amended it, then Stats. 2026 ch. 1006 amended it again. Confirm which version is operative before stating the test or clock, and say there is no HCD guidance for it yet.
- **Name trap:** "SB 9 (2025)" lets HCD void non-compliant ADU ordinances. It is a different bill from the 2021 SB 9 (two-unit / lot split). Always give the year.
- **HCD enforces SB 9** (65852.21, 66411.7) directly since Jan 1, 2024 (AB 434).
- **Sign-offs outside the planning clock:** Anaheim's sewer capacity check ("up to four days") and meter spot inspection ("two to three business days"). Show these as separate steps, not part of the 60 days.
- **City-specific flags:** Huntington Beach coastal zone may need a Coastal Development Permit; Costa Mesa pre-approved plans must be resubmitted after each code update; Tustin's ADU ordinance (Dec 2021) and Costa Mesa's "coming soon" plans look stale.
- **HCD letters:** the enforcement dashboard is an embedded app. Use the HCD ADU Ordinances page; if no letter can be read, say "unknown" and give HAUportal@hcd.ca.gov as the contact for copies.
- **Timelines:** APR Table A2 (`fe505d9b-…`) has entitlement / permit / CO dates by city; BackyardADU `build_times.csv` has median permit-to-CO days (third party, cite APR for anything official). No OC data on correction cycles exists, so say so.
- **Baseline:** `timeline.json` (about 4 years; time costs $85k of a $535k home). Always labeled ASSUMPTION.

### Report (the demo screen)
1. Header: city, project, **date checked**, "Prototype · not legal advice"
2. Traffic light: Path found / Stale citations: N / Possible conflicts: N / Gaps: N
3. Path + clock, with the statute link
4. Steps and fees in order, including sign-offs outside the planning clock
5. Checklist audit table: line → cites → status (Current / Stale → new # / Uncited / Possible conflict / Unverified) → source
6. Real timelines for this city (APR data, as reported) and any HCD letters
7. Package gaps
8. "What we couldn't verify today" (always shown)
9. Download as Markdown

---

## 4. Test it (this is how we win "Works")

Log results in `evals/test-cases.md`: case → expected → what the app said → pass/fail → what we changed. Run every case through the website, not a script, so the demo path is the tested path.

| # | Case | Must do |
|---|---|---|
| 1 | **C03 / Anaheim ADU checklist** (upload the Nov 2025 PDF) | Flag 65852.2 and 65852.22, map them to 66310–66342 / 66333, cite the HCD Handbook |
| 2 | **C01 / Irvine ADU homeowner** (upload Irvine's checklist) | List its submittal items, state the 60-day ministerial clock with its source |
| 3 | **C02 / Anaheim vs Irvine** (two uploads) | Master runs both, producer gives a side-by-side with gaps marked "unknown" |
| 4 | **Trick: unmapped old cite** (e.g., 65852.26) | Compliance must fetch or say "unknown," never guess the new number |
| 5 | **Trick: source blocked** (a city URL that 403s) | Master asks the user for an upload; no retry loop, no invented content |
| 6 | **Trick: live vs reference disagree** (deliberately wrong row in a copy of reference/) | Show both, prefer live, flag the file |
| 7 | **Trick: bad upload** (a non-checklist PDF, e.g. a menu) | Master stops and tells the user, doesn't produce a report |
| 8 | **Real public case** (a publicly listed OC lot, 4–12 homes) | Site mode picks candidate paths with clocks and statutes; every unsourced fact labeled ASSUMPTION or "unknown"; no owner names |
| 9 | **Trick: SB 9 name trap** (ask about "SB 9" and ADU ordinances) | Distinguishes SB 9 (2021) from SB 9 (2025) and says which it means |

---

## 5. Split for 3 people

Each person owns separate files, so nobody blocks anyone else. The **subagent contracts** in section 3 are the handoff between people.

### Person A: Agents + API ("makes it work")
**Owns:** `web/lib/agents/*`, `web/app/api/check/route.ts`, `fast-path-check/SKILL.md`
- [ ] 10:50: Put the API key in `web/.env.local`, install `@anthropic-ai/sdk` + `zod`, make one test call
- [ ] 11:00: **Fetch test:** can the compliance call open a leginfo link and an HCD link? Tell B and C
- [ ] 11:00–11:30: Write the three schemas (ParsedDoc, ComplianceResult, Report); share with C
- [ ] 11:30–12:00: Parser + compliance subagents; run them by hand on the Anaheim PDF
- [ ] 12:00: Master agent (tool runner) wiring all three; `/api/check` streaming progress
- [ ] 12:30–1:30: Fix whatever C's tests break; tune prompts; add site mode once checklist mode works
- [ ] 1:30: Freeze. Deploy (e.g. Vercel) with `ANTHROPIC_API_KEY` set in the host's env vars; confirm the live URL runs test 1
- [ ] 3:00: Keep the deployment up for the finalist demo

### Person B: Sources + compliance knowledge ("makes it true")
**Owns:** `fast-path-check/reference/*`, `sources.md` (repo root), `oc-cities.json` rows we touch
- [x] 10:30: Download Anaheim's ADU checklist PDF (Z412, Nov 2025) into `evals/fixtures/`
- [ ] Download Irvine's ADU application package PDF (URL in `reference/cities.md`) into `evals/fixtures/`
- [x] 10:50–11:30: Build `reference/sources.md` with fetch status and date checked (2026-11-07)
- [x] 11:30–12:15: `reference/cities.md` for Anaheim + Irvine (Anaheim fees unknown: page returns 403)
- [ ] Fill the Anaheim + Irvine rows in `oc-cities.json` with dates
- [x] 12:15: Working data.ca.gov APR query (JURIS_NAME filter) recorded in `reference/sources.md`; give it to A for the compliance prompt
- [ ] 12:30: Find one publicly listed OC lot (4–12 homes) for test 8; record only public facts and the listing URL
- [ ] 12:30–1:30: Grab the room mentor: *"Which checklist items cause the most resubmittals?"* Write the answer into the README as real-user evidence
- [ ] 1:30–2:00: Update the README for the web app; label every ASSUMPTION
- [ ] 2:00: Repo check: no keys (including git history), no personal info, license added

### Person C: UI + tests + story ("proves it and sells it")
**Owns:** `web/app/page.tsx`, report view, `web/components/*`, `evals/test-cases.md`, demo script, video, live demo
- [ ] 10:50–11:30: Write all 9 test cases in `evals/test-cases.md` with expected results *before* the app exists
- [ ] 11:30–12:30: Upload page + report view built against the **Report schema** with mock data (no API needed)
- [ ] 11:30: Make the "wrong reference file" copy and the bad-upload PDF for tests 6–7
- [ ] 12:30–1:15: Hook the UI to `/api/check`; run tests 1–9; log pass/fail; hand A a fix list
- [ ] 1:15–1:30: Write the 2-minute demo script (section 7)
- [ ] 1:30–2:00: Record the demo video from a real run
- [ ] 2:00–2:20: Submit (repo, video, user, sources); add all teammates' emails
- [ ] 2:20: Rehearse the live demo twice with A on the keyboard

### Sync checkpoints (5 min each)
| Time | Check |
|---|---|
| **11:00** | Scope locked, API key works, fetch test result known |
| **11:30** | Schemas locked; C builds UI on mock data, A builds agents |
| **12:30** | Does the Anaheim upload produce a report end to end? If not, all 3 people fix it before anything else |
| **1:30** | Freeze: app done, tests logged, README started |
| **2:20** | Submitted. Rehearse. |

---

## 6. Timeline (it's 10:30)

| Time | Do |
|---|---|
| 10:30–10:50 | Everyone reads the Lane 2 README + DATA-SOURCES.md "Read this first." Grab the mentor. Download the Anaheim + Irvine PDFs. |
| 10:50–11:00 | **Scope locked.** API key in `.env.local`, SDK installed, one test call works. |
| 11:00–11:30 | Schemas locked. Reference files filling in. Test cases written. |
| 11:30–12:30 | Subagents + master agent; UI on mock data. **One end-to-end Anaheim run by 12:30.** |
| 12:30–1:30 | Tests 2–9, tune prompts. Add site mode and SB 9 if ADU is solid. |
| 1:30–2:00 | Freeze. Deploy. Record video. README. |
| 2:00–2:20 | Final check (no keys, no personal info, every source dated). Submit. |
| 2:20–2:30 | Rehearse the live demo. |

---

## 7. Demo script (2 min max)

1. **Who** (15s): "A permit tech at a city counter. Her form is out of date and she doesn't know it." (C03, made up.)
2. **Before** (15s): show Anaheim's real Nov 2025 checklist citing 65852.2, a section that was renumbered in 2024.
3. **Live** (60s): upload it on our site. The progress feed shows the master agent at work: "Parsing 22 lines… Checking citations against leginfo… Writing report." Show the report: ADU path + 60-day clock, stale citations mapped to current law with HCD links, possible conflicts, the "couldn't verify" section, and a date on everything.
4. **Scale** (20s): "Nothing's hard-coded to Anaheim. Upload any of OC's 34 cities' checklists: the agents check live law, so it doesn't go stale when the law changes again." Show `oc-cities.json` partly filled.
5. **Honest** (10s): what's mocked (if anything), where it gets things wrong (e.g. leginfo blocks fetches, so some statute text comes via HCD guidance; HCD letters often "unknown"), and that baseline numbers are ASSUMPTION.
6. **Close** (10s): sources on screen, repo link, "prototype, not legal advice."

*Backup: if time allows, a 20s site-mode run on the real public lot from test 8.*

---

## 8. Scale story

- **Doesn't rot:** every run checks live sources; reference files are only the starting point.
- **34 cities, one app:** adding a city means adding a row to `cities.md`; the work feeds back into the lane's `oc-cities.json`.
- **Both sides of the counter:** applicants check before they submit, and cities audit their own forms (AB 2234 already requires checklists to be online).
- **Agents scale out:** the master can fan out parse + check across many uploads, so the next step is running all 34 cities to produce the first-ever OC checklist audit. DATA-SOURCES.md notes nobody has done this.

---

## 9. Submission checklist (due 2:30)

- [ ] Public repo: `web/`, `fast-path-check/`, `evals/test-cases.md`, `sources.md`, README
- [ ] Live deployed URL that runs test 1, kept up through the 3:00 finalist demos
- [ ] **No API key anywhere**: not in code, not in `.env` files, not in git history (`git log -p | grep -i sk-ant` comes back empty)
- [ ] No passwords or personal info anywhere (including history and fixtures)
- [ ] Demo video, 30s to 2 min
- [ ] One real user: who, before, after
- [ ] Every law/dataset/link listed with date checked; every assumption labeled ASSUMPTION
- [ ] Open license (MIT)
- [ ] Teammates' emails on the team for prizes

---

## Risks

- **API key leaks:** server-only code, `.env*` gitignored, never `NEXT_PUBLIC_`. If it's ever committed, rotate it immediately; deleting the commit isn't enough.
- **Slow runs:** four Opus calls plus web fetches can take a minute or more. Stream progress to the page so the demo never looks frozen; have a recorded run as backup.
- **Agent wanders:** the master has a tool-call cap and task budget, and always ends with a report or a clear question.
- **Fetch blocked (leginfo, Anaheim, Costa Mesa, Fullerton, Orange):** HCD Handbook is preloaded; statute status comes from the hand-checked rows in `reference/sources.md` plus web search; city pages via user upload. The report says so. *Tested 2026-11-07: leginfo and Anaheim return 403 to web fetch; HCD, data.ca.gov and Irvine load fine.*
- **Hammering servers:** one-day source cache, one fetch per page per run, no crawling. If a site starts failing, stop.
- **Wrong "SB 9":** the 2021 and 2025 bills share a name; test 9 checks this.
- **Web fetch only opens known URLs:** the source registry goes into the compliance prompt so every URL is "in the conversation."
- **Calling something illegal:** only "possible conflict, confirm," never a ruling.
- **Inventing a section number:** renumbering.md only holds confirmed rows; trick test 4 checks for this.
- **Cost:** log token usage per run; avoid re-running the full pipeline while tuning UI (use mock data).
- **Scope creep:** get the Anaheim ADU upload working end to end first. Add SB 9 only after that.
