// The "Done, I filled X of Y fields…" sentence, computed from the fields
// themselves so the numbers are always right.

import type { FormField } from "./types";
import { fieldState } from "./types";

export function summarizeFields(fields: FormField[], extra?: string | null): string {
  const filled = fields.filter((f) => fieldState(f) === "filled").length;
  const needsYou = fields.filter((f) => fieldState(f) === "needs-you");
  const empty = fields.filter((f) => fieldState(f) === "empty");

  const needText = needsYou.length
    ? ` ${needsYou.length === 1 ? "One needs" : `${needsYou.length} need`} you: ${needsYou
        .map((f) => f.label.toLowerCase())
        .join(" and ")}.`
    : "";
  const emptyText = empty.length
    ? ` I left ${empty.length === 1 ? "one box" : `${empty.length} boxes`} empty: ${empty
        .map((f) => f.label.toLowerCase())
        .join(", ")}.`
    : "";
  const extraText = extra?.trim() ? ` ${extra.trim()}` : "";

  return `Done, I filled ${filled} of ${fields.length} fields.${needText}${emptyText}${extraText} Please check the preview below, then download your form.`;
}
