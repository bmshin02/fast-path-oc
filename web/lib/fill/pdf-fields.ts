// Reads the fillable boxes out of a PDF in the browser, so Claude can say
// which box each answer belongs in.

import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField,
} from "pdf-lib";
import type { PdfFieldInfo } from "./protocol";

const MAX_FIELDS = 400;

export async function readPdfFields(bytes: ArrayBuffer): Promise<PdfFieldInfo[]> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return doc
      .getForm()
      .getFields()
      .slice(0, MAX_FIELDS)
      .map((f): PdfFieldInfo => {
        const name = f.getName();
        if (f instanceof PDFTextField) return { name, kind: "text" };
        if (f instanceof PDFCheckBox) return { name, kind: "checkbox" };
        if (f instanceof PDFRadioGroup) return { name, kind: "radio", options: f.getOptions() };
        if (f instanceof PDFDropdown) return { name, kind: "dropdown", options: f.getOptions() };
        return { name, kind: "other" };
      });
  } catch {
    return []; // unreadable or no form: Claude treats it as a flat form
  }
}
