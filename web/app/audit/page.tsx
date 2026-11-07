import { Suspense } from "react";
import type { Metadata } from "next";
import { Disclaimer } from "@/components/Disclaimer";
import { SiteHeader } from "@/components/SiteHeader";
import { AuditBatch } from "@/components/audit/AuditBatch";

export const metadata: Metadata = {
  title: "Check checklists · Fast Track",
};

// /audit: batch checklist audit (up to 20 PDFs). ?mock=1 runs on sample results, no API calls.
export default function AuditPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1 bg-fog px-4 py-8 sm:px-6 sm:py-10">
        {/* AuditBatch reads ?mock= in the browser, so it needs a Suspense boundary (same as /fill). */}
        <Suspense fallback={<p className="mx-auto max-w-[1100px] text-lg text-secondary">Loading…</p>}>
          <AuditBatch />
        </Suspense>
      </main>
      <footer className="border-t border-border px-4 py-10">
        <Disclaimer />
      </footer>
    </div>
  );
}
