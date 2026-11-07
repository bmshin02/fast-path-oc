"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type ChecklistItem = { name: string; status: "done" | "current" | "todo" };

function StatusIcon({ status }: { status: ChecklistItem["status"] }) {
  if (status === "done") {
    return (
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sienna text-peach">
        <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </span>
    );
  }
  if (status === "current") {
    return (
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full ring-2 ring-foreground">
        <span className="h-2.5 w-2.5 rounded-full bg-foreground" />
      </span>
    );
  }
  return <span className="h-6 w-6 shrink-0 rounded-full ring-2 ring-border-strong" />;
}

const statusWords = { done: "Done", current: "Working on now", todo: "Not started" };

function Rows({
  items,
  viewing,
  onSelect,
}: {
  items: ChecklistItem[];
  viewing: number;
  onSelect?: (index: number) => void;
}) {
  return (
    <ol className="space-y-1">
      {items.map((item, i) => {
        const clickable = Boolean(onSelect) && item.status === "done";
        const content = (
          <>
            <StatusIcon status={item.status} />
            <span className="min-w-0 flex-1">
              {/* Long names are cut with "…"; the full name is in the tooltip. */}
              <span className={`block truncate text-base ${item.status === "todo" ? "text-secondary" : "font-medium"}`}>
                {item.name}
              </span>
              <span className="block text-sm text-muted">{statusWords[item.status]}</span>
            </span>
          </>
        );
        const base = `flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left ${i === viewing ? "bg-mist" : ""}`;
        return (
          <li key={`${item.name}-${i}`} title={item.name}>
            {clickable ? (
              <button
                type="button"
                onClick={() => onSelect?.(i)}
                aria-current={i === viewing ? "true" : undefined}
                className={`${base} transition-colors duration-150 hover:bg-mist focus-visible:outline-2 focus-visible:outline-foreground`}
              >
                {content}
              </button>
            ) : (
              <div className={base} aria-current={item.status === "current" ? "step" : undefined}>
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Narrow column on the left of the chat: every uploaded form and its status. */
export function FileChecklist(props: {
  items: ChecklistItem[];
  viewing: number;
  onSelect?: (index: number) => void;
}) {
  const done = props.items.filter((i) => i.status === "done").length;
  return (
    <nav
      aria-label="Your forms"
      className="flex min-h-0 flex-col overflow-hidden rounded-[24px] bg-background ring-1 ring-border"
    >
      <div className="border-b border-border px-4 py-4">
        <h2 className="text-lg font-medium">Your forms</h2>
        <p className="text-base text-secondary">
          {done} of {props.items.length} done
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <Rows {...props} />
      </div>
    </nav>
  );
}

/** Phones: the same checklist folded into one line at the top. */
export function FileChecklistCompact(props: {
  items: ChecklistItem[];
  viewing: number;
  onSelect?: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const position = props.items.findIndex((i) => i.status === "current");
  const shown = position >= 0 ? position : props.viewing;
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-base font-medium">
            Form {shown + 1} of {props.items.length}
          </span>
          <span className="block truncate text-sm text-muted">{props.items[shown]?.name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-base text-secondary">
          {open ? "Hide" : "All forms"}
          <ChevronDown className={`h-5 w-5 transition-transform duration-150 ${open ? "rotate-180" : ""}`} aria-hidden />
        </span>
      </button>
      {open && (
        <div className="max-h-[40dvh] overflow-y-auto border-t border-border p-2">
          <Rows {...props} />
        </div>
      )}
    </div>
  );
}
