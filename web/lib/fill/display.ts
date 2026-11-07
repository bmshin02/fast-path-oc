// Small wording helpers shared by the fill page and the landing page's
// product view (plain functions, so server and client code can both use them).

import type { FormSource } from "./types";

export function formName(source: FormSource) {
  return source.kind === "sample" ? `${source.form.city}: ${source.form.title}` : source.file.name;
}

/** The small line and heading at the top of the paper sheet. */
export function sheetHeading(source: FormSource) {
  return source.kind === "sample"
    ? { kicker: `City of ${source.form.city}`, title: source.form.title }
    : { kicker: "Your uploaded form", title: source.file.name };
}

export function filledCount(filled: number, total: number) {
  return `${filled} of ${total} ${total === 1 ? "field" : "fields"} filled`;
}
