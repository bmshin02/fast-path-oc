import Link from "next/link";
import { ArrowUpFromLine, FileText } from "lucide-react";
import { Disclaimer } from "@/components/Disclaimer";
import { FormPreview } from "@/components/FormPreview";
import { SiteHeader } from "@/components/SiteHeader";
import { sampleForms } from "@/lib/fill/forms";

const steps = [
  {
    title: "Upload the form",
    text: "A PDF from your city, or one of the forms below.",
  },
  {
    title: "Answer what only you know",
    text: "Fast Track looks up the rest from official sources and asks follow-ups when something is unclear.",
  },
  {
    title: "Check it and download",
    text: "See every filled field and where its answer came from, then download the PDF.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16 lg:pt-24 lg:pb-28">
          <div className="max-w-[600px]">
            <h1 className="text-[40px] leading-[1.06] font-semibold tracking-[-0.02em] sm:text-[52px] sm:tracking-[-0.03em]">
              Fill in housing permit forms by answering a few questions
            </h1>
            <p className="mt-6 max-w-[36rem] text-lg leading-7 text-secondary">
              Upload a city form, like Irvine&apos;s ADU application. Fast Track
              asks only what it can&apos;t look up, fills in the rest, and gives
              you back the PDF to check.
            </p>

            <Link
              href="/fill"
              className="group mt-10 flex items-center gap-4 rounded-xl border border-dashed border-muted/50 bg-surface p-5 transition-colors duration-150 hover:border-accent focus-visible:border-accent focus-visible:outline-none active:scale-[0.99]"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary-fill text-on-primary transition-colors duration-150 group-hover:bg-accent group-hover:text-on-accent">
                <ArrowUpFromLine className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <span>
                <span className="block font-medium">Upload a PDF form</span>
                <span className="mt-0.5 block text-sm text-muted">
                  Any California city housing form
                </span>
              </span>
            </Link>

            <Link
              href={`/fill?form=${sampleForms[0].id}`}
              className="mt-4 inline-flex rounded text-sm text-accent underline decoration-accent/40 underline-offset-4 transition-colors duration-150 hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Or try it on Irvine&apos;s ADU application
            </Link>
          </div>

          <FormPreview />
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16 lg:py-24">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.01em]">
                How it works
              </h2>
              <ol className="mt-8 space-y-6">
                {steps.map((step, i) => (
                  <li key={step.title} className="flex gap-4">
                    <span className="mt-px font-mono text-sm text-muted tabular-nums">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-medium">{step.title}</h3>
                      <p className="mt-1 text-[15px] leading-6 text-secondary">
                        {step.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.01em]">
                Forms ready to try
              </h2>
              <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-surface">
                {sampleForms.map((form) => (
                  <li key={form.id}>
                    <Link
                      href={`/fill?form=${form.id}`}
                      className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 first:rounded-t-xl last:rounded-b-xl hover:bg-raised focus-visible:bg-raised focus-visible:outline-none"
                    >
                      <FileText className="h-[18px] w-[18px] shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px]">
                          {form.title}
                        </span>
                        <span className="block text-[13px] text-muted">
                          {form.city}, {form.pages}{" "}
                          {form.pages === 1 ? "page" : "pages"}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] text-muted">
                        {form.fillable ? "Fills the original" : "Makes a new PDF"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-8">
        <Disclaimer />
      </footer>
    </div>
  );
}
