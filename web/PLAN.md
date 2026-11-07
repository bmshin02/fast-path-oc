# Fast Track web prototype (Person C)

The website part of the project: upload a housing form, answer Claude's questions, and get back the filled form to preview and download.

The overall project plan is in [../PLAN.md](../PLAN.md). This file covers only the website pages that Person C owns.

---

## What the user sees

1. **Landing page (`/`)**: "Welcome to Fast Track, a way to speed up your housing project by 2x." Below it, a large upload icon.
2. **Pick or upload a form**: either upload a PDF or choose one of the forms we already have (see "Forms" below). Then go to the questions page.
3. **Questions page (`/fill`)**: a chat.
   - Claude reads the form and asks only what it can't find out itself, e.g. *"What's your age?"*
   - The user answers ("18"). Claude researches what it can (city rules, fees, statute numbers), asks follow-ups if something is unclear, and fills in the fields.
   - A progress line shows what Claude is doing ("Reading the form…", "Checking Irvine's fee schedule…").
4. **Result (same page)**: Claude says *"Done. I filled 14 of 16 fields; 2 need your signature…"*. Below that:
   - **Preview** of the filled form: every field with its value, where the value came from (you / research / the document) and a source link for researched values. Empty fields are highlighted.
   - **Download** button for the filled PDF.

Every page shows "Prototype · not legal advice · use demo data only, no real personal information."

## Forms

The city forms listed in [../sources.md](../sources.md):

All four PDFs are in `evals/fixtures/` (checked 2026-11-07):

| Form | City | Pages | Fillable boxes? |
|---|---|---|---|
| ADU application package (2025) | Irvine | 10 | Yes: 247 text fields + 156 checkboxes |
| Development Standards Checklist (67-01) | Irvine | 1 | Yes: 18 text fields |
| Hold Harmless Affidavit (67-02) | Irvine | 2 | Yes: 13 text fields |
| ADU Submittal Requirements Checklist (Z412, Nov 2025) | Anaheim | 1 | No: flat page |

The three Irvine forms get filled in place. Anaheim's doesn't have a fillable version (its site blocks automated downloads, and Z412 is a checklist rather than a form), so it uses the generated PDF from decision 3.

Field names in the Irvine PDFs are often unreadable (`Check Box9_D1`, `frm67-01[0]...QtyE4a[0]`), so Claude has to match each field to its printed label. Never fill a field asking for personal ID numbers, such as the `SSN` fields in the affidavit template.

---

## Who owns what

| Person C (this plan) | Person A (don't edit) |
|---|---|
| `web/app/page.tsx`, `web/app/fill/*`, `web/components/*` | `web/lib/agents/*` |
| `web/lib/fill/*` (types, mock data, PDF output) | `web/app/api/check/route.ts` |
| `evals/test-cases.md`, demo script, video | `fast-path-check/SKILL.md` |

Person B owns `fast-path-check/reference/*` and `sources.md`. The website reads those files but doesn't change them.

## The contract between the page and Claude

The UI is built against these types (in `web/lib/fill/types.ts`) so it works on mock data first. The real Claude calls just have to return the same shapes. **Agree this with Person A before step 5.**

```ts
type FormField = {
  id: string;
  label: string;                 // as printed on the form
  type: "text" | "number" | "date" | "checkbox" | "signature";
  value: string | boolean | null; // null = not filled yet
  source?: "user" | "research" | "document";
  sourceUrl?: string;            // required when source = "research"
  checkedOn?: string;            // date for researched values
  note?: string;                 // e.g. "ASSUMPTION", "needs a wet signature"
};

// POST /api/fill  { formId or uploaded PDF, messages so far }
// streams one event per line:
type FillEvent =
  | { type: "status"; text: string }                      // progress line
  | { type: "question"; text: string; fieldIds: string[] } // Claude asks the user
  | { type: "field"; field: FormField }                    // a field got filled
  | { type: "done"; summary: string; fields: FormField[] }; // finished
```

---

## Steps

Each step ends with something to check at http://localhost:3000. Don't start the next step until the current one looks right.

- [x] **0. Setup**: `npm install` in `web/`, `npm run dev`, replace the starter page, set the tab title to "Fast Track".
  *Check:* the app runs and shows a blank Fast Track page.
- [x] **1. Landing page** (redesigned with the unslop + frontend-design skills): headline, one-line explanation, upload icon, disclaimer.
  *Check:* wording and look; it works at phone width.
- [ ] **2. Pick or upload a form**: the upload button plus a list of the forms above. PDFs only, with a size limit. Choosing a form goes to `/fill`.
  *Check:* each way in reaches `/fill` with the right form.
- [ ] **3. Questions page on mock data**: chat UI, progress line, a scripted conversation driven by `FillEvent`s from `web/lib/fill/mock.ts`.
  *Check:* the conversation feels right, including the "age → 18" example.
- [ ] **4. Result: summary, preview, download**: the "Done, I filled…" message, the field-by-field preview, and the download button.
  *Check:* the preview matches the answers; the PDF opens and shows them.
- [ ] **5. Real Claude calls**: replace the mock with `/api/fill` (built with Person A, or by A). Uses the team API key from `web/.env.local` (blank for now; Brandon's key later).
  *Check:* the Anaheim and Irvine forms each go through end to end.
- [ ] **6. Tests and demo**: add the fill-flow cases to `evals/test-cases.md`, plus loading and error states (upload isn't a form, Claude fails or times out), and a scripted backup run for the demo.
  *Check:* the demo works twice in a row.

Later, if there's time: write values into the original PDF's own layout, Spanish, more cities.

## Decisions

1. **Mock first.** Steps 1–4 need no API key and cost nothing. Real calls come in step 5.
2. **Key is server-only:** `ANTHROPIC_API_KEY` in `web/.env.local` (gitignored), never `NEXT_PUBLIC_`, never committed.
3. **Download format:** if a PDF has fillable fields (the Irvine forms), fill them in place with `pdf-lib`. If it's flat (Anaheim), the download is a generated "filled form" PDF: the form's title, every field and its value, and the sources. Writing onto a flat page's layout is a stretch goal.
4. **Researched values always have a source and date.** If Claude can't confirm something, the field stays empty or is marked "unknown", never guessed.

## How we work

- Work happens on the branch `fast-track-web`, never directly on `main`.
- One step at a time: Claude builds, you check it in the browser, then it's committed.
- Pull `main` before each session; push and open a PR only when you decide. A teammate reviews the PR before it merges.
