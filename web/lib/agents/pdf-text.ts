// Reads where each piece of text sits on a PDF's pages (pdfjs), and finds a phrase on a page,
// so the producer can edit the uploaded form where the text actually is. Server only.
//
// Matching ignores case, spaces, punctuation and bullets ("65852.2" matches "65852.2" but not
// "65852.22"), because the model copies text from a plain-text view of the page.

// The worker is imported up front so pdfjs never has to load it by path (that breaks once
// the function is bundled for Vercel).
// @ts-expect-error: pdfjs-dist ships no types for the worker module.
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker ??= pdfjsWorker;

/** One run of text as the PDF draws it, in PDF points from the page's bottom-left. */
export type TextRun = { str: string; x: number; y: number; width: number; size: number };
export type PageText = { page: number; width: number; height: number; runs: TextRun[] };

/** Part of one run: characters [from, to) of runs[run].str. */
export type RunSpan = { run: number; from: number; to: number };

export async function readPdfText(bytes: Uint8Array): Promise<PageText[]> {
  // pdfjs takes ownership of the buffer it's given, so hand it a copy.
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  const doc = await task.promise;
  try {
    const pages: PageText[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const [x0, y0, x1, y1] = page.view;
      const content = await page.getTextContent();
      const runs: TextRun[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const [a, b, , , e, f] = item.transform as number[];
        if (Math.abs(b) > 0.01) continue; // rotated text: never edit it
        runs.push({ str: item.str, x: e, y: f, width: item.width, size: Math.abs(a) || item.height });
      }
      pages.push({ page: p, width: x1 - x0, height: y1 - y0, runs });
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

/** The page as plain lines, top to bottom, for the model to copy text from. */
export function pageLines(page: PageText): string[] {
  const lines: { y: number; runs: TextRun[] }[] = [];
  for (const r of page.runs) {
    const line = lines.find((l) => Math.abs(l.y - r.y) < 2);
    if (line) line.runs.push(r);
    else lines.push({ y: r.y, runs: [r] });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((l) =>
      l.runs
        .sort((a, b) => a.x - b.x)
        .map((r) => r.str.trim())
        .join(" "),
    );
}

const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";

type PageKey = { text: string; at: { run: number; ch: number }[] };

function pageKey(page: PageText): PageKey {
  let text = "";
  const at: PageKey["at"] = [];
  page.runs.forEach((r, run) => {
    for (let ch = 0; ch < r.str.length; ch++) {
      const k = keyOf(r.str[ch]);
      if (!k) continue;
      text += k;
      at.push({ run, ch });
    }
  });
  return { text, at };
}

/** Every match of `key` in `text` within [lo, hi), not cutting a number in half. */
function matches(text: string, key: string, lo = 0, hi = text.length): number[] {
  const out: number[] = [];
  for (let i = text.indexOf(key, lo); i !== -1 && i + key.length <= hi; i = text.indexOf(key, i + 1)) {
    const cutsBefore = isDigit(key[0]) && isDigit(text[i - 1]);
    const cutsAfter = isDigit(key[key.length - 1]) && isDigit(text[i + key.length]);
    if (!cutsBefore && !cutsAfter) out.push(i);
  }
  return out;
}

function toSpans(k: PageKey, start: number, length: number): RunSpan[] {
  const spans: RunSpan[] = [];
  for (let i = start; i < start + length; i++) {
    const { run, ch } = k.at[i];
    const last = spans[spans.length - 1];
    if (last && last.run === run) last.to = ch + 1;
    else spans.push({ run, from: ch, to: ch + 1 });
  }
  return spans;
}

/**
 * Where `find` is on the page. With `near`, the match inside the first place `near` appears;
 * if `near` isn't on the page, every match of `find` (a stale citation is replaced everywhere
 * it appears on that page). Each match is a list of run spans (it can cross lines).
 */
export function locate(page: PageText, find: string, near?: string | null): RunSpan[][] {
  const k = pageKey(page);
  const fk = keyOf(find);
  if (!fk) return [];
  const nk = near ? keyOf(near) : "";
  if (nk && nk.includes(fk)) {
    for (const n of matches(k.text, nk)) {
      const hit = matches(k.text, fk, n, n + nk.length)[0];
      if (hit !== undefined) return [toSpans(k, hit, fk.length)];
    }
  }
  return matches(k.text, fk).map((i) => toSpans(k, i, fk.length));
}
