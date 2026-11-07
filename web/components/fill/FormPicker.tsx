"use client";

import { CircleAlert } from "lucide-react";
import { SampleFormList } from "@/components/SampleFormList";
import type { UploadKind } from "@/lib/fill/upload";
import { UploadZone } from "./UploadZone";

export function FormPicker({
  unknownId,
  mock = false,
  onFile,
}: {
  unknownId: string | null;
  mock?: boolean;
  onFile: (file: File, kind: UploadKind) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[800px]">
      <h1 className="font-serif text-[44px] leading-[1.12] font-normal tracking-[-0.015em] sm:text-[56px]">
        Choose your form
      </h1>
      <p className="mt-4 text-xl leading-8 text-secondary">
        Upload the housing form you need to fill in. Fast Track will read it
        and ask you a few questions.
      </p>

      {unknownId && (
        <p
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-2xl bg-peach px-5 py-4 text-lg leading-7 text-sienna"
        >
          <CircleAlert className="mt-1 h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          We couldn&apos;t find that form. Upload yours, or pick one below.
        </p>
      )}

      <div className="mt-10">
        <UploadZone onFile={onFile} />
      </div>

      <h2 className="mt-16 text-[26px] leading-8 font-medium">
        Or practice with one of our forms
      </h2>
      <p className="mt-2 text-lg leading-7 text-secondary">
        Real city forms. Please use made-up details.
      </p>
      <div className="mt-6">
        <SampleFormList mock={mock} />
      </div>
    </div>
  );
}
