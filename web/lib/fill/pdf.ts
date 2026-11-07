// Builds the filled PDF in the browser.
//  - Fillable PDF and every field has a pdfField: fill the original in place.
//    Fields stay editable so the user can still fix things in a PDF reader.
//  - Otherwise (flat PDF, Word document, or unmapped fields): generate a new
//    "filled form" PDF listing every field, its value and where it came from.

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { FormField, FormSource } from "./types";
import { fieldState } from "./types";

export type FilledPdf = { bytes: Uint8Array; fileName: string; inPlace: boolean };

export async function buildFilledPdf(
  source: FormSource,
  fields: FormField[],
): Promise<FilledPdf> {
  const baseName = (source.kind === "sample" ? source.form.id : source.file.name)
    .replace(/\.(pdf|docx)$/i, "")
    .replace(/[^\w-]+/g, "-");
  const title = source.kind === "sample" ? `${source.form.city}: ${source.form.title}` : source.file.name;

  const mapped = fields.every((f) => f.pdfField || f.options?.some((o) => o.pdfField));
  const original = await originalPdfBytes(source);
  if (original && mapped) {
    const filled = await fillInPlace(original, fields);
    if (filled) return { bytes: filled, fileName: `${baseName}-filled.pdf`, inPlace: true };
  }
  return { bytes: await summaryPdf(title, fields), fileName: `${baseName}-filled.pdf`, inPlace: false };
}

async function originalPdfBytes(source: FormSource): Promise<ArrayBuffer | null> {
  if (source.kind === "upload") {
    return source.fileKind === "pdf" ? source.file.arrayBuffer() : null;
  }
  if (!source.form.fillable) return null;
  const res = await fetch(`/forms/${source.form.id}.pdf`);
  return res.ok ? res.arrayBuffer() : null;
}

async function fillInPlace(bytes: ArrayBuffer, fields: FormField[]): Promise<Uint8Array | null> {
  try {
    const doc = await PDFDocument.load(bytes);
    const form = doc.getForm();
    for (const f of fields) {
      if (f.value === null || f.value === "") continue;
      if (f.type === "choice" && f.options) {
        for (const o of f.options) {
          if (!o.pdfField) continue;
          const box = form.getCheckBox(o.pdfField);
          if (o.label === f.value) box.check();
          else box.uncheck();
        }
      } else if (f.type === "checkbox" && f.pdfField) {
        const box = form.getCheckBox(f.pdfField);
        if (f.value === true) box.check();
        else box.uncheck();
      } else if (f.pdfField) {
        form.getTextField(f.pdfField).setText(winAnsi(String(f.value)));
      }
    }
    form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica));
    return await doc.save();
  } catch (err) {
    // A mapping that doesn't match this PDF: fall back to the summary PDF.
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

async function summaryPdf(title: string, fields: FormField[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.1, 0.11);
  const grey = rgb(0.34, 0.35, 0.39);
  const sienna = rgb(0.36, 0.16, 0.1);
  const [w, h, m] = [612, 792, 56];
  const width = w - m * 2;

  let page = doc.addPage([w, h]);
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

  write("Filled form", regular, 12, grey);
  write(title, bold, 20, ink, 6);
  write(
    `Prepared with Fast Track on ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}. Prototype, not legal advice. Copy these answers onto the official form.`,
    regular,
    11,
    grey,
  );
  y -= 16;

  for (const f of fields) {
    const state = fieldState(f);
    const value =
      state === "filled"
        ? f.value === true
          ? "Yes (checked)"
          : f.value === false
            ? "No"
            : String(f.value)
        : state === "needs-you"
          ? "Needs you"
          : "Not filled";
    const source =
      f.source === "research" ? "Looked up" : f.source === "document" ? "From the form" : f.source === "user" ? "From you" : "";
    ensure(48);
    page.drawLine({ start: { x: m, y }, end: { x: w - m, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.87) });
    y -= 10;
    write(f.label + (source && state === "filled" ? `   (${source})` : ""), regular, 10, grey, 3);
    write(value, state === "filled" ? bold : regular, 13, state === "filled" ? ink : sienna, 4);
    if (f.note) write(f.note, regular, 10, grey, 3);
    y -= 8;
  }
  return doc.save();
}
