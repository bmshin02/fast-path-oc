// Builds the filled PDF in the browser.
//  - Fillable PDF with at least one field mapped to a box: fill the original
//    in place (boxes stay editable). Answers that have no box are added on
//    extra pages at the end, so nothing is lost.
//  - Otherwise (flat PDF, Word document): generate a "filled form" PDF that
//    lists every field, its value and where it came from.

import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { FormField, FormSource } from "./types";
import { fieldState } from "./types";

export type FilledPdf = { bytes: Uint8Array; fileName: string; inPlace: boolean };

const hasBox = (f: FormField) => Boolean(f.pdfField || f.options?.some((o) => o.pdfField));

export async function buildFilledPdf(source: FormSource, fields: FormField[]): Promise<FilledPdf> {
  const baseName = (source.kind === "sample" ? source.form.id : source.file.name)
    .replace(/\.(pdf|docx)$/i, "")
    .replace(/[^\w-]+/g, "-");
  const fileName = `${baseName}-filled.pdf`;
  const title = source.kind === "sample" ? `${source.form.city}: ${source.form.title}` : source.file.name;

  const original = fields.some(hasBox) ? await originalPdfBytes(source) : null;
  if (original) {
    const filled = await fillInPlace(original, fields, title);
    if (filled) return { bytes: filled, fileName, inPlace: true };
  }

  const doc = await PDFDocument.create();
  await addSummaryPages(doc, title, fields, "Filled form");
  return { bytes: await doc.save(), fileName, inPlace: false };
}

async function originalPdfBytes(source: FormSource): Promise<ArrayBuffer | null> {
  if (source.kind === "upload") return source.fileKind === "pdf" ? source.file.arrayBuffer() : null;
  if (!source.form.fillable) return null;
  const res = await fetch(`/forms/${source.form.id}.pdf`);
  return res.ok ? res.arrayBuffer() : null;
}

/** Puts one value into one named box; returns false if the box isn't there. */
function setBox(form: ReturnType<PDFDocument["getForm"]>, name: string, value: string | boolean): boolean {
  try {
    const field = form.getField(name);
    if (field instanceof PDFTextField) field.setText(winAnsi(String(value)));
    else if (field instanceof PDFCheckBox) {
      if (value === true || /^(yes|true|x)$/i.test(String(value))) field.check();
      else field.uncheck();
    } else if (field instanceof PDFRadioGroup) field.select(String(value));
    else if (field instanceof PDFDropdown) field.select(String(value));
    else return false;
    return true;
  } catch {
    return false;
  }
}

async function fillInPlace(bytes: ArrayBuffer, fields: FormField[], title: string): Promise<Uint8Array | null> {
  try {
    const doc = await PDFDocument.load(bytes);
    const form = doc.getForm();
    const leftOver: FormField[] = [];

    for (const f of fields) {
      if (fieldState(f) !== "filled") continue;
      let placed = false;
      if (f.type === "choice" && f.options?.some((o) => o.pdfField)) {
        for (const o of f.options) {
          if (o.pdfField) placed = setBox(form, o.pdfField, o.label === f.value) || placed;
        }
      } else if (f.pdfField) {
        placed = setBox(form, f.pdfField, f.value as string | boolean);
      }
      if (!placed) leftOver.push(f);
    }

    form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica));
    if (leftOver.length) await addSummaryPages(doc, title, leftOver, "More answers (no box on the form)");
    return await doc.save();
  } catch (err) {
    console.error("Filling the PDF in place failed", err);
    return null;
  }
}

// The standard PDF fonts only cover Western European characters.
function winAnsi(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function addSummaryPages(doc: PDFDocument, title: string, fields: FormField[], heading: string) {
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.1, 0.11);
  const grey = rgb(0.34, 0.35, 0.39);
  const sienna = rgb(0.36, 0.16, 0.1);
  const [w, h, m] = [612, 792, 56];
  const width = w - m * 2;

  let page: PDFPage = doc.addPage([w, h]);
  let y = h - m;
  const ensure = (need: number) => {
    if (y - need < m) {
      page = doc.addPage([w, h]);
      y = h - m;
    }
  };
  const write = (text: string, font: PDFFont, size: number, color = ink, gap = 4) => {
    for (const line of wrap(winAnsi(text), font, size, width)) {
      ensure(size + gap);
      page.drawText(line, { x: m, y: y - size, size, font, color });
      y -= size + gap;
    }
  };

  write(heading, regular, 12, grey);
  write(title, bold, 20, ink, 6);
  write(
    `Prepared with Fast Track on ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}. Prototype, not legal advice. Check every answer before you sign.`,
    regular,
    11,
    grey,
  );
  y -= 16;

  for (const f of fields) {
    const state = fieldState(f);
    const value =
      state === "filled"
        ? f.value === true ? "Yes (checked)" : f.value === false ? "No" : String(f.value)
        : state === "needs-you" ? "Needs you" : "Not filled";
    const source =
      f.source === "research" ? "Looked up" : f.source === "document" ? "From the form" : f.source === "user" ? "From you" : "";
    ensure(48);
    page.drawLine({ start: { x: m, y }, end: { x: w - m, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.87) });
    y -= 10;
    write(f.label + (source && state === "filled" ? `   (${source})` : ""), regular, 10, grey, 3);
    write(value, state === "filled" ? bold : regular, 13, state === "filled" ? ink : sienna, 4);
    if (f.sourceUrl) write(`Source: ${f.sourceUrl}`, regular, 9, grey, 3);
    if (f.note) write(f.note, regular, 10, grey, 3);
    y -= 8;
  }
}
