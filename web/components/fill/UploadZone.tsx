"use client";

import { useId, useRef, useState } from "react";
import { ArrowUpFromLine, CircleAlert } from "lucide-react";
import {
  ACCEPT_ATTR,
  checkUpload,
  isAcceptableDragType,
  MAX_UPLOAD_MB,
  type UploadKind,
} from "@/lib/fill/upload";

// A large, forgiving upload target: click the button to open the file picker,
// or drag a PDF or Word document onto it. Other file types are greyed out in
// the picker and refused while dragging, so they can't be chosen at all.
export function UploadZone({
  onFile,
}: {
  onFile: (file: File, kind: UploadKind) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [checking, setChecking] = useState(false);

  async function accept(file: File | undefined) {
    if (!file) return;
    setChecking(true);
    const result = await checkUpload(file);
    setChecking(false);
    if (result.ok) {
      setError(null);
      onFile(file, result.kind);
    } else {
      setError(result.message);
    }
  }

  function dragAllowed(e: React.DragEvent) {
    const items = Array.from(e.dataTransfer.items);
    return (
      items.length === 1 &&
      items[0].kind === "file" &&
      isAcceptableDragType(items[0].type)
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          const ok = dragAllowed(e);
          e.dataTransfer.dropEffect = ok ? "copy" : "none";
          setDragging(ok);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!dragAllowed(e)) return;
          void accept(e.dataTransfer.files[0]);
        }}
        className={`flex flex-col items-center rounded-[24px] border-2 border-dashed px-6 py-12 text-center transition-colors duration-150 sm:py-16 ${
          dragging
            ? "border-foreground bg-mist"
            : error
              ? "border-sienna/60 bg-background"
              : "border-border-strong bg-background"
        }`}
      >
        <span className="grid h-16 w-16 place-items-center rounded-full bg-peach text-sienna">
          <ArrowUpFromLine className="h-7 w-7" strokeWidth={1.75} aria-hidden />
        </span>
        <p className="mt-5 text-[22px] leading-7 font-medium">
          Upload your housing form
        </p>
        <p className="mt-2 max-w-md text-lg leading-7 text-secondary">
          Choose a PDF or Word document from your computer, or drag it here.
          Files up to {MAX_UPLOAD_MB} MB.
        </p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={checking}
          aria-describedby={error ? errorId : undefined}
          className="mt-7 inline-flex h-14 items-center justify-center gap-3 rounded-full bg-primary-fill px-8 text-lg font-medium text-on-primary transition-colors duration-150 hover:bg-[#2c2f34] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground active:scale-[0.98] disabled:opacity-60"
        >
          {checking ? "Checking the file…" : "Choose a file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void accept(e.target.files?.[0]);
            e.target.value = ""; // allow choosing the same file again
          }}
        />
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-2xl bg-peach px-5 py-4 text-lg leading-7 text-sienna"
        >
          <CircleAlert className="mt-1 h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
