import { Suspense } from "react";
import type { Metadata } from "next";
import { Disclaimer } from "@/components/Disclaimer";
import { SiteHeader } from "@/components/SiteHeader";
import { FillFlow } from "@/components/fill/FillFlow";

export const metadata: Metadata = {
  title: "Fill a form · Fast Track",
};

export default function FillPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1 bg-fog px-4 py-8 sm:px-6 sm:py-10">
        {/* FillFlow reads ?form= in the browser, so it needs a Suspense boundary. */}
        <Suspense
          fallback={
            <p className="mx-auto max-w-[800px] text-lg text-secondary">
              Loading…
            </p>
          }
        >
          <FillFlow />
        </Suspense>
      </main>
      <footer className="border-t border-border px-4 py-10">
        <Disclaimer />
      </footer>
    </div>
  );
}
