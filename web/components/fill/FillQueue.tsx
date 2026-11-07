"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, PartyPopper } from "lucide-react";
import type { FormSource } from "@/lib/fill/types";
import { FileChecklist, FileChecklistCompact, type ChecklistItem } from "./FileChecklist";
import { ChatMessages, FillSessionView, type FillResult } from "./FillSessionView";
import { ResultPanel } from "./ResultPanel";

function nameOf(source: FormSource, multi: boolean) {
  if (source.kind === "upload") return source.file.name;
  return multi ? source.form.title : `${source.form.city}: ${source.form.title}`;
}

// Works through one or more forms in order. While a form is being filled,
// the chat shows; when it's done, its result shows with a button to start
// the next one. With several forms, a checklist on the left shows which are
// done, which one is being worked on, and which haven't started. Finished
// forms can be reopened from the checklist once the current one is done.
export function FillQueue({ sources, mock }: { sources: FormSource[]; mock: boolean }) {
  const multi = sources.length > 1;
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<(FillResult | null)[]>(() => sources.map(() => null));
  const [viewing, setViewing] = useState(0);

  const working = !results[current];
  const items: ChecklistItem[] = sources.map((s, i) => ({
    name: nameOf(s, multi),
    status: results[i] ? "done" : i === current ? "current" : "todo",
  }));
  const next = current + 1 < sources.length && working === false ? current + 1 : -1;
  const allDone = results.every(Boolean);

  // Reopening finished forms is only offered between forms, never mid-chat.
  const select = working ? undefined : (i: number) => {
    setViewing(i);
    window.scrollTo({ top: 0 });
  };
  const checklist = multi ? <FileChecklist items={items} viewing={working ? current : viewing} onSelect={select} /> : undefined;
  const checklistCompact = multi ? (
    <FileChecklistCompact items={items} viewing={working ? current : viewing} onSelect={select} />
  ) : undefined;

  if (working) {
    return (
      <FillSessionView
        key={current}
        source={sources[current]}
        mock={mock}
        checklist={checklist}
        checklistCompact={checklistCompact}
        onDone={(result) => {
          setResults((rs) => rs.map((r, i) => (i === current ? result : r)));
          setViewing(current);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  const result = results[viewing]!;
  return (
    <div
      className={`mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-5 px-4 py-8 sm:px-6 sm:py-10 ${
        multi ? "lg:grid-cols-[200px_minmax(0,1fr)]" : ""
      }`}
    >
      {checklist && <div className="hidden self-start lg:sticky lg:top-6 lg:flex lg:flex-col">{checklist}</div>}

      <div className="min-w-0">
        {checklistCompact && (
          <div className="mb-5 overflow-hidden rounded-[24px] bg-background ring-1 ring-border lg:hidden">
            {checklistCompact}
          </div>
        )}

        {multi && (next >= 0 || allDone) && (
          <div className="mb-6 flex flex-col gap-4 rounded-[24px] bg-background p-5 ring-1 ring-border sm:flex-row sm:items-center sm:p-6">
            {allDone ? (
              <>
                <PartyPopper className="h-7 w-7 shrink-0 text-sienna" strokeWidth={1.75} aria-hidden />
                <p className="flex-1 text-lg leading-7">
                  All {sources.length} forms are done. Choose any form in the list to see it again or download it.
                </p>
              </>
            ) : (
              <>
                <p className="min-w-0 flex-1 text-lg leading-7">
                  <span className="font-medium">
                    Form {current + 1} of {sources.length} is done.
                  </span>{" "}
                  <span className="text-secondary">Download it below, then start the next one.</span>
                  <span className="mt-1 block truncate text-base text-muted" title={items[next].name}>
                    Next: {items[next].name}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCurrent(next);
                    window.scrollTo({ top: 0 });
                  }}
                  className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-primary-fill px-7 text-lg font-medium text-on-primary transition-colors duration-150 hover:bg-[#2c2f34] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground active:scale-[0.98]"
                >
                  Start next form
                  <ArrowRight className="h-5 w-5" strokeWidth={2} aria-hidden />
                </button>
              </>
            )}
          </div>
        )}

        <ResultPanel key={viewing} source={sources[viewing]} fields={result.fields} summary={result.summary} mock={mock} />

        <details className="group mt-8 rounded-[24px] bg-background ring-1 ring-border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[24px] px-5 py-4 text-lg font-medium focus-visible:outline-2 focus-visible:outline-foreground">
            See the conversation
            <ChevronDown className="h-5 w-5 transition-transform duration-150 group-open:rotate-180" aria-hidden />
          </summary>
          <div className="relative flex flex-col gap-4 border-t border-border p-5 sm:p-7">
            <ChatMessages messages={result.messages} />
          </div>
        </details>
      </div>
    </div>
  );
}
