// Process ONE document of a batch: parse → (re-parse once if empty) → compliance with the
// city's known facts → digest. Each document runs in its own request, so a 20-file batch never
// hits the 4.5 MB body limit or the 300 s function limit, and the model only ever holds one
// document at a time. Results are cached by content hash, so a re-upload costs nothing.
// Server only.

import crypto from "node:crypto";
import type { ComplianceResult, Emit, ParsedDoc, ProjectType } from "../agents/schemas";
import { cityKey, cityNote } from "./city-context";
import { digestDoc, type DocDigest } from "./digest";

export type DocInput = {
  pdfBase64: string;
  filename: string;
  city: string;
  projectType: ProjectType;
  packagePdfBase64?: string;
  modelChoice?: string;
};

export type DocResult = { digest: DocDigest; parsed: ParsedDoc; compliance: ComplianceResult | null; cached: boolean };

/** Same file + city + project type (+ package + model) → same key. */
export function docKey(input: DocInput): string {
  const h = crypto.createHash("sha256");
  h.update(input.pdfBase64);
  if (input.packagePdfBase64) h.update("|pkg|" + input.packagePdfBase64);
  return `${h.digest("hex").slice(0, 20)}:${cityKey(input.city)}:${input.projectType}:${input.modelChoice ?? "default"}`;
}

// Small in-process LRU. On a warm server (and always in dev) repeat files are free. The browser
// also keeps results, so a cold server just recomputes.
const MAX_CACHE = 64;
const cache = new Map<string, Omit<DocResult, "cached">>();
function remember(key: string, value: Omit<DocResult, "cached">) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
}

export async function processDoc(input: DocInput, emit: Emit, opts: { mock?: boolean } = {}): Promise<DocResult> {
  const mock = opts.mock || process.env.MOCK === "1";
  const key = (mock ? "mock:" : "") + docKey(input);
  const hit = cache.get(key);
  if (hit) {
    remember(key, hit);
    emit({ type: "progress", agent: "master", message: `${input.filename}: already checked, reusing the result` });
    // Same content may arrive under another name; label the digest with this upload's name.
    return { ...hit, digest: { ...hit.digest, filename: input.filename }, cached: true };
  }

  if (mock) {
    const { mockDoc } = await import("./mock");
    const r = await mockDoc(input, emit);
    const value = { ...r, digest: digestDoc({ key, filename: input.filename, parsed: r.parsed, compliance: r.compliance }) };
    remember(key, value);
    return { ...value, cached: false };
  }

  const { runParser } = await import("../agents/parser");
  const { runCompliance } = await import("../agents/compliance");

  let parsed = await runParser(
    { pdfBase64: input.pdfBase64, city: input.city, projectType: input.projectType, packagePdfBase64: input.packagePdfBase64 },
    emit,
  );
  // Same rule as the master agent: re-parse once if a checklist came back empty.
  if (parsed.isChecklist && !parsed.containsPersonalInfo && parsed.items.length === 0) {
    emit({ type: "progress", agent: "master", message: `${input.filename}: no lines found, reading it again` });
    parsed = await runParser(
      {
        pdfBase64: input.pdfBase64,
        city: input.city,
        projectType: input.projectType,
        packagePdfBase64: input.packagePdfBase64,
        note: "The previous parse returned zero items. List every checklist line.",
      },
      emit,
    );
  }

  // Stop before compliance when the file isn't usable, the same way the master asks the user.
  let compliance: ComplianceResult | null = null;
  if (parsed.isChecklist && !parsed.containsPersonalInfo && parsed.items.length > 0) {
    const context = cityNote(parsed.city || input.city);
    if (context) emit({ type: "progress", agent: "master", message: `Reusing what we already know about ${cityKey(parsed.city || input.city)}` });
    compliance = await runCompliance({ parsed, context: context || undefined }, emit);
  }

  const value = { parsed, compliance, digest: digestDoc({ key, filename: input.filename, parsed, compliance }) };
  remember(key, value);
  return { ...value, cached: false };
}
