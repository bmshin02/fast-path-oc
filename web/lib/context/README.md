# Context-aware handling of many files

How Fast Track stays fast, cheap and coherent when someone brings **many documents** (tested with 20) instead of one or two. Two flows, one rule: **the model only ever holds one document plus a small, capped summary of everything else.**

## 1. `/fill`: memory across forms

Jeffrey's queue lets a visitor upload several forms and fill them one after another. Each form is its own chat, so without memory, form 2 re-asks what form 1 already learned.

| Piece | File | What it does |
|---|---|---|
| Project memory | `lib/context/memory.ts` | Turns finished fields into facts (label, value, source, which form). Only **user answers** and **sourced lookups** are kept; never signatures, dates, SSNs, license or account numbers, or staff-only boxes. Same label → newer value wins. Capped at 60 facts and 300 characters per value. |
| Browser store | `lib/context/store.ts` | Keeps the memory in `sessionStorage` (this tab only, gone when it closes). Updated after **every** turn, so an abandoned form still helps the next one. `clearMemory()` is the "forget my answers" hook for the UI. |
| Prompt block | `lib/fill/server/prompt.ts` | Adds `<known_from_earlier_forms>`: facts rendered within a ~4,000-character budget (user answers first, newest first, with a count of anything left out). The system prompt tells Claude to pre-fill matching fields, never re-ask, say how many it filled, and ask once if a fact clearly conflicts. |
| Transcript compaction | `lib/context/transcript.ts` | Long chats keep the last 8 lines verbatim and condense older question/answer pairs into one line each, within ~6,000 characters. The answers still live in the field values. |

The server stores nothing: the browser sends the memory with each turn, and the route sanitizes and caps it (`sanitizeMemory`). The route file itself didn't change.

## 2. `/audit` + `/api/batch/*`: checking up to 20 checklists

`/api/check` takes at most two files in one request, which is fine for a side-by-side comparison but can't do 20 (4.5 MB body limit, 300 s function limit, and the coordinator would have to carry every document).

```
Browser (/audit)                                     Server (one request per file)
──────────────────────────────────────────           ─────────────────────────────────────────
hash each file (SHA-256) ─ skip duplicates           POST /api/batch/doc  (1 PDF ≤ 3 MB)
reuse results saved in this tab                        cache hit? → return it (no model call)
run 3 at a time, retry once ───────────────────────►   parse → re-parse once if empty
show live progress per file ◄── NDJSON progress ─────   stop if not a checklist / personal info
keep {parsed, compliance} for "Open edited form"       compliance + this city's known facts
build the cross-file summary from digests ◄── digest   digest (≤ ~350 tokens)
POST /api/batch/form (1 file + its results) ───────►  producer marks up just that PDF
```

| Piece | File | What it does |
|---|---|---|
| Per-file processor | `lib/batch/process.ts` | Parse → compliance → digest for one file, with an in-process cache keyed by file hash + city + project type + model. Mirrors the coordinator's rules (re-parse an empty result once; stop on "not a checklist" or personal info). |
| City context | `lib/batch/city-context.ts` | Gives the compliance agent what we already know about the city (HCD letters, APR ADU stats from `data/`), so 20 Anaheim checklists don't each re-research Anaheim. Capped at 2,500 characters. Passed through a new optional `context` input to `runCompliance`. |
| Digest | `lib/batch/digest.ts` | A capped summary per file: counts, stale mappings, path and clock, the 8 most serious lines, what couldn't be verified, and **stale citations the rule-based scanner found that the agent didn't flag**. |
| Summary | `lib/batch/aggregate.ts` | Totals, results by city, old law that recurs across files, and which files to look at first. Computed in code, so it can't hallucinate and costs nothing however many files there are. |
| Runner | `lib/batch/runner.ts` + `lib/batch/pool.ts` | Browser queue: 20-file cap, 3 MB per file, 3 at a time, one retry (but not for errors that won't change, like "too large"), dedupe by hash, results kept in `sessionStorage` so a reload doesn't re-audit. |
| Edited form | `app/api/batch/form/route.ts` | Built only when a file is opened: the browser sends that one PDF (raw bytes, under the 4.5 MB limit) plus its saved results, and Brandon's producer (`editForm`) marks up the city's own form. Nothing is re-audited. |
| Page | `app/audit/page.tsx`, `components/audit/AuditBatch.tsx` | Drop up to 20 PDFs, city guessed from each file name (editable), live status per file, summary across files, **open the edited form** (change list, preview, PDF download), and **compare** two files side by side from their digests (no server call). `?mock=1` = sample results, no API calls. |

## Measured (mock mode, 20 files)

- 20/20 files processed with the real worker pool; peak concurrency was exactly 3.
- 20 digests ≈ **7k tokens** vs ≈ **23k** for the full results: any later model call over the batch uses about 30% of the context.
- Re-adding the same 20 files in the same tab: **0 server calls** (all reused).
- A 21st file is refused with a clear message; a duplicate file is audited once.
- "Open edited form" returned a real marked-up PDF with its change list; "compare" ran from two digests with no request.
- `tsc`, `eslint` and `next build` pass; 40 offline tests (`npx tsx --test lib/context/__tests__/*.test.ts lib/features/__tests__/*.test.ts`).

## Not done / next

- The live `/fill` memory path needs a run with the API key to see Claude actually skip questions. The prompt wiring is unit-tested, but the model's behavior isn't verified yet.
- Jeffrey's queue (PR #2) caps uploads at 6. With memory in place, raising it is safe.
- The `/fill` UI has no "Forget my answers" button yet (`clearMemory()` is ready). The memory also clears when the tab closes.
- The server cache is per instance. A shared store (e.g. Vercel KV) would let results survive cold starts; the browser copy already covers reloads.
