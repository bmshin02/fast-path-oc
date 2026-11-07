import { ArrowUp, Check } from "lucide-react";

// Landing page product view: the questions page as it will look, with a
// sample Irvine ADU application filling in next to the conversation.
// Demo data only. This is an illustration, so nothing in it is interactive.

type Source = "From you" | "Looked up" | "Needs you";

function Field({
  label,
  value,
  source,
  justFilled = false,
  className = "",
}: {
  label: string;
  value?: string;
  source: Source;
  justFilled?: boolean;
  className?: string;
}) {
  const empty = !value;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">{label}</span>
        <span
          className={`text-[13px] ${
            empty ? "font-medium text-sienna" : "text-muted"
          }`}
        >
          {source}
        </span>
      </div>
      <div
        className={`mt-1 flex min-h-10 items-end border-b pb-1.5 font-mono text-base ${
          empty ? "border-dashed border-sienna/50" : "border-border-strong"
        } ${justFilled ? "-mx-2 rounded-t-lg bg-peach px-2 text-sienna" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

function Box({ label, checked }: { label: string; checked: boolean }) {
  return (
    <span className="flex items-center gap-2 text-[15px] text-foreground">
      <span
        className={`grid h-5 w-5 place-items-center rounded-[5px] border ${
          checked
            ? "border-foreground bg-foreground text-on-primary"
            : "border-border-strong"
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

function Bubble({
  from,
  children,
}: {
  from: "fast-track" | "you";
  children: React.ReactNode;
}) {
  return from === "you" ? (
    <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary-fill px-4 py-2.5 text-base leading-6 text-on-primary">
      {children}
    </p>
  ) : (
    <p className="w-fit max-w-[92%] rounded-2xl rounded-bl-md bg-background px-4 py-2.5 text-base leading-6 text-foreground ring-1 ring-border">
      {children}
    </p>
  );
}

export function FormPreview() {
  return (
    <figure className="overflow-hidden rounded-[24px] border border-border bg-background shadow-[0_24px_64px_rgba(23,25,28,0.08)]">
      <div className="flex h-14 items-center gap-4 border-b border-border px-5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-mist ring-1 ring-border" />
          <span className="h-3 w-3 rounded-full bg-mist ring-1 ring-border" />
          <span className="h-3 w-3 rounded-full bg-mist ring-1 ring-border" />
        </span>
        <span className="text-base font-medium">Irvine ADU application</span>
        <span className="ml-auto hidden text-[15px] text-muted sm:inline">
          14 of 16 fields filled
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Conversation */}
        <div className="flex flex-col gap-3 border-b border-border bg-fog p-5 sm:p-6 lg:border-r lg:border-b-0">
          <Bubble from="fast-track">
            I read your form. It has 16 fields, and I can look up 9 of them
            myself. I only need a few answers from you.
          </Bubble>
          <Bubble from="fast-track">
            Will the new unit be attached to your house, or separate?
          </Bubble>
          <Bubble from="you">Separate, in the backyard</Bubble>
          <Bubble from="fast-track">How many square feet will it be?</Bubble>
          <Bubble from="you">About 640</Bubble>
          <p className="flex items-center gap-2 px-1 pt-1 text-[15px] text-secondary">
            <Check className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Looked up the school district for your address
          </p>

          <div
            className="mt-auto flex items-center gap-3 rounded-2xl bg-background px-4 py-3 ring-1 ring-border-strong lg:mt-6"
            aria-hidden
          >
            <span className="flex-1 text-base text-muted">Type your answer</span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-fill text-on-primary">
              <ArrowUp className="h-4 w-4" strokeWidth={2} />
            </span>
          </div>
        </div>

        {/* The form filling in */}
        <div className="bg-mist p-4 sm:p-8">
          <div className="rounded-[16px] bg-background p-5 shadow-[0_1px_2px_rgba(23,25,28,0.06)] ring-1 ring-border sm:p-7">
            <div className="border-b border-border pb-4">
              <p className="text-sm text-muted">
                City of Irvine, Community Development
              </p>
              <p className="mt-1 text-lg font-semibold">
                Accessory dwelling unit application
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <Field label="Property owner name" value="Jordan Lee" source="From you" />
              <Field className="hidden sm:block" label="Number of units" value="1" source="From you" />
              <Field
                className="sm:col-span-2"
                label="Property address"
                value="14 Sample Court, Irvine, CA 92618"
                source="From you"
              />
              <div className="hidden sm:col-span-2 sm:block">
                <span className="text-sm text-muted">Type of work</span>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                  <Box label="Accessory dwelling unit" checked />
                  <Box label="Alteration" checked={false} />
                  <Box label="Expansion" checked={false} />
                </div>
              </div>
              <Field label="School district" value="Irvine Unified" source="Looked up" />
              <Field label="Gross floor area" value="640 sq ft" source="From you" justFilled />
              <Field
                className="sm:col-span-2"
                label="Applicant signature"
                source="Needs you"
              />
            </div>
          </div>
        </div>
      </div>

      <figcaption className="sr-only">
        A preview of Fast Track: on one side, a short conversation where Fast
        Track asks about the new unit; on the other, the Irvine ADU
        application filling in from the answers. The signature is left for
        the applicant.
      </figcaption>
    </figure>
  );
}
