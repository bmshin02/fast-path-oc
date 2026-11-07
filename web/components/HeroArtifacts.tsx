import { Check } from "lucide-react";

// Small product cards floating around the hero headline, as on steep.app.
// Decorative only (the same content is in the product view below), so they're
// hidden from screen readers and only shown on wide screens.

const card =
  "absolute rounded-[20px] bg-background p-5 shadow-[0_12px_40px_rgba(23,25,28,0.08)] ring-1 ring-border motion-safe:animate-[rise_600ms_cubic-bezier(0.22,1,0.36,1)_both]";

export function HeroArtifacts() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden min-[1360px]:block">
      {/* Left, upper: a filled field */}
      <div className={`${card} top-20 left-4 w-[260px]`}>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">Property address</span>
          <span className="text-[13px] text-muted">From you</span>
        </div>
        <p className="mt-2 border-b border-border-strong pb-1.5 font-mono text-base">
          14 Sample Court
        </p>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-sm text-muted">School district</span>
          <span className="text-[13px] text-muted">Looked up</span>
        </div>
        <p className="mt-2 border-b border-border-strong pb-1.5 font-mono text-base">
          Irvine Unified
        </p>
      </div>

      {/* Right: the finished result, the page's one peach moment */}
      <div
        className={`${card} top-44 right-4 w-[260px] bg-peach ring-0 [animation-delay:120ms]`}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-sienna text-peach">
          <Check className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <p className="mt-4 text-lg leading-7 font-medium text-sienna">
          Done, I filled 14 of 16 fields
        </p>
        <p className="mt-1 text-[15px] leading-6 text-sienna">
          2 need your signature
        </p>
      </div>

      {/* Left, lower: a question and its answer */}
      <div className={`${card} bottom-8 left-20 w-[300px] [animation-delay:240ms]`}>
        <p className="text-base leading-6 text-foreground">
          How many square feet will the new unit be?
        </p>
        <p className="mt-3 ml-auto w-fit rounded-2xl rounded-br-md bg-primary-fill px-4 py-2 text-base text-on-primary">
          About 640
        </p>
      </div>
    </div>
  );
}
