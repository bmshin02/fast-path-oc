"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Disclaimer } from "@/components/Disclaimer";
import { sampleForms } from "@/lib/fill/forms";
import type { FormSource } from "@/lib/fill/types";
import type { UploadKind } from "@/lib/fill/upload";
import { FillSessionView } from "./FillSessionView";
import { FormPicker } from "./FormPicker";

// /fill decides what to show:
//   ?form=<sample id>    → work on that sample form
//   a file just uploaded → work on that file (kept in memory only, never stored)
//   otherwise            → the pick-a-form screen
// ?mock=1 runs the scripted demo instead of calling Claude.
export function FillFlow() {
  const params = useSearchParams();
  const [upload, setUpload] = useState<{ file: File; kind: UploadKind } | null>(null);

  const formId = params.get("form");
  const mock = params.get("mock") === "1";
  const sample = sampleForms.find((f) => f.id === formId);
  // Keep the same object between renders so the session and PDF aren't rebuilt.
  const source = useMemo<FormSource | null>(
    () =>
      upload
        ? { kind: "upload", file: upload.file, fileKind: upload.kind }
        : sample
          ? { kind: "sample", form: sample }
          : null,
    [upload, sample],
  );

  if (!source) {
    return (
      <>
        <div className="flex-1 bg-fog px-4 py-10 sm:px-6 sm:py-16">
          <FormPicker
            unknownId={formId && !sample ? formId : null}
            mock={mock}
            onFile={(file, kind) => setUpload({ file, kind })}
          />
        </div>
        <footer className="border-t border-border px-4 py-10">
          <Disclaimer />
        </footer>
      </>
    );
  }

  return (
    <div className="flex-1 bg-fog">
      <FillSessionView
        key={source.kind === "sample" ? source.form.id : `${source.file.name}-${source.file.lastModified}`}
        source={source}
        mock={mock}
      />
    </div>
  );
}
