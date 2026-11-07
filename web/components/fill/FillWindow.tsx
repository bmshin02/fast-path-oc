import type { ReactNode } from "react";
import { FileText } from "lucide-react";

// The questions page frame, shared by the real fill page and the landing
// page's product view so the two always look the same:
//
//   ┌ form name ─────────────────────────────── N of M fields filled ┐
//   │ your forms │ conversation        │ the form filling in          │
//   │ (several   │ …                   │                              │
//   │  files)    │ answer box          │                              │
//   └────────────┴─────────────────────┴──────────────────────────────┘
//
// Narrower screens drop the "your forms" column for `compactBar`; on the real
// page the form folds into `foldBar` above the chat (`docOnSmall = "fold"`),
// while the landing page stacks it under the chat (`"stack"`).
export function FillWindow({
  title,
  count,
  badge,
  sidebar,
  compactBar,
  foldBar,
  log,
  composer,
  document,
  docOnSmall = "fold",
  className = "",
}: {
  title: string;
  count: string;
  badge?: ReactNode;
  sidebar?: ReactNode;
  compactBar?: ReactNode;
  foldBar?: ReactNode;
  log: ReactNode;
  composer: ReactNode;
  document: ReactNode;
  docOnSmall?: "fold" | "stack";
  className?: string;
}) {
  const cols = sidebar
    ? "lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_400px_minmax(0,1fr)]"
    : "lg:grid-cols-[400px_minmax(0,1fr)]";
  // Where the form panel beside the chat appears.
  const docShown = sidebar ? "xl:block" : "lg:block";
  const stack = docOnSmall === "stack";

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-border bg-background shadow-[0_24px_64px_rgba(23,25,28,0.08)] ${className}`}
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-5">
        <FileText className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
        <p className="min-w-0 truncate text-base font-medium">{title}</p>
        {badge}
        <p className="ml-auto hidden shrink-0 text-[15px] text-muted sm:block" aria-live="polite">
          {count}
        </p>
      </div>

      <div
        className={`grid min-h-0 flex-1 grid-cols-1 ${stack ? (sidebar ? "xl:grid-rows-1" : "lg:grid-rows-1") : "grid-rows-1"} ${cols}`}
      >
        {sidebar && <div className="hidden min-h-0 flex-col border-r border-border lg:flex">{sidebar}</div>}

        <section
          aria-label="Conversation with Fast Track"
          className={`flex min-h-0 flex-col bg-fog ${sidebar ? "xl:border-r" : "lg:border-r"} border-border`}
        >
          {compactBar && <div className="border-b border-border bg-background lg:hidden">{compactBar}</div>}
          {foldBar && !stack && (
            <div className={`border-b border-border bg-background ${sidebar ? "xl:hidden" : "lg:hidden"}`}>{foldBar}</div>
          )}
          {log}
          {composer}
        </section>

        <div
          data-scroll
          aria-label="Your form"
          role="region"
          className={`relative min-h-0 overflow-y-auto bg-mist p-4 sm:p-8 ${
            stack
              ? `max-h-[560px] border-t border-border ${sidebar ? "lg:col-span-2 xl:col-span-1 xl:max-h-none xl:border-t-0" : "lg:max-h-none lg:border-t-0"}`
              : `hidden ${docShown}`
          }`}
        >
          {document}
        </div>
      </div>
    </div>
  );
}
