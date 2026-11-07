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
   For each, take the test and the clock from the exact section pathways.md names
   (ADU/JADU clock: Gov 66317). **Don't fetch leginfo: it returns 403.** Use the
   hand-checked statute table in reference/sources.md, cite the section's leginfo
   URL and say "hand-checked in a browser on <date>"; never claim a live read.
   Cross-check against the HCD guidance listed in pathways.md (fetch it, or
   web-search its title if the direct URL fails). If a section isn't in the
   hand-checked table and no HCD source confirms it, mark the claim "unverified today."
2. **Check streamlining availability** (multifamily only): fetch the HCD SMAP dashboard.
3. **Get the city checklist.** Use the URL in reference/cities.md, a user URL, or the
   upload. If a city page returns 403, ask the user to download and attach it.
   Never retry repeatedly.
4. **Audit the checklist, line by line.**
   - Every statute citation: look it up in reference/renumbering.md (built from HCD's
     official SB 477 conversion table). If it's an old number, give the current one
     and the source. If it's not in the map, check the HCD ADU Handbook or web-search
     it (not a leginfo fetch). If you still can't confirm the current number, say
     "unknown". Never guess.
   - Every requirement: is it backed by state law, a local rule, or nothing cited?
     Flag anything that looks stricter than state law as "possible conflict, confirm
     with city staff or counsel." Never call it illegal. Cite the statute section
     that sets the state rule (e.g. Gov 66333 for JADU owner-occupancy), not general
     guidance.
   - One finding row per checklist line. If a line has several findings (two stale
     citations and a possible conflict), report them together in that line's row.
   - HCD letters: if reference/cities.md lists an HCD letter for the city, cite it,
     and say whether the checklist still has a problem the letter flagged.
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
