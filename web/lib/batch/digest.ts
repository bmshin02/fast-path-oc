// A compact, size-bounded summary of one audited document.
//
// This is what the batch view, the cross-document summary and any later model call see instead
// of the full parsed document and compliance result. Twenty full results would be ~20x the
// context; twenty digests stay around a few thousand tokens. Shared by browser and server.

import { scanText } from "../features/citations";
import { staleCitationCount } from "../agents/findings";
import type { ComplianceResult, ItemStatus, ParsedDoc } from "../agents/schemas";

export const DIGEST_LIMITS = { issues: 8, note: 180, unverified: 5 } as const;

export type DocIssue = {
  itemId: string;
  status: ItemStatus;
  line: string; // clipped checklist text
  newCitation: string | null;
  note: string; // clipped
  topic: string | null; // HCD-style label, e.g. "Owner Occupancy"
  suggestedFix: string | null; // clipped
};

export type DocDigest = {
  key: string; // content hash + city + project type; identical uploads share one key
  filename: string;
  city: string;
  projectType: ParsedDoc["projectType"];
  docTitle: string;
  docDate: string | null;
  checkedOn: string;
  itemCount: number;
  statusCounts: Record<ItemStatus, number>;
  staleCitations: number;
  /** Old → new mappings, de-duplicated, e.g. "65852.2 → 66314–66331". */
  staleMappings: string[];
  path: { name: string; clock: string; statute: string } | null;
  packageGaps: { missing: number; inconsistent: number; cantTell: number } | null;
  /** Most serious lines first, capped at DIGEST_LIMITS.issues. */
  issues: DocIssue[];
  unverified: string[];
  /** Deterministic scanner vs. the agent: stale citations the scanner found that the agent didn't flag. */
  scannerOnlyStale: string[];
  needsUser: string | null; // set when the parse said "not a checklist" or "has personal info"
};

const RANK: Record<ItemStatus, number> = { possible_conflict: 4, stale: 3, unverified: 2, uncited: 1, current: 0 };

function clip(s: string, n: number): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

export function emptyCounts(): Record<ItemStatus, number> {
  return { current: 0, stale: 0, uncited: 0, possible_conflict: 0, unverified: 0 };
}

export function digestDoc(args: {
  key: string;
  filename: string;
  parsed: ParsedDoc;
  compliance: ComplianceResult | null;
}): DocDigest {
  const { key, filename, parsed, compliance } = args;
  const textById = new Map(parsed.items.map((i) => [i.id, i.text]));
  const statusCounts = emptyCounts();
  const mappings = new Set<string>();
  let staleCitations = 0;

  for (const it of compliance?.items ?? []) {
    statusCounts[it.status]++;
    staleCitations += staleCitationCount(it.status === "stale" || /→/.test(it.newCitation ?? "") ? it.newCitation : null);
    for (const m of (it.newCitation ?? "").split(";").map((s) => s.trim()).filter((s) => s.includes("→"))) mappings.add(m);
  }

  const issues: DocIssue[] = (compliance?.items ?? [])
    .filter((i) => i.status === "possible_conflict" || i.status === "stale" || i.status === "unverified")
    .sort((a, b) => RANK[b.status] - RANK[a.status])
    .slice(0, DIGEST_LIMITS.issues)
    .map((i) => ({
      itemId: i.id,
      status: i.status,
      line: clip(textById.get(i.id) ?? "", 120),
      newCitation: i.newCitation,
      note: clip(i.note, DIGEST_LIMITS.note),
      topic: i.topic ?? null,
      suggestedFix: i.suggestedFix ? clip(i.suggestedFix, DIGEST_LIMITS.note) : null,
    }));

  // Cross-check: run the deterministic scanner over the parsed lines.
  const agentFlagged = new Set<string>();
  for (const it of compliance?.items ?? []) {
    for (const m of (it.newCitation ?? "").matchAll(/6\d{4}(?:\.\d+)*/g)) agentFlagged.add(m[0]);
    for (const m of it.note.matchAll(/6\d{4}(?:\.\d+)*/g)) if (/renumber|SB 477|deleted|stale/i.test(it.note)) agentFlagged.add(m[0]);
  }
  const scannerOnlyStale = [
    ...new Set(
      scanText(parsed.items.map((i) => `${i.text} ${i.citations.join(" ")}`).join("\n"))
        .filter((r) => r.mapping.status === "stale" && !agentFlagged.has(r.section))
        .map((r) => `${r.section}${r.subdivision ?? ""} → ${r.mapping.current.join(", ")}`),
    ),
  ];

  const pkg = parsed.package;
  const needsUser = !parsed.isChecklist
    ? "This file doesn't look like a city permit checklist."
    : parsed.containsPersonalInfo
      ? "This file contains a private person's details. Remove it, or use a blank form."
      : null;

  return {
    key,
    filename,
    city: parsed.city,
    projectType: parsed.projectType,
    docTitle: clip(parsed.docTitle, 140),
    docDate: parsed.docDate,
    checkedOn: compliance?.checkedOn ?? "",
    itemCount: parsed.items.length,
    statusCounts,
    staleCitations,
    staleMappings: [...mappings].slice(0, 12),
    path: compliance?.path ? { name: compliance.path.name, clock: clip(compliance.path.clock, 160), statute: compliance.path.statute } : null,
    packageGaps: pkg
      ? {
          missing: pkg.filter((p) => p.status === "missing").length,
          inconsistent: pkg.filter((p) => p.status === "inconsistent").length,
          cantTell: pkg.filter((p) => p.status === "cant_tell").length,
        }
      : null,
    issues,
    unverified: (compliance?.unverified ?? []).slice(0, DIGEST_LIMITS.unverified).map((u) => clip(u, 160)),
    scannerOnlyStale,
    needsUser,
  };
}

/** Rough prompt size of a digest, for budgeting (≈4 chars per token). */
export function approxTokens(x: unknown): number {
  return Math.ceil(JSON.stringify(x).length / 4);
}
