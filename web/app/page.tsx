import Link from "next/link";
import { ArrowUpFromLine } from "lucide-react";
import { Disclaimer } from "@/components/Disclaimer";
import { FormPreview } from "@/components/FormPreview";
import { HeroArtifacts } from "@/components/HeroArtifacts";
import { SampleFormList } from "@/components/SampleFormList";
import { SiteHeader } from "@/components/SiteHeader";
import { sampleForms } from "@/lib/fill/forms";

const steps = [
  {
    title: "Upload your form",
    text: "Add a housing form from your city as a PDF or Word document, or pick one of ours below.",
  },
  {
    title: "Answer a few questions",
    text: "Fast Track looks up what it can and only asks you what it can't find. If something is unclear, it asks a follow-up.",
  },
  {
    title: "Check it and download",
    text: "See every filled field and where each answer came from, then download your filled form.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(60%_55%_at_50%_45%,#fde8da_0%,#fdf1ea_45%,rgba(255,255,255,0)_75%)]"
          />
          <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6">
            <HeroArtifacts />
            <div className="relative mx-auto flex max-w-[860px] flex-col items-center pt-16 pb-20 text-center sm:pt-28 sm:pb-32">
              <h1 className="font-serif text-[52px] leading-[1.08] font-normal tracking-[-0.02em] sm:text-[72px] sm:tracking-[-0.025em]">
                Welcome to Fast Track
              </h1>
              <p className="mt-6 max-w-[40rem] text-[22px] leading-[1.5] text-secondary sm:text-2xl">
                A way to speed up your housing project by 2x. Upload your
                housing form, answer a few questions, and get it back filled
                in.
              </p>

              <div className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
                <Link
                  href="/fill"
                  className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-primary-fill px-8 text-lg font-medium text-on-primary transition-colors duration-150 hover:bg-[#2c2f34] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground active:scale-[0.98] sm:w-auto"
                >
                  <ArrowUpFromLine className="h-5 w-5" strokeWidth={2} aria-hidden />
                  Upload a document
                </Link>
                <Link
                  href={`/fill?form=${sampleForms[0].id}`}
                  className="inline-flex h-14 w-full items-center justify-center rounded-full border border-foreground/80 px-8 text-lg font-medium text-foreground transition-colors duration-150 hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground active:scale-[0.98] sm:w-auto"
                >
                  Try a sample form
                </Link>
              </div>
              <p className="mt-5 text-base text-muted">
                Works with PDF and Word forms from California cities
              </p>
            </div>
          </div>
        </section>

        {/* Product view */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="mx-auto max-w-[1200px]">
            <FormPreview />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 bg-fog px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="font-serif text-[40px] leading-[1.15] font-normal tracking-[-0.015em] sm:text-[52px]">
              How it works
            </h2>
            <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
              {steps.map((step, i) => (
                <li
                  key={step.title}
                  className="rounded-[24px] bg-background p-7 ring-1 ring-border"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-mist text-lg font-medium tabular-nums">
                    {i + 1}
                  </span>
                  <h3 className="mt-5 text-[22px] leading-7 font-medium">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-lg leading-7 text-secondary">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Forms */}
        <section id="forms" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="font-serif text-[40px] leading-[1.15] font-normal tracking-[-0.015em] sm:text-[52px]">
              Forms ready to try
            </h2>
            <p className="mt-4 max-w-[40rem] text-lg leading-7 text-secondary">
              Real city forms you can practice with. Please use made-up
              details.
            </p>
            <div className="mt-10">
              <SampleFormList />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-10">
        <Disclaimer />
      </footer>
    </div>
  );
}
