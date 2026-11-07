// Applies the producer's plan to the uploaded form itself (pdf-lib), so the deliverable is the
// city's own PDF, filled in and corrected, not a separate report:
//  - stale citation: the old number is covered and the current section is written in its place, in red
//  - possible conflict: the line is highlighted and gets a numbered red marker in the margin
//  - fillable box: filled with a researched fact (never personal details)
// One short page at the end lists every change with its source and date, since the page
// itself has no room for sources. Anything that couldn't be placed is listed there too.

import {
  PDFArray,
  PDFCheckBox,
  PDFDict,
  PDFDocument,
  PDFDropdown,
  PDFName,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { mergeById } from "./findings";
import { locate, type PageText, type RunSpan, type TextRun } from "./pdf-text";
import type { ComplianceResult, FormChange, FormEdit, FormPlan, ParsedDoc } from "./schemas";

const RED = rgb(0.72, 0.11, 0.11);
const GREY = rgb(0.34, 0.35, 0.39);
const INK = rgb(0.09, 0.1, 0.11);
const HIGHLIGHT = rgb(1, 0.86, 0.2);
const POSSIBLE_CONFLICT = "Possible conflict, confirm with city staff or counsel.";

/** Boxes the producer must never fill: they ask for someone's personal details or signature. */
export const PERSONAL_FIELD =
  /sign|ssn|social|security|name|address|phone|fax|e-?mail|apn|parcel|owner|applicant|employee|contractor|licen[cs]e|birth|dob|initial|date/i;

// ---------- fallback plan, built by code from the compliance data ----------

/** "65852.2 → 66310–66342 (ADU approvals: …); 65852.22 → 66333" → [[old, new], …] */
export function citationMappings(newCitation: string | null): [string, string][] {
  if (!newCitation) return [];
  const out: [string, string][] = [];
  for (const part of newCitation.split(";")) {
    const m = part.match(/(\d[\d.]*\d)\s*(?:→|->)\s*([^()]+?)\s*(?:\(|$)/);
    if (m) out.push([m[1], m[2].trim()]);
  }
  return out;
}

/** The first few words of a line, enough to find and highlight its start. */
function lead(text: string, words = 6): string {
  return text.replace(/^[^A-Za-z0-9]+/, "").split(/\s+/).slice(0, words).join(" ");
}

/**
 * Used when the model step fails (and in demo mode): every renumbered citation is replaced with
 * the mapping compliance confirmed, and every possible conflict gets a note from its state rule.
 */
export function planFromData(parsed: ParsedDoc, compliance: ComplianceResult): FormPlan {
  const items = new Map(parsed.items.map((i) => [i.id, i]));
  const edits: FormEdit[] = [];
  for (const c of mergeById(compliance.items)) {
    const item = items.get(c.id);
    if (!item) continue;
    for (const [oldCite, newCite] of citationMappings(c.newCitation)) {
      edits.push({ page: item.page, near: null, find: oldCite, replace: newCite, note: null, sourceUrl: c.sourceUrl });
    }
    if (c.status === "possible_conflict") {
      const rule = c.stateRule ?? c.note.replace(/possible conflict,? confirm with city staff or counsel\.?/i, "").trim();
      edits.push({
        page: item.page,
        near: item.text,
        find: lead(item.text),
        replace: null,
        note: `${rule}${c.suggestedFix ? ` Suggested fix: ${c.suggestedFix}` : ""} ${POSSIBLE_CONFLICT}`.trim(),
        sourceUrl: c.sourceUrl,
      });
    }
  }
  return { edits, fills: [] };
}

// ---------- guardrails on the model's plan ----------

const digitRuns = (s: string): string[] => s.match(/\d[\d.]*\d|\d/g) ?? [];

/**
 * Keeps only edits the data backs: a replacement must swap a citation compliance marked as
 * renumbered for a section that mapping names, and a note must come with a source.
 * Fills must name a real, non-personal box. Returns what was kept and what was dropped.
 */
export function checkPlan(
  plan: FormPlan,
  compliance: ComplianceResult,
  fieldNames: Set<string>,
): { plan: FormPlan; dropped: string[] } {
  const mappings = compliance.items.flatMap((c) => citationMappings(c.newCitation));
  const allNew = compliance.items.map((c) => c.newCitation ?? "").join(" ");
  const dropped: string[] = [];

  const edits = plan.edits.filter((e) => {
    if (e.replace !== null) {
      const known = mappings.some(([o]) => digitRuns(e.find).includes(o));
      const backed = digitRuns(e.replace).every((d) => allNew.includes(d));
      if (!known || !backed || digitRuns(e.replace).length === 0) {
        dropped.push(`Replace "${e.find}" with "${e.replace}" (not a renumbering the compliance check confirmed)`);
        return false;
      }
    } else if (!e.note) {
      return false;
    }
    return true;
  });

  const fills = plan.fills.filter((f) => {
    if (!fieldNames.has(f.field)) {
      dropped.push(`Box "${f.field}" (not on the form)`);
      return false;
    }
    if (PERSONAL_FIELD.test(f.field)) {
      dropped.push(`Box "${f.field}" (asks for personal details; left for the applicant)`);
      return false;
    }
    return true;
  });

  return { plan: { edits, fills }, dropped };
}

// ---------- drawing on the PDF ----------

// The standard PDF fonts only cover Western European characters.
function winAnsi(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[→]/g, "->")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7e\xa0-\xff–—•]/g, "?");
}

type Box = { x: number; y: number; width: number; size: number; run: TextRun };

/** Where a span sits, in points. Character offsets are scaled by Helvetica widths, close enough for one word. */
function boxOf(runs: TextRun[], s: RunSpan, font: PDFFont): Box {
  const run = runs[s.run];
  const full = font.widthOfTextAtSize(winAnsi(run.str), 10) || 1;
  const at = (n: number) => run.x + (run.width * font.widthOfTextAtSize(winAnsi(run.str.slice(0, n)), 10)) / full;
  const x = at(s.from);
  return { x, y: run.y, width: Math.max(1, at(s.to) - x), size: run.size, run };
}

/** Room to the right of a box on its line before the next run starts. */
function roomAfter(page: PageText, b: Box): number {
  const right = b.x + b.width;
  const next = page.runs
    .filter((r) => Math.abs(r.y - b.y) < 2 && r.x > right - 0.5 && r !== b.run)
    .reduce((min, r) => Math.min(min, r.x), page.width - 24);
  // The rest of the box's own run also counts as taken.
  const runEnd = b.run.x + b.run.width;
  const stop = runEnd > right + 0.5 ? right : next;
  return Math.max(0, stop - right - 1);
}

function cover(p: PDFPage, b: Box, extra = 0) {
  p.drawRectangle({ x: b.x - 0.5, y: b.y - b.size * 0.24, width: b.width + extra + 1, height: b.size * 1.06, color: rgb(1, 1, 1) });
}

/** Write `text` over the first box, shrinking it to fit the space the old text left. False if it can't fit. */
function replaceText(p: PDFPage, page: PageText, boxes: Box[], text: string, font: PDFFont): boolean {
  const first = boxes[0];
  const room = first.width + roomAfter(page, first);
  let size = first.size;
  const t = winAnsi(text);
  const minSize = Math.max(5.5, first.size * 0.5);
  while (font.widthOfTextAtSize(t, size) > room && size - 0.25 >= minSize) size -= 0.25;
  const width = font.widthOfTextAtSize(t, size);
  if (width > room) return false;
  for (const b of boxes) cover(p, b);
  cover(p, first, Math.max(0, width - first.width));
  for (const b of boxes) unlink(p, b);
  p.drawText(t, { x: first.x, y: first.y, size, font, color: RED });
  p.drawLine({
    start: { x: first.x, y: first.y - first.size * 0.16 },
    end: { x: first.x + width, y: first.y - first.size * 0.16 },
    thickness: 0.6,
    color: RED,
  });
  return true;
}

/** Removes a link sitting on replaced text, so the corrected section doesn't open the old one. */
function unlink(p: PDFPage, b: Box) {
  const annots = p.node.Annots();
  if (!annots) return;
  for (let i = annots.size() - 1; i >= 0; i--) {
    const annot = annots.lookupMaybe(i, PDFDict);
    if (annot?.get(PDFName.of("Subtype")) !== PDFName.of("Link")) continue;
    const rect = annot.lookupMaybe(PDFName.of("Rect"), PDFArray)?.asRectangle();
    if (!rect) continue;
    const overlapsX = rect.x < b.x + b.width && rect.x + rect.width > b.x;
    const overlapsY = rect.y < b.y + b.size * 0.8 && rect.y + rect.height > b.y;
    if (overlapsX && overlapsY) annots.remove(i);
  }
}

function strike(p: PDFPage, boxes: Box[]) {
  for (const b of boxes) {
    const y = b.y + b.size * 0.3;
    p.drawLine({ start: { x: b.x, y }, end: { x: b.x + b.width, y }, thickness: 0.9, color: RED });
  }
}

function highlight(p: PDFPage, boxes: Box[]) {
  for (const b of boxes) {
    p.drawRectangle({ x: b.x, y: b.y - b.size * 0.22, width: b.width, height: b.size * 1.05, color: HIGHLIGHT, opacity: 0.35 });
  }
}

/** A red circled number in the left margin of the box's line (or just after it if there's no margin). */
function marker(p: PDFPage, page: PageText, b: Box, n: number, bold: PDFFont) {
  const lineStart = page.runs.filter((r) => Math.abs(r.y - b.y) < 2).reduce((min, r) => Math.min(min, r.x), b.x);
  const r = 6;
  const cx = lineStart - r - 4 >= r + 2 ? lineStart - r - 4 : b.x + b.width + r + 2;
  const cy = b.y + b.size * 0.35;
  p.drawCircle({ x: cx, y: cy, size: r, color: RED });
  const label = String(n);
  const size = n > 9 ? 6 : 7.5;
  p.drawText(label, { x: cx - bold.widthOfTextAtSize(label, size) / 2, y: cy - size * 0.36, size, font: bold, color: rgb(1, 1, 1) });
}

/** Puts one value into one named box; returns false if it can't. */
function setBox(form: ReturnType<PDFDocument["getForm"]>, name: string, value: string): boolean {
  try {
    const field = form.getField(name);
    if (field instanceof PDFTextField) field.setText(winAnsi(value));
    else if (field instanceof PDFCheckBox) {
      if (/^(yes|true|x|checked)$/i.test(value)) field.check();
      else field.uncheck();
    } else if (field instanceof PDFRadioGroup) field.select(value);
    else if (field instanceof PDFDropdown) field.select(value);
    else return false;
    return true;
  } catch {
    return false;
  }
}

/** Every fillable box on the form, for the model. Empty for a flat PDF. */
export async function formFields(bytes: Uint8Array): Promise<{ name: string; kind: string; options?: string[] }[]> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return doc
      .getForm()
      .getFields()
      .slice(0, 400)
      .map((f) => {
        const name = f.getName();
        if (f instanceof PDFTextField) return { name, kind: "text" };
        if (f instanceof PDFCheckBox) return { name, kind: "checkbox" };
        if (f instanceof PDFRadioGroup) return { name, kind: "radio", options: f.getOptions() };
        if (f instanceof PDFDropdown) return { name, kind: "dropdown", options: f.getOptions() };
        return { name, kind: "other" };
      });
  } catch {
    return [];
  }
}

export async function applyFormPlan(
  bytes: Uint8Array,
  pages: PageText[],
  plan: FormPlan,
  meta: { title: string; checkedOn: string; dropped?: string[] },
): Promise<{ bytes: Uint8Array; changes: FormChange[] }> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const changes: FormChange[] = [];
  let noteNo = 0;

  for (const e of plan.edits) {
    const page = pages[e.page - 1];
    const pdfPage = doc.getPages()[e.page - 1];
    const hits = page && pdfPage ? locate(page, e.find, e.near) : [];
    const isReplace = e.replace !== null;
    // A stale citation is replaced everywhere it appears on the page; a note marks the first place.
    const targets = isReplace ? hits : hits.slice(0, 1);

    if (isReplace) {
      let fitted = targets.length > 0;
      for (const spans of targets) {
        const boxes = spans.map((s) => boxOf(page.runs, s, font));
        if (!replaceText(pdfPage, page, boxes, e.replace!, font)) {
          // No room to write it in place: strike the old number and number a note instead.
          strike(pdfPage, boxes);
          fitted = false;
        }
      }
      const number = targets.length && !fitted ? ++noteNo : null;
      if (number) marker(pdfPage, page, boxOf(page.runs, targets[0][0], font), number, bold);
      changes.push({
        kind: "citation",
        number,
        page: e.page,
        original: e.find,
        newText: e.replace,
        note: null,
        sourceUrl: e.sourceUrl,
        placed: targets.length > 0,
      });
      continue;
    }

    const number = ++noteNo;
    if (targets.length) {
      const boxes = targets[0].map((s) => boxOf(page.runs, s, font));
      highlight(pdfPage, boxes);
      marker(pdfPage, page, boxes[0], number, bold);
    }
    changes.push({
      kind: "note",
      number,
      page: e.page,
      original: e.find,
      newText: null,
      note: e.note,
      sourceUrl: e.sourceUrl,
      placed: targets.length > 0,
    });
  }

  if (plan.fills.length) {
    const form = doc.getForm();
    for (const f of plan.fills) {
      changes.push({
        kind: "fill",
        number: null,
        page: null,
        original: f.field,
        newText: f.value,
        note: null,
        sourceUrl: f.sourceUrl,
        placed: setBox(form, f.field, f.value),
      });
    }
    form.updateFieldAppearances(font);
  }

  if (changes.length || meta.dropped?.length) addChangePage(doc, changes, meta, font, bold);
  return { bytes: await doc.save(), changes };
}

// ---------- the change page ----------

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of winAnsi(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function addChangePage(
  doc: PDFDocument,
  changes: FormChange[],
  meta: { title: string; checkedOn: string; dropped?: string[] },
  font: PDFFont,
  bold: PDFFont,
) {
  const { width: w, height: h } = doc.getPage(0).getSize();
  const m = 48;
  const width = w - m * 2;
  let page = doc.addPage([w, h]);
  let y = h - m;
  const write = (text: string, f: PDFFont, size: number, color = INK, indent = 0, gap = 3) => {
    for (const line of wrap(text, f, size, width - indent)) {
      if (y - size < m) {
        page = doc.addPage([w, h]);
        y = h - m;
      }
      page.drawText(line, { x: m + indent, y: y - size, size, font: f, color });
      y -= size + gap;
    }
  };

  write("Changes made by Fast Track", bold, 15);
  write(
    `${meta.title}. Checked against current California law on ${meta.checkedOn}. Prototype, not legal advice. Red text on the form is ours, not the city's.`,
    font,
    9.5,
    GREY,
  );
  y -= 10;

  const source = (c: FormChange) => (c.sourceUrl ? ` Source: ${c.sourceUrl} (checked ${meta.checkedOn}).` : "");
  for (const c of changes) {
    const where = c.page ? `Page ${c.page}: ` : "";
    const missing = c.placed ? "" : " (couldn't find it on the page)";
    let text: string;
    if (c.kind === "citation")
      text =
        `${where}"${c.original}" is now ${c.newText}.` +
        (c.number ? " It's struck through on the form; there wasn't room to write the new section on the line." : "") +
        `${missing}${source(c)}`;
    else if (c.kind === "note") text = `${where}${c.note}${missing}${source(c)}`;
    else text = `Filled box "${c.original}" with "${c.newText}".${c.placed ? "" : " (the box couldn't take this value)"}${source(c)}`;
    const label = c.number ? `${c.number}.` : "-";
    if (y - 14 < m) {
      page = doc.addPage([w, h]);
      y = h - m;
    }
    page.drawText(label, { x: m, y: y - 10, size: 10, font: bold, color: c.number ? RED : INK });
    write(text, font, 10, INK, 18);
    y -= 6;
  }

  if (meta.dropped?.length) {
    y -= 6;
    write("Not changed (the check couldn't back these up):", bold, 10, GREY);
    for (const d of meta.dropped) write(`- ${d}`, font, 9.5, GREY, 8);
  }
}
