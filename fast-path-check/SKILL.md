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

## Reference files (starting points only — live sources win)
- `reference/pathways.md`: each path's statute, clock, and guidance link
- `reference/renumbering.md`: old → current statute map (confirmed rows only)
- `reference/sources.md`: every live source URL, what it's for, and whether it fetches
- `reference/cities.md`: per-city permit page, checklist, and fee URLs + fetch status
- `reference/report-template.md`: the output format

## Workflow
1. **Identify the path.** Read reference/pathways.md. Pick candidate paths.
   For each, FETCH the live statute or HCD guidance listed there and confirm the
   test and the clock before stating them. If a direct fetch of a registry URL
   fails, web-search the source's title and fetch the result. If that fails, use
   the HCD guidance PDF. If that fails too, mark the claim "unverified today."
2. **Check streamlining availability** (multifamily only): fetch the HCD SMAP dashboard.
3. **Get the city checklist.** Use the URL in reference/cities.md, a user URL, or the
   upload. If a city page returns 403, ask the user to download and attach it.
   Never retry repeatedly.
4. **Audit the checklist, line by line.**
   - Every statute citation: look it up in reference/renumbering.md. If it's an old
     number, give the current one and the source. If it's not in the map, fetch it.
     If you still can't confirm the current number, say "unknown". Never guess.
   - Every requirement: is it backed by state law, a local rule, or nothing cited?
     Flag anything that looks stricter than state law as "possible conflict, confirm
     with city staff or counsel." Never call it illegal.
5. **Check the applicant's package** (if provided) against the checklist.
   Mark each item Present / Missing / Inconsistent / Can't tell.
6. **Optional local numbers:** query data.ca.gov APR Table A/A2 for the city
   (URLs in reference/sources.md). Report counts and dates as-is. Say what the
   data can't show (it has no correction-cycle data).
7. **Write the report** using reference/report-template.md. Always include the
   "What we couldn't verify today" section, even when it's empty.

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
