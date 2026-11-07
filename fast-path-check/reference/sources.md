# Live-source registry

What the skill fetches, what each source is for, whether it loads, and what to do when it doesn't.

**Last checked: 2026-11-07.** Each URL was tested with one request from a normal browser user agent. Leginfo was also tested with Claude's web fetch tool.

Rule: this file only says where to look. Before citing anything, fetch the live source. If a row below disagrees with what you fetch, report both and flag this file for an update.

## Fetch status at a glance

| Source | Loads? | If it doesn't |
|---|---|---|
| leginfo.legislature.ca.gov | **Not for web fetch: 403** (curl and Claude web fetch both blocked). It does open in a real browser. | Use the HCD guidance PDFs below, or web-search the section number. Mark statute text "not fetched today." A person can check a section in a browser and record it here. |
| hcd.ca.gov (pages + PDFs) | Yes | — |
| data.ca.gov CKAN API | Yes | — |
| cityofirvine.gov | Yes | — |
| anaheim.net / anaheim.gov | **No, 403** | Ask the user to download the PDF in a browser and attach it. Don't retry. |

## State law: statute text (leginfo)

URL pattern: `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=<N>.`

Each section was checked by hand in a browser on 2026-11-07. Web fetch gets a 403 on all of them.

| Section | Topic | What the live page showed |
|---|---|---|
| Gov 65852.2 | Old ADU section | **No current text.** The page is empty, consistent with the SB 477 renumbering |
| Gov 65852.22 | Old JADU section | **No current text.** Same as above |
| Gov 66314 | ADU approvals | Live. Ch. 13 "Accessory Dwelling Units [66310–66342]", Art. 2 "ADU Approvals [66314–66331]", added by Stats. 2024 ch. 7 |
| Gov 66333 | JADU | Live. Ch. 13, Art. 3 "Junior ADUs [66333–66339.5]", added by Stats. 2024 ch. 7. Subd. (b): owner-occupancy is required only if the JADU **shares sanitation** with the main house |
| Gov 65852.21 | SB 9 two-unit | Live (Ch. 4, Zoning Regulations) |
| Gov 66411.7 | SB 9 lot split | Live (Div. 2, Subdivisions) |
| Gov 66499.41 | Small subdivision, 10 or fewer parcels (SB 684 / SB 1123) | **4 versions on the page**, all from Stats. 2026 ch. 1006 (secs. 4, 4.3, 5, 5.3). It was amended this year, so confirm which version is operative before citing it |
| Gov 65913.4 | SB 35 / SB 423 streamlining | Live (Ch. 4.2, Housing Development Approvals) |
| Gov 65913.4.5 | Permit for SB 684 parcels | Live (Ch. 4.2) |
| Gov 65913.3 | AB 2234 post-entitlement permits | Live (Ch. 4.2) |
| Gov 65912.100 | AB 2011 | Live. Ch. 4.1 "Affordable Housing and High Road Jobs Act of 2022 [65912.100–65912.140]" |

"Live" means the section exists and shows text. The specific clocks and tests in `pathways.md` were **not** checked against this text.

## State guidance (HCD), all loading fine

| Source | URL | Used for |
|---|---|---|
| ADU Handbook (Mar 2026, with Jan 2026 law-change addendum) | https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/adu-handbook-update.pdf | ADU/JADU rules, current section numbers, renumbering |
| ADU Handbook landing page | https://www.hcd.ca.gov/building-standards/adu/handbook | Checking for a newer handbook version |
| Housing Law Fact Sheets (Apr 2026: ADU, SB 9, others) | https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/housing-law-fact-sheets.pdf | Short summaries with section numbers |
| SB 9 Fact Sheet | https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/sb-9-fact-sheet.pdf | SB 9 two-unit and lot split rules |
| SB 35 Guidelines (final update) | https://www.hcd.ca.gov/policy-research/docs/SB-35-Guidelines-Update-Final.pdf | Streamlined multifamily rules |
| SMAP dashboard (says it's updated daily from 6/30/2025) | https://www.hcd.ca.gov/planning-and-community-development/streamlined-ministerial-approval-process-dashboard | Whether SB 35/423 streamlining applies in a given city |
| Draft AB 2011 Guidelines | https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/draft-ab-2011-guidelines.pdf | Corridor / office-to-housing rules (still a draft) |
| Statutory determinations index | https://www.hcd.ca.gov/planning-and-community-development/statutory-determinations | Finding newer guidance. It had **no SB 684 / SB 1123 guidance** as of 2026-11-07 |

## Data: Housing Element Annual Progress Reports (data.ca.gov)

Dataset: https://data.ca.gov/dataset/housing-element-annual-progress-report-apr-data-by-jurisdiction-and-year (free, no API key)

| Table | Resource ID | Contents |
|---|---|---|
| APR Table A | `c78b769d-cc02-4050-91ef-79ded665b5a8` | Applications submitted (`APP_SUBMIT_DT`, `PROJECT_TYPE`, `APPLICATION_STATUS`) |
| APR Table A2 | `fe505d9b-8c36-42ba-ba30-08bc4f34e022` | Entitlement → building permit → certificate of occupancy (`ENT_APPROVE_DT1`, `BP_ISSUE_DT1`, `CO_ISSUE_DT1`) |

**Use exact filters, not `q=`.** `q=ANAHEIM` is a full-text search, so it also matches street addresses in other cities.

Working queries (tested 2026-11-07):

```
# Count a city's ADU rows in Table A2
https://data.ca.gov/api/3/action/datastore_search?resource_id=fe505d9b-8c36-42ba-ba30-08bc4f34e022&limit=0&filters={"JURIS_NAME":"ANAHEIM","UNIT_CAT":"ADU"}

# ADU building-permit units by year (SQL endpoint)
https://data.ca.gov/api/3/action/datastore_search_sql?sql=SELECT "JURIS_NAME","YEAR",SUM("NO_BUILDING_PERMITS") AS bp_units FROM "fe505d9b-8c36-42ba-ba30-08bc4f34e022" WHERE "JURIS_NAME" IN ('ANAHEIM','IRVINE') AND "UNIT_CAT"='ADU' GROUP BY 1,2 ORDER BY 1,2
```

URL-encode the `filters` and `sql` values when you fetch them. `JURIS_NAME` is uppercase.

What it can't show: correction cycles, resubmittals, or why a project was slow.

## City sources

See `cities.md` for each city's permit page, checklist and fee schedule.
