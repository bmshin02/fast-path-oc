// Server only. Checks Claude's field updates and merges them into the
// current fields. Claude never gets the last word on safety rules.

import type { PdfFieldInfo } from "../protocol";
import type { FormField } from "../types";
import type { TurnField } from "./prompt";

const SENSITIVE = /\b(ssn|social security|driver'?s? licen[cs]e|passport|tax ?id|itin|bank|routing|account number)\b/i;

export function mergeFields(
  current: FormField[],
  updates: TurnField[],
  opts: { curated: boolean; pdfFields?: PdfFieldInfo[] },
): { fields: FormField[]; changed: FormField[] } {
  const byId = new Map(current.map((f) => [f.id, { ...f }]));
  const knownBoxes = new Set([
    ...(opts.pdfFields ?? []).map((p) => p.name),
    ...current.flatMap((f) => [f.pdfField, ...(f.options ?? []).map((o) => o.pdfField)]).filter(Boolean),
  ] as string[]);
  const box = (name: string | null | undefined) => (name && knownBoxes.has(name) ? name : undefined);

  const changed: FormField[] = [];
  for (const u of updates) {
    if (!u.id) continue;
    const existing = byId.get(u.id);
    if (!existing && opts.curated) continue; // curated forms: only our boxes

    // Shape comes from the existing field when there is one, so Claude can't
    // re-point an answer at a different PDF box.
    const field: FormField = existing ?? {
      id: u.id,
      label: u.label || u.id,
      type: u.type,
      value: null,
      pdfField: box(u.pdfField),
      options: u.options?.map((o) => ({ label: o.label, pdfField: box(o.pdfField) })),
    };

    let value: FormField["value"] = u.value === null || u.value === "" ? null : u.value;
    if (field.type === "checkbox" && typeof value === "string") {
      value = /^(yes|true|checked|x)$/i.test(value.trim()) ? true : /^(no|false|unchecked)$/i.test(value.trim()) ? false : null;
    }
    if (field.type === "choice" && typeof value === "string" && field.options?.length) {
      const match = field.options.find((o) => o.label.toLowerCase() === String(value).toLowerCase());
      value = match ? match.label : value;
    }
    // Never fill signatures or sensitive numbers, whatever the reply says.
    if (field.type === "signature" || SENSITIVE.test(`${field.label} ${field.pdfField ?? ""}`)) value = null;

    field.value = value;
    field.source = value === null ? undefined : (u.source ?? "user");
    field.sourceUrl = u.sourceUrl ?? undefined;
    field.note = u.note ?? field.note;
    if (field.source === "research") {
      field.checkedOn = new Date().toISOString().slice(0, 10);
      if (!field.sourceUrl) field.note = field.note ?? "No source link was given. Please double-check this one.";
    }

    byId.set(field.id, field);
    changed.push({ ...field });
  }

  // Keep the original order, new fields at the end.
  const order = [...current.map((f) => f.id), ...[...byId.keys()].filter((id) => !current.some((f) => f.id === id))];
  return { fields: order.map((id) => byId.get(id)!), changed };
}
