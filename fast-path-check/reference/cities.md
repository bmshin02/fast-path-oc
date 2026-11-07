# Cities

The official permit page, ADU checklist and fee schedule for each city, with fetch status. **Last checked: 2026-11-07.**

Adding a city means adding a section here. Use official city URLs only, never third-party permit sites.

---

## Anaheim (main demo)

**Fetch status: 403 on every anaheim.net / anaheim.gov URL.** Ask the user to download the checklist and attach it. A local copy is at `evals/fixtures/anaheim-adu-checklist-z412-nov-2025.pdf`.

| What | URL | Status |
|---|---|---|
| ADU submittal checklist (form Z412, Nov 2025) | https://www.anaheim.net/DocumentCenter/View/35053/Accessory-Dwelling-Unit-Submittal-Requirements-Checklist | 403 |
| ADU landing page ("ADUheim") | https://www.anaheim.gov/6352/ADU-Anaheim-Landing-Page | 403 |
| ADU Express program | https://www.anaheim.net/ADUexpress | 403 |
| Planning fees | https://www.anaheim.net/5123/Planning-Services-Fees---Currently-in-Ef | 403 |
| ADU rules in the city code | AMC 18.38.015 (cited in the checklist). No official URL checked yet. | unknown |

**What the Z412 checklist says (from the local PDF, 1 page, created 2025-11-13):**

Before building plan check (ADUs and JADUs):
1. Sewer deficiency verification from Public Works (email request; "allow up to four days")
2. Meter spot report, if adding, upgrading or moving an electric meter
3. New address request

Before plan check approval (JADUs only):
1. Owner-occupancy covenant, required by AMC 18.38.015.110. The checklist says it's "authorized by the California Government Code Sections 65852.2 and 65852.22." The City Attorney drafts it and it's recorded before the permit issues.
   - Title report (prepared within the last 6 months)
   - Grant deed

**Things to audit:**
- **Stale citations:** 65852.2 and 65852.22 were renumbered by SB 477 (2024). See `renumbering.md`. Leginfo shows no current text for either section (checked 2026-11-07).
- **Possible conflict, confirm with city staff or counsel:** the checklist requires an owner-occupancy covenant for **all** JADUs. Current Gov 66333(b) requires owner-occupancy only when the JADU shares sanitation facilities with the main house, and not when it has its own (checked in a browser 2026-11-07). This is a lead to check, not a ruling.
- **HCD already flagged it:** HCD's March 24, 2025 findings letter on Anaheim's ADU ordinance (Finding 1) says the deleted sections 65852.2, 65852.22 and 65852.26 must be replaced. The Nov 2025 checklist still cites two of them. HCD did not raise the JADU owner-occupancy covenant. See `research/hcd-letters.md`.
- **Unpublished timeline:** the checklist gives no overall review clock, only "up to four days" for the sewer reply.
- **Fees:** the fee page is blocked, so fees are unknown. A search snippet said updated impact fees take effect 2026-05-25, but that wasn't confirmed from the page itself.

**APR data (Table A2, `UNIT_CAT = ADU`, checked 2026-11-07):** ADU building-permit units by year: 2018: 8 · 2019: 37 · 2020: 108 · 2021: 157 · 2022: 337 · 2023: 349 · 2024: 429 · 2025: 441.

---

## Irvine (comparison city)

**Fetch status: OK.**

| What | URL | Status |
|---|---|---|
| ADU project page (submittal list) | https://www.cityofirvine.gov/node/69676 | 200 |
| ADU permit application package (updated 2025) | https://www.cityofirvine.gov/sites/default/files/legacy-documents/civica-34716-adu-application-package_updated-2025.pdf | 200 |
| Development Standards Checklist | https://www.cityofirvine.gov/sites/default/files/legacy-documents/civica-35890-67-01.pdf | 200 |
| Hold Harmless Affidavit | https://www.cityofirvine.gov/sites/default/files/legacy-documents/civica-35928-67-02.pdf | 200 |
| Fee schedule | https://www.cityofirvine.gov/node/4706 | 200 |
| Pre-Approved ADU Plans Program | https://www.cityofirvine.gov/building-permits-and-inspections/pre-approved-adu-plans-program | 200. The list of plans says "Coming soon" |
| Submittal portal (IrvineReady!) | https://gopost-irvine.eplansoftreview.com/#/login?portal=irvine | not fetched (login page) |

**Submittal items (from the ADU project page):**
- ADU Verification Form (request it from the Planning team)
- ADU Permit Application (the RADU application, required for all ADUs and JADUs)
- Building plans, calculations and construction documents
- Development Standards Checklist for the site plan
- Hold Harmless Affidavit
- Covenant (from Planning; notarized and recorded with the OC Recorder)
- Signed owner + applicant affidavit (e-signatures need the Electronic Signature Disclosure)
- Developer Deposit Case Set-Up form
- School Fee Determination Form, Transportation Corridor Agency Form, Address Application (all in the application package)

**Published timeline:** a completeness check within "approximately two business days," then a fee payment link, then review. No overall review clock is published.

**Statute citations on the page:** none.

**HCD letters:** Jan 7, 2025 findings on ADU Ord. 18-05 (14 findings, including a 120-day review timeline instead of the 60 days in Gov 66317, and deed restrictions on all ADUs, which Gov 66315 prohibits). The Mar 27, 2025 follow-up says Irvine will rely on state law instead of amending, and may restrict separate sale. **Possible conflict, confirm:** the ADU page above still lists a recorded covenant. Check whether it only restricts separate sale. See `research/hcd-letters.md`.

**APR data (Table A2, `UNIT_CAT = ADU`, checked 2026-11-07):** ADU building-permit units by year: 2018: 1 · 2021: 1 · 2022: 5 · 2023: 0 · 2025: 8. That's 42 ADU rows in total, against 14,589 single-family rows. These numbers are very low next to Anaheim's. **ASSUMPTION:** this may reflect how Irvine categorizes units in its reports, not how many ADUs are actually built. Report the numbers as-is and don't draw conclusions from them.

---

## Other OC cities (status from PLAN.md, not re-checked)

| City | Fetch status |
|---|---|
| Santa Ana, Garden Grove, Huntington Beach | Reported OK |
| Costa Mesa, Fullerton, Orange | Reported 403, so use an upload |
