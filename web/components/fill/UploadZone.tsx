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

export type PickedFile = { file: File; kind: UploadKind };

/** How many forms one visit can work through. */
export const MAX_FILES = 6;

// A large, forgiving upload target: choose one or more PDF or Word files, or
// drag them here. Other file types are greyed out in the picker and refused
// while dragging. Each file is checked; problems are listed in plain words.
export function UploadZone({ onFiles }: { onFiles: (files: PickedFile[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [errors, setErrors] = useState<string[]>([]);
  const [usable, setUsable] = useState<PickedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [checking, setChecking] = useState(false);

  async function accept(list: FileList | File[] | null | undefined) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setChecking(true);

    const good: PickedFile[] = [];
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const file of files) {
      const id = `${file.name}-${file.size}-${file.lastModified}`;
      if (seen.has(id)) continue; // the same file chosen twice
      seen.add(id);
      const result = await checkUpload(file);
      if (result.ok) good.push({ file, kind: result.kind });
      else problems.push(result.message);
    }
    if (good.length > MAX_FILES) {
      problems.push(`You chose ${good.length} forms. Fast Track can do up to ${MAX_FILES} at a time, so it will start with the first ${MAX_FILES}.`);
      good.length = MAX_FILES;
    }
    setChecking(false);

    // Everything usable and nothing to explain: go straight on.
    if (!problems.length) {
      onFiles(good);
      return;
    }
    setErrors(problems);
    setUsable(good);
  }

  function dragAllowed(e: React.DragEvent) {
    const items = Array.from(e.dataTransfer.items);
    return items.length > 0 && items.every((i) => i.kind === "file" && isAcceptableDragType(i.type));
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
          void accept(e.dataTransfer.files);
        }}
        className={`relative flex flex-col items-center rounded-[24px] border-2 border-dashed px-6 py-12 text-center transition-colors duration-150 sm:py-16 ${
          dragging
            ? "border-foreground bg-mist"
            : errors.length
              ? "border-sienna/60 bg-background"
              : "border-border-strong bg-background"
        }`}
      >
        <span className="grid h-16 w-16 place-items-center rounded-full bg-peach text-sienna">
          <ArrowUpFromLine className="h-7 w-7" strokeWidth={1.75} aria-hidden />
        </span>
        <p className="mt-5 text-[22px] leading-7 font-medium">Upload your housing forms</p>
        <p className="mt-2 max-w-md text-lg leading-7 text-secondary">
          Choose one or more PDF or Word documents, or drag them here. Up to {MAX_FILES} files,{" "}
          {MAX_UPLOAD_MB} MB each. Fast Track will go through them one at a time.
        </p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={checking}
          aria-describedby={errors.length ? errorId : undefined}
          className="mt-7 inline-flex h-14 items-center justify-center gap-3 rounded-full bg-primary-fill px-8 text-lg font-medium text-on-primary transition-colors duration-150 hover:bg-[#2c2f34] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground active:scale-[0.98] disabled:opacity-60"
        >
          {checking ? "Checking the files…" : "Choose files"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void accept(e.target.files);
            e.target.value = ""; // allow choosing the same files again
          }}
        />
      </div>

      {errors.length > 0 && (
        <div id={errorId} role="alert" className="mt-4 rounded-2xl bg-peach px-5 py-4 text-lg leading-7 text-sienna">
          <ul className="space-y-2">
            {errors.map((msg) => (
              <li key={msg} className="flex items-start gap-3">
                <CircleAlert className="mt-1 h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                {msg}
              </li>
            ))}
          </ul>
          {usable.length > 0 && (
            <button
              type="button"
              onClick={() => onFiles(usable)}
              className="mt-4 inline-flex h-12 items-center rounded-full bg-sienna px-6 text-lg font-medium text-peach transition-colors duration-150 hover:bg-[#4a2114] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sienna"
            >
              Continue with the {usable.length === 1 ? "file that works" : `${usable.length} files that work`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
