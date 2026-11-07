import type { FormField } from "@/lib/fill/types";
import { fieldState } from "@/lib/fill/types";

const sourceLabel: Record<NonNullable<FormField["source"]>, string> = {
  user: "From you",
  research: "Looked up",
  document: "From the form",
};

function display(f: FormField): string {
  if (f.value === true) return "Yes";
  if (f.value === false) return "No";
  return String(f.value);
}

// Every field on the form with its value and where the value came from.
// `finished` changes the wording of fields that were never filled.
export function FieldList({
  fields,
  recentId,
  finished = false,
}: {
  fields: FormField[];
  recentId?: string | null;
  finished?: boolean;
}) {
  return (
    <ul className="divide-y divide-border">
      {fields.map((f) => {
        const state = fieldState(f);
        const assumption = f.note?.startsWith("ASSUMPTION");
        return (
          <li
            key={f.id}
            className={`px-5 py-3.5 transition-colors duration-500 ${
              f.id === recentId ? "bg-peach" : ""
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] leading-6 text-muted">{f.label}</span>
              {state === "filled" && f.source && (
                <span className="shrink-0 text-sm text-muted">
                  {sourceLabel[f.source]}
                </span>
              )}
            </div>
            {state === "filled" ? (
              <p className="mt-0.5 font-mono text-[17px] leading-7 break-words text-foreground">
                {display(f)}
              </p>
            ) : state === "needs-you" ? (
              <p className="mt-0.5 text-[17px] leading-7 font-medium text-sienna">
                Needs you
              </p>
            ) : (
              <p className="mt-0.5 text-[17px] leading-7 text-muted">
                {finished ? "Left empty" : "Not filled yet"}
              </p>
            )}
            {f.note && (state !== "empty" || finished) && (
              <p
                className={`mt-1 text-[15px] leading-6 ${
                  assumption ? "text-sienna" : "text-secondary"
                }`}
              >
                {f.note}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
