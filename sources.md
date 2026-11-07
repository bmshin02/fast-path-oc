# Sources

Every law, dataset and link this project uses, with the date it was checked. All dates are **2026-11-07** unless noted otherwise.

For fetch status, fallbacks and working API queries, see [fast-path-check/reference/sources.md](fast-path-check/reference/sources.md). For per-city details, see [fast-path-check/reference/cities.md](fast-path-check/reference/cities.md).

## California law (Government Code, via leginfo.legislature.ca.gov)

Each section was checked by hand in a browser. Automated fetches get a 403.

| Section | Topic | Checked |
|---|---|---|
| [65852.2](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=65852.2.) | Old ADU section: no current text (renumbered by SB 477, 2024) | 2026-11-07 |
| [65852.22](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=65852.22.) | Old JADU section: no current text | 2026-11-07 |
| [66314](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=66314.) | ADU approvals (Ch. 13, 66310–66342) | 2026-11-07 |
| [66317](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=66317.) | ADU permit clock: 15-business-day completeness decision, 60 days to decide | 2026-11-07 |
| [66333](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=66333.) | JADU | 2026-11-07 |
| [65852.21](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=65852.21.) | SB 9 two-unit | 2026-11-07 |
| [66411.7](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=66411.7.) | SB 9 lot split | 2026-11-07 |
| [66499.41](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=66499.41.) | Small subdivision, 10 or fewer parcels. Amended by Stats. 2026 ch. 1006; several versions | 2026-11-07 |
| [65913.4.5](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=65913.4.5.) | Permit for SB 684 parcels | 2026-11-07 |
| [65913.4](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=65913.4.) | SB 35 / SB 423 streamlining | 2026-11-07 |
| [65913.3](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=65913.3.) | AB 2234 post-entitlement permits | 2026-11-07 |
| [65912.100](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=65912.100.) | AB 2011 | 2026-11-07 |

## State guidance (HCD)

| Document | Checked |
|---|---|
| [ADU Handbook, March 2026](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/adu-handbook-update.pdf) ([landing page](https://www.hcd.ca.gov/building-standards/adu/handbook)) | 2026-11-07 |
| [Housing Law Fact Sheets, April 2026](https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/housing-law-fact-sheets.pdf) | 2026-11-07 |
| [SB 9 Fact Sheet](https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/sb-9-fact-sheet.pdf) | 2026-11-07 |
| [SB 35 Guidelines (final update)](https://www.hcd.ca.gov/policy-research/docs/SB-35-Guidelines-Update-Final.pdf) | 2026-11-07 |
| [SMAP dashboard](https://www.hcd.ca.gov/planning-and-community-development/streamlined-ministerial-approval-process-dashboard) | 2026-11-07 |
| [Draft AB 2011 Guidelines](https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/draft-ab-2011-guidelines.pdf) | 2026-11-07 |
| [Anaheim ADU/SB 9 findings letter, Mar 24, 2025](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/anaheim-adu-sb9-findings-032425.pdf) | 2026-11-07 |
| [Irvine ADU findings letter, Jan 7, 2025](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/irvine-adu-findings-010725.pdf) and [technical assistance letter, Mar 27, 2025](https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/irvine-adu-ta-032725.pdf) | 2026-11-07 |
| [HCD enforcement letters dashboard](https://www.hcd.ca.gov/hau/enforcement-letters) | 2026-11-07 |
| [Statutory determinations index](https://www.hcd.ca.gov/planning-and-community-development/statutory-determinations) | 2026-11-07 |

## Datasets

| Dataset | Checked |
|---|---|
| [Housing Element Annual Progress Report (APR) data, data.ca.gov](https://data.ca.gov/dataset/housing-element-annual-progress-report-apr-data-by-jurisdiction-and-year): Table A `c78b769d-cc02-4050-91ef-79ded665b5a8`, Table A2 `fe505d9b-8c36-42ba-ba30-08bc4f34e022` | 2026-11-07 |

## City documents

| City | Document | Checked |
|---|---|---|
| Anaheim | [ADU Submittal Requirements Checklist, form Z412, Nov 2025](https://www.anaheim.net/DocumentCenter/View/35053/Accessory-Dwelling-Unit-Submittal-Requirements-Checklist). The site blocks automated fetches, so a browser-downloaded copy is in `evals/fixtures/` | 2026-11-07 |
| Anaheim | [ADU landing page](https://www.anaheim.gov/6352/ADU-Anaheim-Landing-Page), [ADU Express](https://www.anaheim.net/ADUexpress), [Planning fees](https://www.anaheim.net/5123/Planning-Services-Fees---Currently-in-Ef). URLs found by search; pages blocked (403), content not read | 2026-11-07 |
| Irvine | [ADU project page](https://www.cityofirvine.gov/node/69676) | 2026-11-07 |
| Irvine | [ADU application package (2025)](https://www.cityofirvine.gov/sites/default/files/legacy-documents/civica-34716-adu-application-package_updated-2025.pdf), [Development Standards Checklist](https://www.cityofirvine.gov/sites/default/files/legacy-documents/civica-35890-67-01.pdf), [Hold Harmless Affidavit](https://www.cityofirvine.gov/sites/default/files/legacy-documents/civica-35928-67-02.pdf), [Fee schedule](https://www.cityofirvine.gov/node/4706), [Pre-Approved ADU Plans](https://www.cityofirvine.gov/building-permits-and-inspections/pre-approved-adu-plans-program) | 2026-11-07 |

## Not used

Third-party permit sites (permitmagic, propertyzoned, zoning.buildingclub and similar) showed up in searches. We don't rely on them: they aren't official and their figures conflict with each other.
