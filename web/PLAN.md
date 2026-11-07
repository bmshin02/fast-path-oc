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
// web/lib/fill/types.ts (source of truth; this is a summary)
type FormField = {
  id: string;
  label: string;                  // as printed on the form, in plain words
  type: "text" | "checkbox" | "choice" | "signature" | "date";
  value: string | boolean | null; // null = not filled yet
  source?: "user" | "research" | "document";
  sourceUrl?: string;             // required when source = "research"
  checkedOn?: string;             // date for researched values
  note?: string;                  // e.g. "ASSUMPTION: ...", "Sign by hand"
  pdfField?: string;              // the PDF form field, when the PDF is fillable
  options?: { label: string; pdfField?: string }[]; // for "choice" (checkbox groups)
};

// A session yields these events (web/lib/fill/session.ts):
type FillEvent =
  | { type: "status"; text: string }                       // progress line
  | { type: "message"; text: string }                      // Fast Track says something
  | { type: "question"; text: string; fieldIds: string[]; choices?: string[] } // waits for the user; two choices = answer buttons
  | { type: "field"; field: FormField }                    // a field got filled
  | { type: "done"; summary: string; fields: FormField[] }; // finished

interface FillSession {
  readonly fields: FormField[];                    // every field, empty at first
  start(): AsyncGenerator<FillEvent>;              // until the first question
  answer(text: string): AsyncGenerator<FillEvent>; // until the next question
}
```

Today `createSession()` returns the scripted mock (`web/lib/fill/mock/`). Step 5 swaps in a version that calls `POST /api/fill` and streams the same events; the pages don't change.

---

## How the real version works

- Each turn the browser POSTs the form, the fields so far and the transcript to `/api/fill`. The server keeps nothing; uploads only live in memory for one request.
- The server sends Claude (`claude-opus-5-5`, effort `medium`) the form as a document block (cached, so later turns re-read it cheaply), then the fields and conversation as text. Claude replies in a fixed JSON format (structured outputs): a message, field updates, the next question, or done.
- Claude may use web search (up to 3 times a turn) for public facts, and must give a source link.
- Server-side fallback (`fallbacks: "default"`) re-runs a request on a suitable model if a safety check declines it.
- The server re-checks every answer: signatures and sensitive numbers (SSN, ID, bank) are never filled, and answers can only go into PDF boxes that really exist.
- Irvine ADU uses our curated box list. Other fillable PDFs send their box names from the browser so Claude can fill them in place. Word files are converted to text on the server (`mammoth`).
- Cost: about $0.10 for the first turn (writes the form to the cache), about $0.02-0.04 per turn after; a full form is roughly $0.30-0.50. Each call logs its token use to the server console.

## Fill screen behavior

- While Fast Track is asking, the screen is one workspace: chat on the left (answer box always at the bottom), the form filling in on the right. On phones the form folds into a "Your form: N of M filled" button above the chat. No form card or "Change form" button during the chat.
- Questions with exactly two answers (yes/no, one story/two) show two big buttons instead of a text box.
- When done, the result (summary, download, preview, answers) replaces the chat; the conversation folds into "See the conversation", and "Fill another form" starts over.
- The fill page header is just the logo.

## Several forms at once

- The upload accepts up to 6 PDF/Word files at once (3 MB each). Files with problems are listed; the visitor can continue with the ones that work.
- Fast Track works through them in order (`components/fill/FillQueue.tsx`). A 200px checklist on the left of the chat shows each file as done, working on now, or not started; long names are cut with "…" (full name on hover). On phones it folds into "Form N of M".
- After each form: its result and download, then "Start next form". When all are done, any finished form can be reopened from the checklist.

## Where things live

- Sample PDFs the browser fills: `web/public/forms/<id>.pdf` (copies of `evals/fixtures/`, renamed by form id).
- The Irvine ADU mock fills page 2 (Building Permit Application). Its PDF field names were read from the real file; office-use boxes are never filled.
- Filled PDFs are built in the browser with `pdf-lib` (`web/lib/fill/pdf.ts`): filled in place when every field maps to the PDF, otherwise a generated "filled form" PDF.

## Steps

Each step ends with something to check at http://localhost:3000. Don't start the next step until the current one looks right.

- [x] **0. Setup**: `npm install` in `web/`, `npm run dev`, replace the starter page, set the tab title to "Fast Track".
  *Check:* the app runs and shows a blank Fast Track page.
- [x] **1. Landing page** (redesigned with the unslop + frontend-design skills): headline, one-line explanation, upload icon, disclaimer.
  *Check:* wording and look; it works at phone width.
- [x] **2. Pick or upload a form**: the upload button plus a list of the forms above. PDF and Word (.docx) only, up to 3 MB (sent as base64, so it stays under Vercel's 4.5 MB request limit). Choosing a form goes to `/fill`.
  *Check:* each way in reaches `/fill` with the right form.
- [x] **3. Questions page on mock data**: chat UI, progress line, a scripted conversation driven by `FillEvent`s from `web/lib/fill/mock.ts`.
  *Check:* the conversation feels right, including the "age → 18" example.
- [x] **4. Result: summary, preview, download**: the "Done, I filled…" message, the field-by-field preview, and the download button.
  *Check:* the preview matches the answers; the PDF opens and shows them.
- [x] **5. Real Claude calls**: `POST /api/fill` (`web/app/api/fill/route.ts`, built on this branch; Person A to review). Uses `ANTHROPIC_API_KEY` from `web/.env` (copy `web/.env.example`; your own key for testing, Brandon's team key later). Add `?mock=1` to any `/fill` URL to run the scripted demo instead (no API calls).
  *Checked:* Irvine ADU end to end (fills the real PDF), Irvine hold harmless (Claude finds the boxes itself), a Word upload.
- [ ] **6. Tests and demo**: add the fill-flow cases to `evals/test-cases.md`, plus loading and error states (upload isn't a form, Claude fails or times out), and a scripted backup run for the demo.
  *Check:* the demo works twice in a row.

Later, if there's time:
- **Scroll "assemble" effect on the landing page** (like steep.app): as you scroll down, the cards floating around the headline glide into the product window below and lock into place, so the separate pieces combine into one screen. Do this after the features work; respect reduced-motion settings.
- Write values into a flat PDF's own layout, Spanish, more cities.

## Decisions

1. **Mock first.** Steps 1–4 need no API key and cost nothing. Real calls come in step 5.
2. **Key is server-only:** `ANTHROPIC_API_KEY` in `web/.env` (gitignored; template in `web/.env.example`), never `NEXT_PUBLIC_`, never committed.
3. **Download format:** if a PDF has fillable fields (the Irvine forms), fill them in place with `pdf-lib`. If it's flat (Anaheim), the download is a generated "filled form" PDF: the form's title, every field and its value, and the sources. Writing onto a flat page's layout is a stretch goal.
   **Word documents (.docx)** are accepted too. Claude can't read .docx directly, so in step 5 the server turns it into text first (e.g. with `mammoth`) and the download is the generated PDF, like a flat form. Older .doc files can be chosen, but the user is asked to re-save them as .docx or PDF. Any other file type is hidden in the file picker and can't be dropped.
4. **Researched values always have a source and date.** If Claude can't confirm something, the field stays empty or is marked "unknown", never guessed.

## How we work

- Work happens on the branch `fast-track-web`, never directly on `main`.
- One step at a time: Claude builds, you check it in the browser, then it's committed.
- Pull `main` before each session; push and open a PR only when you decide. A teammate reviews the PR before it merges.
