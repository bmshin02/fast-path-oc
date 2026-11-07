"use client";

// Batch checklist audit: drop up to 20 city checklists, pick each one's city, and watch them get
// checked a few at a time. The summary across files is computed in the browser from compact
// digests (lib/batch/aggregate.ts). A file's marked-up form is built only when it's opened, and
// "compare" works from the two digests in the browser, with no server call.

import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpFromLine, CircleAlert, CircleCheck, Copy, FileText, Loader2, RotateCcw, X } from "lucide-react";
import { aggregate } from "@/lib/batch/aggregate";
import { guessCity, OC_JURISDICTIONS } from "@/lib/batch/cities";
import {
  clearStoredResults,
  fetchFilledForm,
  MAX_FILE_MB,
  MAX_FILES,
  runBatch,
  validateFile,
  type BatchItem,
} from "@/lib/batch/runner";
import type { FilledForm } from "@/lib/agents/schemas";
import type { DocDigest } from "@/lib/batch/digest";

const STATUS_LABEL: Record<BatchItem["status"], string> = {
  queued: "Waiting",
  running: "Checking",
  done: "Done",
  needs_user: "Needs you",
  error: "Didn't finish",
  duplicate: "Duplicate",
};

function StatusIcon({ status }: { status: BatchItem["status"] }) {
  if (status === "running") return <Loader2 className="h-5 w-5 animate-spin text-secondary" aria-hidden />;
  if (status === "done") return <CircleCheck className="h-5 w-5 text-foreground" aria-hidden />;
  if (status === "duplicate") return <Copy className="h-5 w-5 text-muted" aria-hidden />;
  if (status === "error" || status === "needs_user") return <CircleAlert className="h-5 w-5 text-sienna" aria-hidden />;
  return <FileText className="h-5 w-5 text-muted" aria-hidden />;
}

let nextId = 0;

export function AuditBatch() {
  const mock = useSearchParams().get("mock") === "1";
  const [items, setItems] = useState<BatchItem[]>([]);
  const [defaultCity, setDefaultCity] = useState<string>("Anaheim");
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ filled: FilledForm; url: string } | null>(null);
  const [comparing, setComparing] = useState<[DocDigest, DocDigest] | null>(null);
  const [reportBusy, setReportBusy] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const patch = (id: string, p: Partial<BatchItem>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    const room = MAX_FILES - items.length;
    const problems: string[] = [];
    const accepted: BatchItem[] = [];
    for (const f of files) {
      if (accepted.length >= room) {
        problems.push(`Only ${MAX_FILES} files per batch; skipped ${f.name}.`);
        continue;
      }
      const bad = validateFile(f);
      if (bad) {
        problems.push(`${f.name}: ${bad}`);
        continue;
      }
      accepted.push({ id: `f${nextId++}`, file: f, city: guessCity(f.name) ?? defaultCity, status: "queued", progress: "Ready" });
    }
    setItems((xs) => [...xs, ...accepted]);
    setNotice(problems.length ? problems.join(" ") : null);
  }

  async function start() {
    const ac = new AbortController();
    abortRef.current = ac;
    setRunning(true);
    setNotice(null);
    try {
      await runBatch(items, { mock, signal: ac.signal, onChange: patch });
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  async function open(item: BatchItem) {
    setReportBusy(item.id);
    try {
      const filled = await fetchFilledForm(item, { mock });
      const bytes = Uint8Array.from(atob(filled.pdfBase64), (c) => c.charCodeAt(0));
      if (opened) URL.revokeObjectURL(opened.url);
      setOpened({ filled, url: URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })) });
      setComparing(null);
      setTimeout(() => document.getElementById("audit-report")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't mark up the form.");
    } finally {
      setReportBusy(null);
    }
  }


  const finished = items.filter((i) => i.digest);
  const summary = useMemo(() => (finished.length ? aggregate(finished.map((i) => i.digest!)) : null), [finished]);
  const counts = items.reduce<Record<string, number>>((m, i) => ((m[i.status] = (m[i.status] ?? 0) + 1), m), {});
  const pending = items.some((i) => i.status === "queued" || i.status === "error");
  const done = (counts.done ?? 0) + (counts.needs_user ?? 0) + (counts.duplicate ?? 0);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      <section className="rounded-[24px] bg-background p-6 ring-1 ring-border sm:p-8">
        <h1 className="font-serif text-3xl leading-tight sm:text-4xl">Check many city checklists at once</h1>
        <p className="mt-3 max-w-3xl text-secondary">
          Add up to {MAX_FILES} ADU checklists (PDF, up to {MAX_FILE_MB} MB each). Each one is checked against current California law
          on its own, a few at a time, and the results come together below. Files you already checked in this tab are reused.
          {mock && <strong className="font-medium text-foreground"> Demo mode: sample results, no API calls.</strong>}
        </p>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1.5 text-base">
            <span className="text-muted">City for files we can&apos;t recognize</span>
            <select
              value={defaultCity}
              onChange={(e) => setDefaultCity(e.target.value)}
              className="h-11 rounded-xl bg-mist px-3 text-[17px] ring-1 ring-border focus-visible:outline-2 focus-visible:outline-foreground"
            >
              {OC_JURISDICTIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={running || items.length >= MAX_FILES}
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-mist px-5 text-[17px] font-medium ring-1 ring-border-strong transition-colors hover:bg-border disabled:opacity-50"
          >
            <ArrowUpFromLine className="h-5 w-5" aria-hidden /> Add PDFs ({items.length}/{MAX_FILES})
          </button>
          <button
            type="button"
            disabled={running || !pending}
            onClick={start}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary-fill px-6 text-[17px] font-medium text-on-primary transition-colors hover:bg-[#2c2f34] disabled:opacity-50"
          >
            {running ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
            {running ? `Checking… ${done}/${items.length}` : items.some((i) => i.status === "error") ? "Retry the rest" : "Check all"}
          </button>
          {running && (
            <button type="button" onClick={() => abortRef.current?.abort()} className="h-11 rounded-full px-4 text-[17px] text-secondary underline">
              Stop
            </button>
          )}
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!running) addFiles(e.dataTransfer.files);
          }}
          className="mt-5 rounded-2xl border-2 border-dashed border-border-strong bg-fog px-4 py-6 text-center text-muted"
        >
          Or drop PDFs here
        </div>
        {notice && (
          <p role="status" className="mt-4 rounded-xl bg-peach px-4 py-3 text-base text-sienna">
            {notice}
          </p>
        )}
      </section>

      {items.length > 0 && (
        <section className="rounded-[24px] bg-background p-4 ring-1 ring-border sm:p-6" aria-label="Files">
          <div className="mb-3 flex items-center justify-between gap-3 px-2">
            <h2 className="text-xl font-semibold">Files</h2>
            <div className="flex gap-3 text-base">
              {compare.length === 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const [a, b] = items.filter((i) => compare.includes(i.id)).map((i) => i.digest!);
                    setComparing([a, b]);
                    setOpened(null);
                    setTimeout(() => document.getElementById("audit-report")?.scrollIntoView({ behavior: "smooth" }), 50);
                  }}
                  className="rounded-full bg-primary-fill px-4 py-1.5 font-medium text-on-primary"
                >
                  Compare the 2 selected
                </button>
              )}
              {!running && (
                <button
                  type="button"
                  onClick={() => {
                    setItems([]);
                    setOpened(null);
                    setComparing(null);
                    setCompare([]);
                    clearStoredResults();
                  }}
                  className="inline-flex items-center gap-1 text-secondary underline"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden /> Clear all
                </button>
              )}
            </div>
          </div>
          <ul className="divide-y divide-border">
            {items.map((it) => {
              const d = it.digest;
              return (
                <li key={it.id} className="flex flex-col gap-2 px-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <StatusIcon status={it.status} />
                    <div className="min-w-0">
                      <p className="truncate font-medium" title={it.file.name}>
                        {it.file.name}
                      </p>
                      <p className="truncate text-base text-muted">
                        {STATUS_LABEL[it.status]} · {it.progress}
                      </p>
                    </div>
                  </div>
                  <select
                    aria-label={`City for ${it.file.name}`}
                    value={it.city}
                    disabled={running || it.status === "done"}
                    onChange={(e) => patch(it.id, { city: e.target.value, status: "queued", hash: undefined })}
                    className="h-10 rounded-lg bg-mist px-2 text-base ring-1 ring-border disabled:opacity-60"
                  >
                    {OC_JURISDICTIONS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  {d && !d.needsUser ? (
                    <div className="flex items-center gap-3 text-base">
                      <span title="Stale citations">{d.staleCitations} stale</span>
                      <span title="Possible conflicts">{d.statusCounts.possible_conflict} conflict</span>
                      <label className="inline-flex items-center gap-1 text-muted">
                        <input
                          type="checkbox"
                          checked={compare.includes(it.id)}
                          onChange={(e) =>
                            setCompare((c) => (e.target.checked ? [...c, it.id].slice(-2) : c.filter((x) => x !== it.id)))
                          }
                        />
                        compare
                      </label>
                      <button
                        type="button"
                        onClick={() => open(it)}
                        disabled={reportBusy !== null}
                        className="rounded-full px-3 py-1 font-medium ring-1 ring-border-strong hover:bg-mist disabled:opacity-50"
                      >
                        {reportBusy === it.id ? "Opening…" : "Open edited form"}
                      </button>
                    </div>
                  ) : (
                    !running &&
                    it.status !== "done" && (
                      <button
                        type="button"
                        aria-label={`Remove ${it.file.name}`}
                        onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}
                        className="self-start rounded-full p-1.5 text-muted hover:bg-mist sm:self-auto"
                      >
                        <X className="h-5 w-5" aria-hidden />
                      </button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {summary && (
        <section className="rounded-[24px] bg-background p-6 ring-1 ring-border sm:p-8" aria-label="Summary across files">
          <h2 className="text-2xl font-semibold">Across {finished.length} checked file{finished.length === 1 ? "" : "s"}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Stale citations", summary.totals.staleCitations],
              ["Possible conflicts", summary.totals.possible_conflict],
              ["Couldn't verify", summary.totals.unverified],
              ["Lines checked", summary.totals.items],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-fog p-4 ring-1 ring-border">
                <dt className="text-base text-muted">{k}</dt>
                <dd className="mt-1 text-3xl font-semibold">{v}</dd>
              </div>
            ))}
          </dl>

          {summary.recurringStale.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold">Old law that shows up again and again</h3>
              <ul className="mt-2 space-y-1 text-secondary">
                {summary.recurringStale.slice(0, 6).map((r) => (
                  <li key={r.mapping}>
                    <span className="font-mono text-base">{r.mapping}</span> in {r.documents} file{r.documents === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.attention.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold">Look at these first</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-6 text-secondary">
                {summary.attention.slice(0, 5).map((a) => (
                  <li key={a.key}>
                    {a.filename} ({a.city}): {a.possibleConflicts} possible conflict{a.possibleConflicts === 1 ? "" : "s"}, {a.staleCitations} stale
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-6 overflow-x-auto">
            <h3 className="text-lg font-semibold">By city</h3>
            <table className="mt-2 w-full min-w-[520px] text-left text-base">
              <thead className="text-muted">
                <tr>
                  <th className="py-1 pr-4 font-medium">City</th>
                  <th className="py-1 pr-4 font-medium">Files</th>
                  <th className="py-1 pr-4 font-medium">Stale</th>
                  <th className="py-1 pr-4 font-medium">Conflicts</th>
                  <th className="py-1 font-medium">Path and clock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.byCity.map((c) => (
                  <tr key={c.city}>
                    <td className="py-1.5 pr-4">{c.city}</td>
                    <td className="py-1.5 pr-4">{c.documents}</td>
                    <td className="py-1.5 pr-4">{c.staleCitations}</td>
                    <td className="py-1.5 pr-4">{c.possibleConflicts}</td>
                    <td className="py-1.5 text-secondary">{c.paths.join("; ") || "unknown"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {summary.needsUser.length > 0 && (
            <p className="mt-6 rounded-xl bg-peach px-4 py-3 text-base text-sienna">
              {summary.needsUser.map((n) => `${n.filename}: ${n.reason}`).join(" ")}
            </p>
          )}
          {summary.scannerDisagreements.length > 0 && (
            <p className="mt-4 text-base text-muted">
              Our rule-based scanner found old citations the AI didn&apos;t flag in:{" "}
              {summary.scannerDisagreements.map((s) => `${s.filename} (${s.mappings.join(", ")})`).join("; ")}. Worth a second look.
            </p>
          )}
          <p className="mt-4 text-base text-muted">
            Checked {summary.checkedOn.join(", ") || "today"}. Prototype · not legal advice. Possible conflicts are for city staff or counsel to confirm.
          </p>
        </section>
      )}

      {opened && (
        <section id="audit-report" className="rounded-[24px] bg-background p-6 ring-1 ring-border sm:p-8" aria-label="Edited form">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">
                {opened.filled.city}: {opened.filled.docTitle}
              </h2>
              <p className="mt-1 text-base text-muted">
                Checked {opened.filled.checkedOn} · {opened.filled.disclaimer}
              </p>
            </div>
            <div className="flex gap-3">
              <a
                href={opened.url}
                download={opened.filled.fileName}
                className="rounded-full bg-primary-fill px-4 py-1.5 text-base font-medium text-on-primary"
              >
                Download PDF
              </a>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  URL.revokeObjectURL(opened.url);
                  setOpened(null);
                }}
                className="rounded-full p-1.5 hover:bg-mist"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>
          <h3 className="mt-5 text-lg font-semibold">What we changed on the form ({opened.filled.changes.length})</h3>
          <ul className="mt-2 divide-y divide-border">
            {opened.filled.changes.map((c, i) => (
              <li key={i} className="py-2 text-base">
                <span className="font-medium">
                  {c.kind === "citation" ? "Citation" : c.kind === "note" ? `Note ${c.number ?? ""}` : "Filled"}
                  {c.page ? ` · page ${c.page}` : ""}
                  {c.placed ? "" : " · on the change page only"}
                </span>
                {c.newText ? (
                  <span className="block text-secondary">
                    <span className="line-through decoration-muted">{c.original}</span> → {c.newText}
                  </span>
                ) : (
                  <span className="block text-muted">On the form: &ldquo;{c.original}&rdquo;</span>
                )}
                <span className="block text-secondary">
                  {c.note ?? ""}
                  {c.sourceUrl && (
                    <>
                      {" "}
                      <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                        source
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <iframe title="Edited form" src={opened.url} className="mt-5 h-[70vh] w-full rounded-2xl ring-1 ring-border" />
        </section>
      )}

      {comparing && (
        <section id="audit-report" className="rounded-[24px] bg-background p-6 ring-1 ring-border sm:p-8" aria-label="Comparison">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-2xl font-semibold">Side by side</h2>
            <button type="button" aria-label="Close" onClick={() => setComparing(null)} className="rounded-full p-1.5 hover:bg-mist">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-base">
              <thead className="text-muted">
                <tr>
                  <th className="py-1 pr-4 font-medium"></th>
                  {comparing.map((d) => (
                    <th key={d.key} className="py-1 pr-4 font-medium">
                      {d.filename} ({d.city})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(
                  [
                    ["Form", (d: DocDigest) => `${d.docTitle}${d.docDate ? ` (${d.docDate})` : ""}`],
                    ["Approval path", (d: DocDigest) => d.path?.name ?? "unknown"],
                    ["Legal clock", (d: DocDigest) => d.path?.clock ?? "unknown"],
                    ["Lines checked", (d: DocDigest) => String(d.itemCount)],
                    ["Stale citations", (d: DocDigest) => `${d.staleCitations}${d.staleMappings.length ? `: ${d.staleMappings.join("; ")}` : ""}`],
                    ["Possible conflicts", (d: DocDigest) => String(d.statusCounts.possible_conflict)],
                    ["Couldn't verify", (d: DocDigest) => String(d.statusCounts.unverified)],
                    [
                      "Top issue",
                      (d: DocDigest) => (d.issues[0] ? `${d.issues[0].topic ?? d.issues[0].status}: ${d.issues[0].note}` : "none"),
                    ],
                  ] as [string, (d: DocDigest) => string][]
                ).map(([label, f]) => (
                  <tr key={label}>
                    <th className="py-1.5 pr-4 align-top font-medium">{label}</th>
                    {comparing.map((d) => (
                      <td key={d.key} className="py-1.5 pr-4 align-top text-secondary">
                        {f(d)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-base text-muted">From each file&apos;s check summary. Prototype · not legal advice.</p>
        </section>
      )}
    </div>
  );
}
