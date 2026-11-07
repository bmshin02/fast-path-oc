// Score an audit against HCD's own findings (data/hcd-findings.json).
//
// HCD's letters are the state agency's expert findings on a city's ADU ordinance, so they make
// a real answer key. HCD reviewed the ORDINANCE, though, and we usually audit a CHECKLIST, so a
// finding only counts toward recall when its subject actually appears in the audited document.
// Anything we flag that HCD didn't is reported as "extra", not as an error: HCD's letter isn't
// an exhaustive list, and the checklist may contain things the ordinance doesn't.

import type { ScanResult } from "./citations";

export type Detect = { staleSections?: string[]; keywords?: string[] };
export type HcdFinding = {
  id: string;
  topic: string;
  localSection: string | null;
  statutes: string[];
  summary: string;
  detect: Detect;
};
export type HcdLetter = {
  id: string;
  city: string;
  date: string;
  kind: string;
  reviewed: string;
  url: string;
  findings: HcdFinding[];
};
export type HcdKey = { about: string; checkedOn: string; letters: HcdLetter[] };

/** A flag raised by our audit, normalized from either the scanner or the compliance agent. */
export type AuditFlag = {
  source: "scanner" | "agent";
  status: string; // stale | possible_conflict | uncited | current | unverified
  section?: string; // for stale citations
  text: string; // note + new citation, searched for keywords
};

export type FindingScore = {
  id: string;
  topic: string;
  inScope: boolean;
  caught: boolean;
  matchedBy: string[];
};

export type Score = {
  letter: { id: string; city: string; date: string; url: string };
  findings: FindingScore[];
  inScope: number;
  caught: number;
  recall: number | null; // caught / inScope
  extras: AuditFlag[];
};

const FLAGGING = new Set(["stale", "possible_conflict"]);

function rx(k: string): RegExp {
  return new RegExp(k, "i");
}

/** Is the finding's subject present in the audited document? */
export function inScope(f: HcdFinding, documentText: string | null): boolean {
  if (documentText === null) return true;
  const sections = f.detect.staleSections ?? [];
  if (sections.some((s) => new RegExp(`\\b${s.replace(".", "\\.")}\\b`).test(documentText))) return true;
  return (f.detect.keywords ?? []).some((k) => rx(k).test(documentText));
}

function matches(f: HcdFinding, flag: AuditFlag): boolean {
  if (!FLAGGING.has(flag.status)) return false;
  if (flag.status === "stale" && flag.section && f.detect.staleSections?.includes(flag.section)) return true;
  // The agent reports one row per checklist line under its most serious status, so a stale
  // citation can sit inside a "possible_conflict" row. Credit it when the note says so.
  const mentionsStale = (f.detect.staleSections ?? []).some((s) => new RegExp(`\\b${s.replace(".", "\\.")}\\b`).test(flag.text));
  if (mentionsStale && (flag.status === "stale" || /renumber|SB 477|deleted/i.test(flag.text))) return true;
  return (f.detect.keywords ?? []).some((k) => rx(k).test(flag.text));
}

export function flagsFromScan(results: ScanResult[]): AuditFlag[] {
  return results.map((r) => ({
    source: "scanner" as const,
    status: r.mapping.status,
    section: r.section,
    text: `${r.mapping.citation} ${r.mapping.note}`,
  }));
}

type ComplianceLike = { items: Array<{ status: string; newCitation: string | null; note: string }> };

export function flagsFromCompliance(c: ComplianceLike): AuditFlag[] {
  return c.items.map((i) => ({
    source: "agent" as const,
    status: i.status,
    text: `${i.newCitation ?? ""} ${i.note}`,
  }));
}

export function scoreAudit(letter: HcdLetter, flags: AuditFlag[], documentText: string | null): Score {
  const used = new Set<AuditFlag>();
  const findings = letter.findings.map((f) => {
    const scope = inScope(f, documentText);
    const hits = flags.filter((fl) => matches(f, fl));
    hits.forEach((h) => used.add(h));
    return {
      id: f.id,
      topic: f.topic,
      inScope: scope,
      caught: hits.length > 0,
      matchedBy: hits.map((h) => `${h.source}:${h.status}${h.section ? `:${h.section}` : ""}`),
    };
  });
  const scoped = findings.filter((f) => f.inScope);
  const caught = scoped.filter((f) => f.caught).length;
  return {
    letter: { id: letter.id, city: letter.city, date: letter.date, url: letter.url },
    findings,
    inScope: scoped.length,
    caught,
    recall: scoped.length ? caught / scoped.length : null,
    extras: flags.filter((f) => FLAGGING.has(f.status) && !used.has(f)),
  };
}

export function formatScore(s: Score): string {
  const lines = [
    `HCD letter ${s.letter.id} (${s.letter.city}, ${s.letter.date})`,
    `  ${s.letter.url}`,
    `  In scope for this document: ${s.inScope} of ${s.findings.length} findings. Caught: ${s.caught}.` +
      (s.recall === null ? "" : ` Recall: ${Math.round(s.recall * 100)}%.`),
  ];
  for (const f of s.findings) {
    const mark = !f.inScope ? "  ·" : f.caught ? "  ✓" : "  ✗";
    lines.push(`${mark} ${f.id} ${f.topic}${f.inScope ? "" : " (not in this document)"}${f.matchedBy.length ? `  ← ${f.matchedBy.join(", ")}` : ""}`);
  }
  if (s.extras.length) {
    lines.push(`  Flags HCD's letter doesn't cover (${s.extras.length}): not errors, just outside this letter:`);
    for (const e of s.extras) lines.push(`    - ${e.source}:${e.status} ${e.text.slice(0, 140)}`);
  }
  return lines.join("\n");
}
