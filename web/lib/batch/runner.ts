// Browser side of a batch audit: up to MAX_FILES checklists, each sent to /api/batch/doc in its
// own request, CONCURRENCY at a time, with one retry. Identical files are audited once. Results
// are kept in sessionStorage (this tab only), so reloading the page doesn't re-audit finished
// files. Only compact digests feed the batch summary; full results stay for "Open report".

import type { ComplianceResult, FilledForm, ParsedDoc } from "../agents/schemas";
import type { DocDigest } from "./digest";
import { runPool } from "./pool";

export const MAX_FILES = 20;
export const MAX_FILE_MB = 3;
export const CONCURRENCY = 3;

export type ItemStatus = "queued" | "running" | "done" | "needs_user" | "error" | "duplicate";

export type BatchItem = {
  id: string; // stable per row
  file: File;
  city: string;
  status: ItemStatus;
  progress: string; // latest progress line
  hash?: string;
  digest?: DocDigest;
  parsed?: ParsedDoc;
  compliance?: ComplianceResult | null;
  cached?: boolean;
  error?: string;
  duplicateOf?: string; // id of the row it matches
};

type Stored = { digest: DocDigest; parsed: ParsedDoc; compliance: ComplianceResult | null };
const STORE_KEY = "fast-path-batch";
const MAX_STORED = 25;

class PermanentError extends Error {
  permanent = true;
}

export async function fileHash(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 20);
}

function storeKey(hash: string, city: string, mock: boolean) {
  return `${mock ? "mock:" : ""}${hash}:${city.toUpperCase()}`;
}

function readStore(): Record<string, Stored & { at: number }> {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeStore(key: string, value: Stored) {
  try {
    const all = readStore();
    all[key] = { ...value, at: Date.now() };
    const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at);
    for (const k of keys.slice(MAX_STORED)) delete all[k];
    sessionStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {
    // quota or blocked storage: results still live in the page
  }
}

export function clearStoredResults() {
  try {
    sessionStorage.removeItem(STORE_KEY);
  } catch {}
}

/** Check files before starting. Returns a user-facing problem per file, or null. */
export function validateFile(file: File): string | null {
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return "Only PDF files can be audited.";
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `Over ${MAX_FILE_MB} MB. Try a smaller copy of this file.`;
  if (file.size === 0) return "This file is empty.";
  return null;
}

async function auditOne(
  item: BatchItem,
  opts: { projectType: string; query: string; signal?: AbortSignal },
  update: (patch: Partial<BatchItem>) => void,
): Promise<Stored & { cached: boolean }> {
  const form = new FormData();
  form.set("file", item.file);
  form.set("city", item.city);
  form.set("projectType", opts.projectType);
  let res: Response;
  try {
    res = await fetch(`/api/batch/doc${opts.query}`, { method: "POST", body: form, signal: opts.signal });
  } catch {
    throw new Error("Couldn't reach the server.");
  }
  if (res.status === 413) throw new PermanentError("Too large to upload.");
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    const msg = data?.error ?? `Server error (${res.status}).`;
    throw res.status >= 400 && res.status < 500 ? new PermanentError(msg) : new Error(msg);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (!line.trim()) continue;
      const ev = JSON.parse(line);
      if (ev.type === "progress") update({ progress: ev.message });
      else if (ev.type === "error") throw new Error(ev.message);
      else if (ev.type === "doc") return { digest: ev.digest, parsed: ev.parsed, compliance: ev.compliance, cached: ev.cached };
    }
    if (done) break;
  }
  throw new Error("The server stopped before finishing this file.");
}

/**
 * Audit every queued item. `onChange` gets each row's updates as they happen. Resolves when all
 * rows have settled (done, needs_user, error or duplicate).
 */
export async function runBatch(
  items: BatchItem[],
  opts: { projectType?: string; mock?: boolean; model?: string | null; signal?: AbortSignal; onChange: (id: string, patch: Partial<BatchItem>) => void },
): Promise<void> {
  const mock = !!opts.mock;
  const params = new URLSearchParams();
  if (mock) params.set("mock", "1");
  if (opts.model) params.set("model", opts.model);
  const query = params.toString() ? `?${params}` : "";
  const projectType = opts.projectType ?? "adu";
  const stored = readStore();

  // 1. Hash, reuse stored results, and mark in-batch duplicates.
  const firstByKey = new Map<string, string>();
  const todo: BatchItem[] = [];
  for (const item of items) {
    if (item.status === "done" || item.status === "needs_user") continue;
    const hash = item.hash ?? (await fileHash(item.file));
    const key = storeKey(hash, item.city, mock);
    const prior = stored[key];
    if (prior) {
      opts.onChange(item.id, { hash, status: prior.digest.needsUser ? "needs_user" : "done", progress: "Already checked in this tab", cached: true, ...prior });
      continue;
    }
    const first = firstByKey.get(key);
    if (first) {
      opts.onChange(item.id, { hash, status: "duplicate", duplicateOf: first, progress: "Same file and city as another row" });
      continue;
    }
    firstByKey.set(key, item.id);
    opts.onChange(item.id, { hash, status: "queued", progress: "Waiting", error: undefined });
    todo.push({ ...item, hash });
  }

  // 2. Audit the rest, a few at a time.
  await runPool(
    todo,
    CONCURRENCY,
    async (item) => {
      opts.onChange(item.id, { status: "running", progress: "Uploading" });
      return auditOne(item, { projectType, query, signal: opts.signal }, (patch) => opts.onChange(item.id, patch));
    },
    {
      retries: 1,
      signal: opts.signal,
      onSettled: (i, r) => {
        const item = todo[i];
        if (r.ok) {
          const { digest, parsed, compliance, cached } = r.value;
          writeStore(storeKey(item.hash!, item.city, mock), { digest, parsed, compliance });
          opts.onChange(item.id, {
            status: digest.needsUser ? "needs_user" : "done",
            progress: digest.needsUser ?? (cached ? "Done (reused an earlier result)" : "Done"),
            digest,
            parsed,
            compliance,
            cached,
          });
        } else {
          opts.onChange(item.id, { status: "error", progress: r.error, error: r.error });
        }
      },
    },
  );
}

/** The marked-up PDF for one finished row, built on demand from its saved results. */
export async function fetchFilledForm(item: BatchItem, opts: { mock?: boolean; model?: string | null } = {}): Promise<FilledForm> {
  if (!item.parsed || !item.compliance) throw new Error("This file hasn't been checked yet.");
  const params = new URLSearchParams();
  if (opts.mock) params.set("mock", "1");
  if (opts.model) params.set("model", opts.model);
  const form = new FormData();
  form.set("file", item.file);
  form.set("results", JSON.stringify({ parsed: item.parsed, compliance: item.compliance }));
  const res = await fetch(`/api/batch/form${params.toString() ? `?${params}` : ""}`, { method: "POST", body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Couldn't mark up the form.");
  return data as FilledForm;
}
