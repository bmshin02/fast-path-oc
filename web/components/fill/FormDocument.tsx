"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import type { FormField } from "@/lib/fill/types";
import { fieldState } from "@/lib/fill/types";

// The form drawn as a paper sheet, filling in while Fast Track works. The same
// pieces draw the landing page's product view, so both look alike.

export type DocSource = "From you" | "Looked up" | "From the form" | "Needs you";

/** One labelled line on the sheet. An empty value draws a blank line. */
export function DocField({
  label,
  value,
  source,
  sourceUrl,
  note,
  justFilled = false,
  className = "",
}: {
  label: string;
  value?: string;
  source?: DocSource;
  sourceUrl?: string;
  note?: string;
  justFilled?: boolean;
  className?: string;
}) {
  const needsYou = source === "Needs you";
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-sm text-muted">{label}</span>
        {source &&
          (sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[13px] text-muted underline underline-offset-2 hover:text-foreground"
            >
              {source}
            </a>
          ) : (
            <span className={`shrink-0 text-[13px] ${needsYou ? "font-medium text-sienna" : "text-muted"}`}>
              {source}
            </span>
          ))}
      </div>
      <div
        className={`mt-1 flex min-h-10 items-end border-b pb-1.5 font-mono text-base break-words transition-colors duration-700 ${
          needsYou ? "border-dashed border-sienna/50" : value ? "border-border-strong" : "border-dashed border-border-strong"
        } ${justFilled ? "-mx-2 rounded-t-lg bg-peach px-2 text-sienna" : "text-foreground"}`}
      >
        <span className="min-w-0">{value}</span>
      </div>
      {note && <p className="mt-1 text-sm leading-5 text-sienna">{note}</p>}
    </div>
  );
}

/** A tick box with its printed label. */
export function DocBox({ label, checked }: { label: string; checked: boolean }) {
  return (
    <span className="flex items-center gap-2 text-[15px] text-foreground">
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border transition-colors duration-300 ${
          checked ? "border-foreground bg-foreground text-on-primary" : "border-border-strong"
        }`}
        aria-hidden
      >
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
      </span>
      <span className="sr-only">{checked ? "Checked: " : "Not checked: "}</span>
      {label}
    </span>
  );
}

/** The white sheet with the form's heading. */
export function DocSheet({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[16px] bg-background p-5 shadow-[0_1px_2px_rgba(23,25,28,0.06)] ring-1 ring-border sm:p-7">
      <div className="border-b border-border pb-4">
        <p className="text-sm text-muted">{kicker}</p>
        <p className="mt-1 text-lg leading-7 font-semibold break-words">{title}</p>
      </div>
      {children}
    </div>
  );
}

const sourceWords: Record<NonNullable<FormField["source"]>, DocSource> = {
  user: "From you",
  research: "Looked up",
  document: "From the form",
};

function textOf(f: FormField) {
  if (f.value === true) return "Yes";
  if (f.value === false) return "No";
  return f.value ?? "";
}

// Short fields sit two to a row. A field takes the whole row when it is long,
// is a set of tick boxes, or has no short neighbour to pair with, so the sheet
// keeps the form's order and never leaves a hole.
function widths(fields: FormField[]): boolean[] {
  const long = fields.map(
    (f) =>
      f.type === "choice" ||
      f.type === "checkbox" ||
      f.type === "signature" ||
      f.label.length > 30 ||
      String(textOf(f)).length > 22 ||
      Boolean(f.note?.startsWith("ASSUMPTION")),
  );
  const wide = [...long];
  for (let i = 0; i < fields.length; i++) {
    if (long[i]) continue;
    if (i + 1 < fields.length && !long[i + 1]) {
      i++; // pair i and i+1
    } else {
      wide[i] = true;
    }
  }
  return wide;
}

/**
 * The live form. `recentId` is highlighted and scrolled into view inside the
 * nearest scrolling box (never the page).
 */
export function FormDocument({
  kicker,
  title,
  fields,
  recentId,
}: {
  kicker: string;
  title: string;
  fields: FormField[];
  recentId?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const wide = widths(fields);

  useEffect(() => {
    if (!recentId) return;
    const el = ref.current?.querySelector<HTMLElement>(`[data-field="${CSS.escape(recentId)}"]`);
    const box = el?.closest<HTMLElement>("[data-scroll]");
    if (!el || !box) return;
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    const target = top - box.clientHeight / 3;
    box.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [recentId]);

  return (
    <DocSheet kicker={kicker} title={title}>
      {fields.length === 0 ? (
        <p className="mt-5 text-base leading-6 text-muted">The boxes on your form will show here as Fast Track finds them.</p>
      ) : (
        <div ref={ref} className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          {fields.map((f, i) => {
            const span = wide[i] ? "sm:col-span-2" : "";
            const state = fieldState(f);
            const recent = f.id === recentId;

            if (f.type === "choice" && f.options?.length) {
              return (
                <div key={f.id} data-field={f.id} className={`${span} ${recent ? "-mx-2 rounded-lg bg-peach px-2 py-1" : ""}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-muted">{f.label}</span>
                    {state === "filled" && f.source && (
                      <span className="shrink-0 text-[13px] text-muted">{sourceWords[f.source]}</span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                    {f.options.map((o) => (
                      <DocBox key={o.label} label={o.label} checked={f.value === o.label} />
                    ))}
                  </div>
                </div>
              );
            }

            if (f.type === "checkbox") {
              return (
                <div key={f.id} data-field={f.id} className={`${span} ${recent ? "-mx-2 rounded-lg bg-peach px-2 py-1" : ""}`}>
                  <div className="flex items-center justify-between gap-3 py-2">
                    <DocBox label={f.label} checked={f.value === true} />
                    {state === "filled" && f.source && (
                      <span className="shrink-0 text-[13px] text-muted">{sourceWords[f.source]}</span>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={f.id} data-field={f.id} className={span}>
                <DocField
                  label={f.label}
                  value={state === "filled" ? String(textOf(f)) : undefined}
                  source={state === "filled" && f.source ? sourceWords[f.source] : state === "needs-you" ? "Needs you" : undefined}
                  sourceUrl={state === "filled" && f.source === "research" ? f.sourceUrl : undefined}
                  note={
                    (state === "filled" && f.note?.startsWith("ASSUMPTION")) || state === "needs-you" ? f.note : undefined
                  }
                  justFilled={recent}
                />
              </div>
            );
          })}
        </div>
      )}
    </DocSheet>
  );
}
