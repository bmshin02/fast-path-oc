"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { sampleForms } from "@/lib/fill/forms";
import type { FormSource } from "@/lib/fill/types";
import { formatSize, type UploadKind } from "@/lib/fill/upload";
import { FillSessionView } from "./FillSessionView";
import { FormPicker } from "./FormPicker";

// /fill decides what to show:
//   ?form=<sample id>   → that sample form
//   a file just uploaded → that file (kept in memory only, never stored)
//   otherwise           → the pick-a-form screen
export function FillFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const [upload, setUpload] = useState<{ file: File; kind: UploadKind } | null>(
    null,
  );

  const formId = params.get("form");
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
      <FormPicker
        unknownId={formId && !sample ? formId : null}
        onFile={(file, kind) => setUpload({ file, kind })}
      />
    );
  }

  return (
    <SelectedForm
      key={source.kind === "sample" ? source.form.id : `${source.file.name}-${source.file.lastModified}`}
      source={source}
      onChange={() => {
        setUpload(null);
        router.push("/fill");
      }}
    />
  );
}

function SelectedForm({
  source,
  onChange,
}: {
  source: FormSource;
  onChange: () => void;
}) {
  const title =
    source.kind === "sample" ? source.form.title : source.file.name;
  const meta =
    source.kind === "sample"
      ? `${source.form.city}, ${source.form.pages} ${source.form.pages === 1 ? "page" : "pages"}`
      : `Your ${source.fileKind === "pdf" ? "PDF" : "Word document"}, ${formatSize(source.file.size)}`;

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <div className="flex flex-col gap-4 rounded-[24px] bg-background p-5 ring-1 ring-border sm:flex-row sm:items-center sm:p-6">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-mist">
          <FileText className="h-6 w-6 text-secondary" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base text-muted">Your form</p>
          <p className="text-xl leading-7 font-medium break-words">{title}</p>
          <p className="text-base text-muted">{meta}</p>
        </div>
        <button
          type="button"
          onClick={onChange}
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border border-foreground/80 px-6 text-lg font-medium transition-colors duration-150 hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
        >
          Change form
        </button>
      </div>

      <div className="mt-5">
        <FillSessionView source={source} />
      </div>
    </div>
  );
}
