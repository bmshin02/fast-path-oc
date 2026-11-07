"use client";

import { useEffect, useState } from "react";
import { Check, Download, ExternalLink, RotateCcw } from "lucide-react";
import { buildFilledPdf } from "@/lib/fill/pdf";
import type { FormField, FormSource } from "@/lib/fill/types";
import { FieldList } from "./FieldList";

// Shown when Fast Track is done: the summary, the filled PDF to preview,
// and a download button. The PDF is built in the browser; nothing is uploaded.
export function ResultPanel({
  source,
  fields,
  summary,
  mock = false,
}: {
  source: FormSource;
  fields: FormField[];
  summary: string;
  mock?: boolean;
}) {
  const [pdf, setPdf] = useState<{ url: string; fileName: string; inPlace: boolean } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    buildFilledPdf(source, fields)
      .then(({ bytes, fileName, inPlace }) => {
        if (cancelled) return;
        url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
        setPdf({ url, fileName, inPlace });
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [source, fields]);

  return (
    <section aria-labelledby="result-heading">
      <div className="rounded-[24px] bg-peach p-6 text-sienna sm:p-8">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-sienna text-peach">
          <Check className="h-6 w-6" strokeWidth={2.25} aria-hidden />
        </span>
        <h1 id="result-heading" className="mt-5 font-serif text-[34px] leading-[1.2] font-normal sm:text-[44px]">
          Your form is ready
        </h1>
        <p className="mt-3 max-w-[44rem] text-xl leading-8">{summary}</p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          {pdf ? (
            <a
              href={pdf.url}
              download={pdf.fileName}
              className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-primary-fill px-8 text-lg font-medium text-on-primary transition-colors duration-150 hover:bg-[#2c2f34] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
            >
              <Download className="h-5 w-5" strokeWidth={2} aria-hidden />
              Download filled form
            </a>
          ) : (
            <span className="inline-flex h-14 items-center justify-center rounded-full bg-primary-fill/70 px-8 text-lg font-medium text-on-primary">
              {error ? "Couldn't make the PDF" : "Preparing your PDF…"}
            </span>
          )}
          {pdf && (
            <a
              href={pdf.url}
              target="_blank"
              rel="noopener"
              className="inline-flex h-14 items-center justify-center gap-3 rounded-full border border-sienna/70 px-8 text-lg font-medium text-sienna transition-colors duration-150 hover:bg-white/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sienna"
            >
              <ExternalLink className="h-5 w-5" strokeWidth={2} aria-hidden />
              Open in a new tab
            </a>
          )}
          {/* A full page load, so an uploaded file is cleared too. */}
          <a
            href={mock ? "/fill?mock=1" : "/fill"}
            className="inline-flex h-14 items-center justify-center gap-3 rounded-full px-6 text-lg font-medium text-sienna underline-offset-4 transition-colors duration-150 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sienna sm:ml-auto"
          >
            <RotateCcw className="h-5 w-5" strokeWidth={2} aria-hidden />
            Fill another form
          </a>
        </div>
        {error && (
          <p role="alert" className="mt-4 text-lg leading-7">
            Something went wrong making the PDF. Your answers are still listed below, so you can copy them onto the form.
          </p>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="overflow-hidden rounded-[24px] bg-background ring-1 ring-border">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-xl font-medium">Preview</h3>
            <p className="text-base text-secondary">
              {pdf?.inPlace
                ? "This is the city's own form with your answers filled in. You can still change any box in a PDF reader."
                : "A clean copy of every answer, ready to copy onto the city's form."}
            </p>
          </div>
          {pdf ? (
            <iframe
              src={`${pdf.url}#page=${pdf.inPlace && source.kind === "sample" && source.form.id === "irvine-adu-application" ? 2 : 1}&navpanes=0&zoom=page-width`}
              title="Preview of your filled form"
              className="h-[640px] w-full bg-mist sm:h-[900px]"
            />
          ) : (
            <div className="grid h-[400px] place-items-center bg-mist text-lg text-secondary">
              {error ? "No preview available" : "Preparing the preview…"}
            </div>
          )}
        </div>

        <div className="self-start overflow-hidden rounded-[24px] bg-background ring-1 ring-border">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-xl font-medium">Check your answers</h3>
            <p className="text-base text-secondary">Where each answer came from.</p>
          </div>
          <FieldList fields={fields} finished />
        </div>
      </div>
    </section>
  );
}
