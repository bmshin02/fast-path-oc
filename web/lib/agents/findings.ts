// One audit row per checklist line. A line can have several findings (e.g. two stale citations
// and a possible conflict); they're merged into one row so the table reads line by line.
// Used by the compliance guardrails (in case the model repeats an id) and by the producer.

import type { ComplianceResult, ItemStatus } from "./schemas";

type Finding = ComplianceResult["items"][number];

/** Most serious first: the merged row shows the highest-ranked status. */
const RANK: Record<ItemStatus, number> = {
  possible_conflict: 4,
  stale: 3,
  unverified: 2,
  uncited: 1,
  current: 0,
};

const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x && x.trim() !== ""))];

/** Merge every finding for one line into a single row. */
export function mergeFindings(rows: Finding[]): Finding {
  if (rows.length === 1) return rows[0];
  const sorted = [...rows].sort((a, b) => RANK[b.status] - RANK[a.status]);
  const top = sorted[0];
  const citations = uniq(sorted.map((r) => r.newCitation));
  const rules = uniq(sorted.map((r) => r.stateRule));
  const fixes = uniq(sorted.map((r) => r.suggestedFix));
  return {
    id: top.id,
    status: top.status,
    topic: uniq(sorted.map((r) => r.topic)).join(" / "),
    newCitation: citations.length ? citations.join("; ") : null,
    stateRule: rules.length ? rules.join(" ") : null,
    suggestedFix: fixes.length ? fixes.join(" ") : null,
    note: uniq(sorted.map((r) => r.note)).join(" "),
    sourceUrl: top.sourceUrl ?? sorted.find((r) => r.sourceUrl)?.sourceUrl ?? null,
  };
}

/** Group findings by line id (first-seen order) and merge each group. */
export function mergeById(rows: Finding[]): Finding[] {
  const groups = new Map<string, Finding[]>();
  for (const r of rows) groups.set(r.id, [...(groups.get(r.id) ?? []), r]);
  return [...groups.values()].map(mergeFindings);
}

/**
 * How many stale citations a row's newCitation maps, e.g.
 * "65852.2 → 66310–66342; 65852.22 → 66333" is 2. A mapping without an arrow counts as 1.
 */
export function staleCitationCount(newCitation: string | null): number {
  if (!newCitation) return 0;
  return Math.max(1, newCitation.split("→").length - 1);
}
