// What the landing page's product view shows: the scripted Irvine ADU demo
// partway through, as the third of three uploaded files' first form. Built
// from the same field list and question wording as the real demo
// (mock/irvine-adu.ts), so the picture matches what visitors will see.
// Made-up details only.

import type { ChatMessage } from "@/components/fill/FillSessionView";
import type { ChecklistItem } from "@/components/fill/FileChecklist";
import { irvineAduFields, irvineAduScript } from "./mock/irvine-adu";
import { summarizeFields } from "./summary";
import type { FormField } from "./types";

const assumption = "ASSUMPTION: you get mail at the property. Change this if not.";

type Value = { value: FormField["value"]; source?: FormField["source"]; note?: string };

const answered: Record<string, Value> = {
  "project-address": { value: "14 Sample Court, Irvine 92618" },
  "permit-residential": { value: true, source: "document" },
  "current-use": { value: "Single-family home", source: "research" },
  "applicant-name": { value: "Jordan Lee" },
  "print-name": { value: "Jordan Lee" },
  "owner-name": { value: "Jordan Lee" },
  "owner-address": { value: "14 Sample Court" },
  "owner-city": { value: "Irvine" },
  "owner-zip": { value: "92618" },
  "applicant-address": { value: "14 Sample Court", note: assumption },
  "applicant-city": { value: "Irvine", note: assumption },
  "applicant-zip": { value: "92618", note: assumption },
  "applicant-phone": { value: "949-555-0123" },
  "applicant-email": { value: "jordan@example.com" },
  "includes-adu": { value: "Yes", source: "document" },
  "adu-type": { value: "Detached" },
  "scope-adu": { value: true, source: "document" },
  "adu-sqft": { value: "640" },
};

function apply(values: Record<string, Value>): FormField[] {
  return irvineAduFields().map((f) => {
    const v = values[f.id];
    return v ? { ...f, value: v.value, source: v.source ?? "user", note: v.note ?? f.note } : f;
  });
}

export const demoFields = apply(answered);
export const demoRecentId = "adu-sqft";

const script = irvineAduScript();
const ask = (id: string) => {
  const step = script.steps.find((s) => s.id === id)!;
  return step.ask({ get: () => null, answers: {} });
};

const lines: [ChatMessage["from"], string][] = [
  ["fast-track", script.intro],
  ["fast-track", ask("address")],
  ["you", "14 Sample Court, Irvine 92618"],
  ["fast-track", ask("name")],
  ["you", "Jordan Lee"],
  ["fast-track", ask("owner")],
  ["you", "Yes"],
  ["fast-track", ask("phone")],
  ["you", "949-555-0123"],
  ["fast-track", ask("email")],
  ["you", "jordan@example.com"],
  ["fast-track", ask("adu-type")],
  ["you", "Separate, in the backyard"],
  ["fast-track", ask("sqft")],
  ["you", "About 640"],
  ["fast-track", ask("stories")],
];
export const demoMessages: ChatMessage[] = lines.map(([from, text], id) => ({ id, from, text }));

/** The question on screen offers these two buttons. */
export const demoChoices = script.steps.find((s) => s.id === "stories")!.choices!;

export const demoFiles: ChecklistItem[] = [
  { name: "owner-builder-declaration.pdf", status: "done" },
  { name: "irvine-adu-application-package.pdf", status: "current" },
  { name: "hold-harmless-affidavit.docx", status: "todo" },
];
export const demoCurrent = 1;

/** The finished form's "Done, I filled…" sentence, as the result page words it. */
export const demoSummary = summarizeFields(
  apply({
    ...answered,
    stories: { value: "1" },
    solar: { value: "No" },
    description: { value: "New detached accessory dwelling unit (ADU), 640 sq ft, 1 story" },
    "proposed-use": { value: "Single-family home with ADU" },
  }),
).replace(/ Please check the preview below, then download your form\.$/, "");
