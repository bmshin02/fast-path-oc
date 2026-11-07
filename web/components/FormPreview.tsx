// Landing page hero visual: a sample Irvine ADU application partly filled in,
// with the question that produced the latest answer. Demo data only.

type Source = "You" | "Looked up" | "Needs you";

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
        <span className="text-xs text-paper-muted">{label}</span>
        <span
          className={`text-[11px] ${
            empty ? "font-medium text-[#a1460f]" : "text-paper-muted"
          }`}
        >
          {source}
        </span>
      </div>
      <div
        className={`mt-1 flex min-h-8 items-end border-b pb-1 font-mono text-sm ${
          empty ? "border-dashed border-[#c2865f]" : "border-paper-line"
        } ${justFilled ? "-mx-1.5 rounded-t bg-[#e6ecfa] px-1.5" : ""}`}
      >
        <span className="text-ink">{value}</span>
      </div>
    </div>
  );
}

function Box({ label, checked }: { label: string; checked: boolean }) {
  return (
    <span className="flex items-center gap-2 text-[13px] text-paper-text">
      <span
        className={`grid h-4 w-4 place-items-center rounded-[3px] border ${
          checked ? "border-ink text-ink" : "border-paper-line"
        }`}
        aria-hidden
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6.25l2.25 2.25 4.75-5" />
          </svg>
        )}
      </span>
      <span className="sr-only">{checked ? "Checked: " : "Not checked: "}</span>
      {label}
    </span>
  );
}

export function FormPreview() {
  return (
    <figure className="relative mx-auto w-full max-w-[520px] lg:mr-0 lg:mb-20">
      <div className="rounded bg-paper p-6 pb-10 text-paper-text shadow-[0_1px_2px_rgba(0,0,0,0.05),0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-black/5 motion-safe:animate-[rise_500ms_cubic-bezier(0.22,1,0.36,1)_both] sm:p-8 sm:pb-10">
        <div className="flex items-start justify-between gap-4 border-b border-paper-line pb-4">
          <div>
            <p className="text-xs text-paper-muted">
              City of Irvine, Community Development
            </p>
            <p className="mt-1 text-[15px] font-semibold">
              Accessory dwelling unit application
            </p>
          </div>
          <span className="shrink-0 rounded border border-paper-line px-1.5 py-0.5 text-[11px] text-paper-muted">
            Sample
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Property owner name" value="Jordan Lee" source="You" />
          <Field className="hidden sm:block" label="Number of units" value="1" source="You" />
          <Field
            className="sm:col-span-2"
            label="Property address"
            value="14 Sample Court, Irvine, CA 92618"
            source="You"
          />
          <Field
            className="hidden sm:col-span-2 sm:block"
            label="Description of work"
            value="New detached ADU, 1 bedroom, 1 bath"
            source="You"
          />

          <div className="hidden sm:col-span-2 sm:block">
            <span className="text-xs text-paper-muted">Type of work</span>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              <Box label="Accessory dwelling unit" checked />
              <Box label="Alteration" checked={false} />
              <Box label="Expansion" checked={false} />
            </div>
          </div>

          <Field label="School district" value="Irvine Unified" source="Looked up" />
          <Field label="Gross floor area" value="640 sq ft" source="You" justFilled />
          <Field
            className="sm:col-span-2"
            label="Applicant signature"
            source="Needs you"
          />
        </div>
      </div>

      <div className="relative z-10 mx-4 -mt-6 rounded-xl border border-border bg-surface p-4 shadow-[0_8px_24px_rgba(0,0,0,0.08)] motion-safe:animate-[rise_500ms_cubic-bezier(0.22,1,0.36,1)_150ms_both] sm:mx-8 lg:absolute lg:top-[calc(100%-24px)] lg:-left-12 lg:mx-0 lg:mt-0 lg:w-[300px]">
        <p className="text-[13px] leading-5 text-secondary">
          How many square feet will the new unit be?
        </p>
        <p className="mt-3 ml-auto w-fit rounded-lg bg-raised px-3 py-1.5 text-[13px] text-foreground">
          About 640
        </p>
      </div>

      <figcaption className="sr-only">
        A sample Irvine ADU application with most fields filled in from the
        user&apos;s answers and public records. The signature line is left for
        the applicant.
      </figcaption>
    </figure>
  );
}
