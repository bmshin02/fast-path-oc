# Fixtures

| File | Source | Downloaded | SHA-256 |
|---|---|---|---|
| `anaheim-adu-checklist-z412-nov-2025.pdf` | City of Anaheim Planning Services, form Z412 "Accessory Dwelling Unit Submittal Requirements Checklist," NOV 2025 (PDF created 2025-11-13). Official URL: https://www.anaheim.net/DocumentCenter/View/35053/Accessory-Dwelling-Unit-Submittal-Requirements-Checklist | 2026-11-07, by hand in a browser (the site returns 403 to automated fetches) | `a59f54431b8feaab4447a9867bda57fcff07c5d56e8fbd0313286ab325313137` |
| `irvine-adu-application-package-2025.pdf` | City of Irvine Community Development, ADU Permit Application package (10 pages; PDF modified 2025-05-21; includes building permit application form 65-59 rev 04/23). **Fillable:** 247 text fields + 156 checkboxes. Official URL: https://www.cityofirvine.gov/sites/default/files/legacy-documents/civica-34716-adu-application-package_updated-2025.pdf, linked from https://www.cityofirvine.gov/node/69676 | 2026-11-07 (direct download; Irvine's site allows automated fetches) | `ecb275abb26658d393a1230ba075f17f571d99f95c79e7d9213f9c8247a2d43b` |
| `irvine-development-standards-checklist.pdf` | City of Irvine, Development Standards Checklist (form 67-01), 1 page. **Fillable:** 18 text fields. Official URL: https://www.cityofirvine.gov/sites/default/files/legacy-documents/civica-35890-67-01.pdf | 2026-11-07, with curl | `06547ace1ce91116868c4cbd297883129d48d17889d0be053ddb2bd3a5a627e5` |
| `irvine-hold-harmless-affidavit.pdf` | City of Irvine, Hold Harmless Affidavit (form 67-02), 2 pages. **Fillable:** 13 text fields. Official URL: https://www.cityofirvine.gov/sites/default/files/legacy-documents/civica-35928-67-02.pdf | 2026-11-07, with curl | `98cfd0ff29163e4192bace84884406d625b9b04cf8caa9046508e7d0f91e997c` |

These are public government documents, kept here so tests 1–3 and the demo can run without fetching them. None contains personal information: the forms are blank, and the only contacts are city and fire-authority department addresses and phone numbers. Some internal field names in the Irvine forms (e.g. `SSN` in the affidavit) come from a reused city template; the web app never fills those fields.

The web app serves copies of these PDFs from `web/public/forms/` so the browser can fill them.
