// Shared types for the fill flow. The UI is built against these, first with
// mock data (steps 3-4) and then with real Claude calls (step 5).
// See web/PLAN.md, "The contract between the page and Claude".

import type { SampleForm } from "./forms";
import type { UploadKind } from "./upload";

/** The form the user is filling: one of ours, or a file they uploaded. */
export type FormSource =
  | { kind: "sample"; form: SampleForm }
  | { kind: "upload"; file: File; fileKind: UploadKind };

export type FormField = {
  id: string;
  label: string; // as printed on the form, in plain words
  type: "text" | "checkbox" | "choice" | "signature" | "date";
  value: string | boolean | null; // null = not filled yet
  source?: "user" | "research" | "document";
  sourceUrl?: string; // required when source = "research" (real mode)
  checkedOn?: string; // date for researched values
  note?: string; // e.g. "ASSUMPTION: ...", "Sign by hand after printing"
  /** The PDF form field this maps to, when the PDF is fillable. */
  pdfField?: string;
  /** For type "choice": each option and the PDF checkbox it ticks. */
  options?: { label: string; pdfField?: string }[];
};

/** One streamed event from a fill session (mock now, POST /api/fill later). */
export type FillEvent =
  | { type: "status"; text: string } // progress line, e.g. "Reading your form…"
  | { type: "message"; text: string } // something Fast Track says
  | { type: "question"; text: string; fieldIds: string[]; choices?: string[] } // waits for the user; choices = two answer buttons
  | { type: "field"; field: FormField } // a field got filled
  | { type: "done"; summary: string; fields: FormField[] }; // finished

/** Where a field stands, for counting and display. */
export function fieldState(f: FormField): "filled" | "needs-you" | "empty" {
  if (f.value !== null && f.value !== "") return "filled";
  if (f.type === "signature" || f.type === "date") return "needs-you";
  return "empty";
}
