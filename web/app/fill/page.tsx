import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";
import { SiteHeader } from "@/components/SiteHeader";

// Placeholder until step 2 (pick or upload a form) and step 3 (questions).
export default function FillPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-3 px-4 py-14 text-center sm:px-6">
        <h1 className="font-serif text-4xl font-normal">
          Questions page
        </h1>
        <p className="text-lg text-secondary">Coming in the next steps.</p>
        <Link href="/" className="text-lg font-medium underline underline-offset-4">
          Back to home
        </Link>
      </main>
      <footer className="px-4 py-6">
        <Disclaimer />
      </footer>
    </div>
  );
}
