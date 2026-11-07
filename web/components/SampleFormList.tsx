import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { sampleForms } from "@/lib/fill/forms";

// The ready-made city forms, each linking to /fill?form=<id>.
// Used on the landing page and on the pick-a-form screen.
export function SampleFormList() {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-[24px] bg-background ring-1 ring-border">
      {sampleForms.map((form) => (
        <li key={form.id}>
          <Link
            href={`/fill?form=${form.id}`}
            className="group flex items-center gap-4 px-5 py-5 transition-colors duration-150 hover:bg-fog focus-visible:bg-fog focus-visible:outline-none sm:px-7"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mist">
              <FileText className="h-5 w-5 text-secondary" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg leading-6 font-medium">
                {form.title}
              </span>
              <span className="mt-0.5 block text-base text-muted">
                {form.city}, {form.pages} {form.pages === 1 ? "page" : "pages"}
              </span>
            </span>
            <span className="hidden shrink-0 items-center gap-2 text-base font-medium sm:flex">
              Fill this form
              <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 sm:hidden" strokeWidth={2} aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
