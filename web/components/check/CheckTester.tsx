"use client";

// TEST PAGE for /api/check (the agent pipeline). Sends a sample checklist from /public/forms,
// streams the NDJSON progress events, and shows the form the producer gives back: the same PDF,
// with current citations written in, possible conflicts marked, and researched boxes filled.
// With MOCK=1 on the server it replays a recorded Anaheim run and spends no API credits.

import { useEffect, useMemo, useState } from "react";
import type { FilledForm, FilledForms, ProgressEvent, RunOutcome } from "@/lib/agents/schemas";

const SAMPLES = [
  { label: "Anaheim ADU checklist (Z412, Nov 2025)", city: "Anaheim", file: "/forms/anaheim-adu-checklist.pdf" },
  { label: "Irvine development standards checklist", city: "Irvine", file: "/forms/irvine-development-standards.pdf" },
];

type Line = { agent: string; message: string };

export function CheckTester() {
  const [sample, setSample] = useState(SAMPLES[0]);
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);

  async function run() {
    setRunning(true);
    setLines([]);
    setOutcome(null);
    setError(null);
    setSeconds(null);
    const started = Date.now();
    try {
      const pdf = await fetch(sample.file).then((r) => {
        if (!r.ok) throw new Error(`Couldn't load ${sample.file} (${r.status})`);
        return r.blob();
      });
      const form = new FormData();
      form.append("mode", "checklist");
      form.append("projectType", "adu");
      form.append("city", sample.city);
      form.append("checklist", new File([pdf], sample.file.split("/").pop()!, { type: "application/pdf" }));

      const res = await fetch("/api/check", { method: "POST", body: form });
      if (!res.ok || !res.body) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n");
        buf = parts.pop() ?? "";
        for (const p of parts) if (p.trim()) handle(JSON.parse(p) as ProgressEvent);
      }
      if (buf.trim()) handle(JSON.parse(buf) as ProgressEvent);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSeconds(Math.round((Date.now() - started) / 1000));
      setRunning(false);
    }
  }

  function handle(e: ProgressEvent) {
    if (e.type === "progress") setLines((l) => [...l, { agent: e.agent, message: e.message }]);
    else if (e.type === "result") setOutcome(e.outcome);
    else if (e.type === "error") setError(e.message);
  }

  const result: FilledForms | null = outcome?.kind === "forms" ? outcome.result : null;

  return (
    <div className="mx-auto max-w-[960px]">
      <h1 className="font-serif text-[34px] leading-[1.2]">Agent check (test page)</h1>
      <p className="mt-2 text-secondary">
        Sends a sample checklist to <code>/api/check</code> and shows what the agents return. When demo mode
        (MOCK=1) is on, this replays a recorded Anaheim run and uses no API credits.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          className="rounded-full border border-border-strong bg-background px-4 py-3"
          value={sample.file}
          onChange={(e) => setSample(SAMPLES.find((s) => s.file === e.target.value) ?? SAMPLES[0])}
          disabled={running}
        >
          {SAMPLES.map((s) => (
            <option key={s.file} value={s.file}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="rounded-full bg-primary-fill px-6 py-3 font-medium text-on-primary disabled:opacity-50"
        >
          {running ? "Running…" : "Run check"}
        </button>
        {seconds !== null && <span className="text-muted">Took {seconds}s</span>}
      </div>

      {lines.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Progress</h2>
          <ol className="mt-3 space-y-1 rounded-2xl bg-mist p-4 font-mono text-sm">
            {lines.map((l, i) => (
              <li key={i}>
                <span className="text-muted">[{l.agent}]</span> {l.message}
              </li>
            ))}
          </ol>
        </section>
      )}

      {error && (
        <p className="mt-6 rounded-2xl border border-border-strong bg-peach p-4 text-sienna">Error: {error}</p>
      )}

      {outcome?.kind === "question" && (
        <p className="mt-6 rounded-2xl bg-peach p-4 text-sienna">The agents asked: {outcome.question}</p>
      )}

      {result?.forms.map((f, i) => <FormResult key={i} form={f} />)}

      {outcome && (
        <details className="mt-6">
          <summary className="cursor-pointer font-semibold">Raw JSON</summary>
          <pre className="mt-3 max-h-[480px] overflow-auto rounded-2xl bg-mist p-4 text-xs">
            {JSON.stringify(outcome, (k, v) => (k === "pdfBase64" ? `(${v.length} base64 chars)` : v), 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function FormResult({ form }: { form: FilledForm }) {
  const url = useMemo(() => {
    const bytes = Uint8Array.from(atob(form.pdfBase64), (c) => c.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  }, [form.pdfBase64]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">
          {form.city}: {form.docTitle}
        </h2>
        <a className="underline" href={url} download={form.fileName}>
          Download {form.fileName}
        </a>
      </div>
      <p className="mt-1 text-muted">
        Checked {form.checkedOn} · {form.disclaimer}
      </p>

      <ol className="mt-4 space-y-2">
        {form.changes.map((c, i) => (
          <li key={i} className="rounded-2xl border border-border p-3">
            <span className="font-semibold">
              {c.number ? `${c.number}. ` : ""}
              {c.kind === "citation" ? "Citation" : c.kind === "note" ? "Possible conflict" : "Filled box"}
              {c.page ? ` (page ${c.page})` : ""}
            </span>
            {!c.placed && <span className="text-sienna"> · not placed on the page</span>}
            <p className="mt-1 text-secondary">
              {c.kind === "note" ? c.note : `“${c.original}” → ${c.newText}`}
            </p>
            {c.sourceUrl && (
              <a className="text-sm underline" href={c.sourceUrl} target="_blank" rel="noreferrer">
                Source
              </a>
            )}
          </li>
        ))}
      </ol>

      <iframe title={`${form.city} form, marked up`} src={url} className="mt-4 h-[80vh] w-full rounded-2xl border border-border" />
    </section>
  );
}
