// What the browser and POST /api/fill send each other. No SDK imports here:
// this file is used on both sides.

import type { FillEvent, FormField } from "./types";
import type { UploadKind } from "./upload";

/** A fillable box inside a PDF, read in the browser with pdf-lib. */
export type PdfFieldInfo = {
  name: string;
  kind: "text" | "checkbox" | "radio" | "dropdown" | "other";
  options?: string[]; // radio groups and dropdowns
};

export type TranscriptLine = { from: "fast-track" | "you"; text: string };

export type FillRequest = {
  form:
    | { kind: "sample"; id: string }
    | { kind: "upload"; name: string; fileKind: UploadKind; data: string /* base64 */ };
  /** The fillable boxes in the PDF, when we don't have a curated field list. */
  pdfFields?: PdfFieldInfo[];
  /** Every field so far, with its current value. Empty on the first turn unless curated. */
  fields: FormField[];
  /** The conversation so far, oldest first. */
  transcript: TranscriptLine[];
  /**
   * Facts learned on earlier forms in this visit (lib/context/memory.ts), so this form can
   * pre-fill instead of re-asking. Optional: older clients just don't send it.
   */
  memory?: { facts: unknown[] };
};

/** One line of the NDJSON stream the route sends back. */
export type ServerEvent = FillEvent | { type: "error"; message: string };
