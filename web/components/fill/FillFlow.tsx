"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Disclaimer } from "@/components/Disclaimer";
import { sampleForms } from "@/lib/fill/forms";
import type { FormSource } from "@/lib/fill/types";
import { FillQueue } from "./FillQueue";
import { FormPicker } from "./FormPicker";
import type { PickedFile } from "./UploadZone";

// /fill decides what to show:
//   ?form=<sample id>    → work on that sample form
//   files just uploaded  → work through them one by one (kept in memory only)
//   otherwise            → the pick-a-form screen
// ?mock=1 runs the scripted demo instead of calling Claude.
export function FillFlow() {
  const params = useSearchParams();
  const [uploads, setUploads] = useState<PickedFile[] | null>(null);

  const formId = params.get("form");
  const mock = params.get("mock") === "1";
  const sample = sampleForms.find((f) => f.id === formId);
  // Keep the same objects between renders so sessions and PDFs aren't rebuilt.
  const sources = useMemo<FormSource[] | null>(
    () =>
      uploads?.length
        ? uploads.map((u) => ({ kind: "upload" as const, file: u.file, fileKind: u.kind }))
        : sample
          ? [{ kind: "sample" as const, form: sample }]
          : null,
    [uploads, sample],
  );

  if (!sources) {
    return (
      <>
        <div className="flex-1 bg-fog px-4 py-10 sm:px-6 sm:py-16">
          <FormPicker unknownId={formId && !sample ? formId : null} mock={mock} onFiles={setUploads} />
        </div>
        <footer className="border-t border-border px-4 py-10">
          <Disclaimer />
        </footer>
      </>
    );
  }

  return (
    <div className="flex-1 bg-fog">
      <FillQueue
        key={sources.map((s) => (s.kind === "sample" ? s.form.id : `${s.file.name}-${s.file.lastModified}`)).join("|")}
        sources={sources}
        mock={mock}
      />
    </div>
  );
}
