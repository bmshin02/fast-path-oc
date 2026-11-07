import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";
import { SiteHeader } from "@/components/SiteHeader";

const steps = [
  {
    title: "Upload",
    text: "Add a housing form as a PDF, or pick one of the city forms we already have.",
  },
  {
    title: "Answer",
    text: "Claude asks only what it can't look up itself, and follows up if something is unclear.",
  },
  {
    title: "Download",
    text: "Preview the filled form, see where each answer came from, and download it.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 py-14 sm:px-6 sm:py-20">
        <h1 className="text-center text-4xl font-semibold tracking-tight sm:text-5xl">
          Welcome to Fast Track
        </h1>
        <p className="mt-4 max-w-xl text-center text-lg text-muted">
          A way to speed up your housing project by 2x. Upload your form,
          answer a few questions, and get it back filled in.
        </p>

        <Link
          href="/fill"
          className="group mt-10 flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border bg-surface px-6 py-12 text-center transition-colors hover:border-accent focus-visible:border-accent focus-visible:outline-none"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent transition-transform group-hover:-translate-y-0.5">
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 16V4M7 9l5-5 5 5" />
              <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
          </span>
          <span>
            <span className="block text-lg font-medium">
              Upload a housing form
            </span>
            <span className="mt-1 block text-sm text-muted">
              PDF · or choose an Anaheim or Irvine ADU form
            </span>
          </span>
        </Link>

        <ol className="mt-16 grid w-full gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <span className="text-sm font-medium text-accent">
                Step {i + 1}
              </span>
              <h2 className="mt-1 font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </main>

      <footer className="px-4 py-6">
        <Disclaimer />
      </footer>
    </div>
  );
}
