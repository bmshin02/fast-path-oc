import { Check } from "lucide-react";
import { ChatBubble } from "@/components/fill/FillSessionView";
import { DocField } from "@/components/fill/FormDocument";
import { demoSummary } from "@/lib/fill/demo";

// Small product cards floating around the hero headline, as on steep.app.
// Each is a piece of the real fill page (the same components and wording).
// Decorative only (the same content is in the product view below), so they're
// hidden from screen readers and only shown on wide screens.

const card =
  "absolute rounded-[20px] bg-background p-5 shadow-[0_12px_40px_rgba(23,25,28,0.08)] ring-1 ring-border motion-safe:animate-[rise_600ms_cubic-bezier(0.22,1,0.36,1)_both]";

export function HeroArtifacts() {
  return (
    <div aria-hidden inert className="pointer-events-none absolute inset-0 hidden min-[1360px]:block">
      {/* Left, upper: two lines from the paper sheet */}
      <div className={`${card} top-20 left-4 flex w-[280px] flex-col gap-4`}>
        <DocField label="Project address" value="14 Sample Court, Irvine 92618" source="From you" />
        <DocField label="Current use" value="Single-family home" source="Looked up" />
      </div>

      {/* Right: the result page's "your form is ready" card, the one peach moment */}
      <div className={`${card} top-44 right-4 w-[280px] bg-peach ring-0 [animation-delay:120ms]`}>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-sienna text-peach">
          <Check className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <p className="mt-4 font-serif text-2xl leading-8 text-sienna">Your form is ready</p>
        <p className="mt-1 text-[15px] leading-6 text-sienna">{demoSummary}</p>
      </div>

      {/* Left, lower: a question and its answer, as chat bubbles */}
      <div className={`${card} bottom-8 left-20 flex w-[320px] flex-col gap-3 bg-fog [animation-delay:240ms]`}>
        <ChatBubble from="fast-track">About how many square feet will the new unit be?</ChatBubble>
        <ChatBubble from="you">About 640</ChatBubble>
      </div>
    </div>
  );
}
