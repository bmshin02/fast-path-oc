import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { FillFlow } from "@/components/fill/FillFlow";

export const metadata: Metadata = {
  title: "Fill a form · Fast Track",
};

export default function FillPage() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Just the logo here: the landing page's section links don't apply. */}
      <SiteHeader minimal />
      <main className="flex flex-1 flex-col">
        {/* FillFlow reads ?form= in the browser, so it needs a Suspense boundary. */}
        <Suspense
          fallback={
            <p className="mx-auto w-full max-w-[800px] flex-1 bg-fog px-4 py-16 text-lg text-secondary">
              Loading…
            </p>
          }
        >
          <FillFlow />
        </Suspense>
      </main>
    </div>
  );
}
