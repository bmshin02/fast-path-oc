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
  label: string; // as printed on the form
  type: "text" | "number" | "date" | "checkbox" | "signature";
  value: string | boolean | null; // null = not filled yet
  source?: "user" | "research" | "document";
  sourceUrl?: string; // required when source = "research"
  checkedOn?: string; // date for researched values
  note?: string; // e.g. "ASSUMPTION", "needs a wet signature"
};

/** One streamed event from POST /api/fill. */
export type FillEvent =
  | { type: "status"; text: string }
  | { type: "question"; text: string; fieldIds: string[] }
  | { type: "field"; field: FormField }
  | { type: "done"; summary: string; fields: FormField[] };
