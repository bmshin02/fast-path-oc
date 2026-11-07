"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { sampleForms } from "@/lib/fill/forms";
import type { FormSource } from "@/lib/fill/types";
import { formatSize } from "@/lib/fill/upload";
import { FormPicker } from "./FormPicker";

// /fill decides what to show:
//   ?form=<sample id>   → that sample form
//   a PDF just uploaded → that file (kept in memory only, never stored)
//   otherwise           → the pick-a-form screen
export function FillFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const [upload, setUpload] = useState<File | null>(null);

  const formId = params.get("form");
  const sample = sampleForms.find((f) => f.id === formId);
  const source: FormSource | null = upload
    ? { kind: "upload", file: upload }
    : sample
      ? { kind: "sample", form: sample }
      : null;

  if (!source) {
    return (
      <FormPicker
        unknownId={formId && !sample ? formId : null}
        onFile={setUpload}
      />
    );
  }

  return (
    <SelectedForm
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
      : `Your PDF, ${formatSize(source.file.size)}`;

  return (
    <div className="mx-auto w-full max-w-[800px]">
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

      {/* Step 3 replaces this with the questions. */}
      <div className="mt-8 rounded-[24px] bg-fog px-6 py-16 text-center ring-1 ring-border">
        <p className="font-serif text-[32px] leading-10">Questions go here</p>
        <p className="mt-3 text-lg text-secondary">
          Coming in the next step.
        </p>
      </div>
    </div>
  );
}
