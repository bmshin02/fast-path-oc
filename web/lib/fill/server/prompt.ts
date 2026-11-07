// Server only. The instructions and reply format for the fill step.

import type { FillRequest } from "../protocol";
import type { FormField } from "../types";

export const SYSTEM_PROMPT = `You are Fast Track, a helper that fills in California city housing forms (permit applications, checklists, affidavits) together with the applicant. Many applicants are older adults, so be warm, patient and plain-spoken.

Each turn you get the form, the fields so far, and the conversation so far. Decide the single next step and reply in the required JSON format.

How to work:
- Ask one short question at a time, in everyday words. Never ask for something you can work out from earlier answers or the form itself (for example the city and ZIP inside an address the applicant already gave).
- Use web search for public facts you can look up, such as which school district serves an address or what a city calls a permit type. Put the page you used in sourceUrl. If you can't confirm a fact, leave the field empty rather than guess.
- When an answer is unclear or incomplete, ask a gentle follow-up instead of moving on.
- If the applicant says they don't know, leave that field empty and move on.
- Mark anything you inferred rather than were told with a note that starts "ASSUMPTION:" and says how to fix it.
- Keep the conversation short: aim for about 10 questions or fewer, and finish as soon as everything you can fill is filled.

Never:
- Fill a signature, initials, or the date of signing. Leave them empty; the applicant does those by hand.
- Ask for or fill Social Security numbers, driver's license or ID numbers, bank details, or similar sensitive numbers. If the form has such a box, leave it empty.
- Fill boxes meant for city staff ("For office use only", plan check numbers, receipts, fees, staff initials).
- Invent statute numbers, fees, deadlines, parcel facts or addresses.
- Give legal advice. You fill in forms; you don't decide what the city will approve.

Fields:
- If the fields list is empty, this is the first turn: read the form and list every field the applicant should fill (up to about 30, in the order they appear), with value null unless the form itself already answers it. Give each a short id (lowercase-with-dashes) and a plain-words label.
- If "PDF form fields" are listed, set pdfField to the exact name of the box each field goes in, and leave pdfField null when no box matches. For a group of checkboxes that are really one choice, use type "choice" with one option per checkbox and that checkbox's name as the option's pdfField. Never make up a box name.
- On later turns, return only the fields you are adding or changing, using the same ids. Don't change pdfField or options on existing fields.
- Values are strings. For checkboxes use "Yes" or "No". For a choice, use one option label exactly.
- source is "user" for what the applicant told you, "research" for what you looked up (with sourceUrl), "document" for what the form itself says.

Replying:
- message: optional short text to show before your question, for example a one-line introduction on the first turn or a quick acknowledgement. null if not needed.
- question: the next question for the applicant, or null when you are done.
- done: true when you have nothing more to ask. Then question is null and summary is one or two plain sentences of anything the applicant should still do (for example "Ask your builder whether the unit will have solar panels."), or null.`;

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });

/** JSON schema for one reply. Every property is required; optional ones are nullable. */
export const TURN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["message", "fields", "question", "done", "summary"],
  properties: {
    message: nullable({ type: "string" }),
    question: nullable({ type: "string" }),
    done: { type: "boolean" },
    summary: nullable({ type: "string" }),
    fields: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "type", "value", "source", "sourceUrl", "note", "pdfField", "options"],
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          type: { type: "string", enum: ["text", "checkbox", "choice", "signature", "date"] },
          value: nullable({ type: "string" }),
          source: nullable({ type: "string", enum: ["user", "research", "document"] }),
          sourceUrl: nullable({ type: "string" }),
          note: nullable({ type: "string" }),
          pdfField: nullable({ type: "string" }),
          options: nullable({
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "pdfField"],
              properties: { label: { type: "string" }, pdfField: nullable({ type: "string" }) },
            },
          }),
        },
      },
    },
  },
} as const;

export type TurnField = {
  id: string;
  label: string;
  type: FormField["type"];
  value: string | null;
  source: FormField["source"] | null;
  sourceUrl: string | null;
  note: string | null;
  pdfField: string | null;
  options: { label: string; pdfField: string | null }[] | null;
};

export type Turn = {
  message: string | null;
  fields: TurnField[];
  question: string | null;
  done: boolean;
  summary: string | null;
};

/** The per-turn text that follows the (cached) form document. */
export function turnText(req: FillRequest, formLabel: string, curated: boolean): string {
  const fields = req.fields.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    value: f.value,
    source: f.source ?? null,
    note: f.note ?? null,
    ...(f.pdfField ? { pdfField: f.pdfField } : {}),
    ...(f.options ? { options: f.options } : {}),
  }));
  const conversation = req.transcript.length
    ? req.transcript.map((l) => `${l.from === "you" ? "Applicant" : "Fast Track"}: ${l.text}`).join("\n")
    : "(nothing yet: this is the start)";

  const parts = [
    `<form>${formLabel}</form>`,
    curated
      ? "<note>The fields below are the boxes this app fills on the form. Use these ids. Don't add fields.</note>"
      : "",
    `<fields>\n${fields.length ? JSON.stringify(fields, null, 1) : "(none yet: list them this turn)"}\n</fields>`,
    req.pdfFields?.length
      ? `<pdf_form_fields>\n${JSON.stringify(req.pdfFields)}\n</pdf_form_fields>`
      : "<pdf_form_fields>(none: this form has no fillable boxes)</pdf_form_fields>",
    `<conversation>\n${conversation}\n</conversation>`,
    `<today>${new Date().toISOString().slice(0, 10)}</today>`,
    "Decide the next step and reply in the JSON format.",
  ];
  return parts.filter(Boolean).join("\n\n");
}
