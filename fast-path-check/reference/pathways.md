# Approval pathways

**The skill must fetch and confirm each statute and clock before stating it.** These rows are
starting points from the lane's DATA-SOURCES.md summaries, not verified answers.

Leginfo section URL pattern:
`https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=<N>`

**Fetch status (checked 2026-11-07, Claude Code WebFetch):**
- leginfo: **403 Forbidden** on direct fetch. Don't retry. Web-search the section number + "California Government Code" instead, or use the HCD guidance below and mark the statute text "unverified today."
- HCD ADU page `https://www.hcd.ca.gov/policy-and-research/accessory-dwelling-units`: **fetches OK**. It links the ADU Handbook ("Updated March 2026") at `https://www.hcd.ca.gov/building-standards/adu/handbook` and confirms SB 477 (Ch. 7, Stats. 2024) renumbered the ADU/JADU sections as of March 25, 2024.
- That HCD ADU page has **no SB 9 fact sheet link**. Find the SB 9 fact sheet URL by search.

| Path | Statute | Clock / key point | Guidance | Scope |
|---|---|---|---|---|
| ADU / JADU | Gov 66314–66331 (ADU) / 66333 (JADU) | Ministerial, 60 days | [HCD ADU Handbook (Mar 2026)](https://www.hcd.ca.gov/building-standards/adu/handbook) | **Core** |
| SB 9 two-unit | Gov 65852.21 | Ministerial; HCD has enforced since 2024 | HCD SB 9 fact sheet | Add after ADU works |
| SB 9 lot split | Gov 66411.7 | 60-day clock | HCD SB 9 fact sheet | Add after ADU works |
| Small subdivision, ≤10 parcels (SB 684) | Gov 66499.41 (+ 65913.4.5 for the permit) | Ministerial map; amended by SB 1123, **confirm text** | leginfo | Add after ADU works |
| Streamlined multifamily (SB 35/423) | Gov 65913.4 | Check the SMAP dashboard for each city | HCD SB 35 guidelines | Stretch |
| Corridor / office-to-housing (AB 2011) | Gov 65912.100–.140 | By-right | HCD AB 2011 draft guidelines | Stretch |
| Post-entitlement permits (AB 2234) | Gov 65913.3 | City must post checklists + sample applications online | leginfo | Supports audit |

## How to pick a path
- Accessory unit on a lot with an existing or proposed home → ADU / JADU.
- Second primary unit or a lot split in a single-family zone → SB 9.
- New small subdivision of 10 or fewer parcels → SB 684.
- Multifamily → check SMAP availability first, then SB 35/423 or AB 2011.
- If more than one path fits, list each with its clock and say which is fastest
  **only if** the confirmed clocks support it. Otherwise say "can't rank."

<!-- Seeded 2026-11-07 from PLAN.md. TODO(A): add fetched guidance URLs + key eligibility
tests once confirmed against live sources. -->
