// Roll up many document digests into one batch summary, in code. No model call: the numbers
// are counts over the digests, so they can't be invented, and the cost doesn't grow with the
// number of files. Shared by browser and server.

import type { ItemStatus } from "../agents/schemas";
import { emptyCounts, type DocDigest } from "./digest";

export type BatchSummary = {
  documents: number;
  needsUser: { key: string; filename: string; reason: string }[];
  totals: Record<ItemStatus, number> & { staleCitations: number; items: number };
  byCity: {
    city: string;
    documents: number;
    staleCitations: number;
    possibleConflicts: number;
    paths: string[];
  }[];
  /** The same stale mapping across many files, most common first. */
  recurringStale: { mapping: string; documents: number; files: string[] }[];
  /** Files to look at first: most possible conflicts, then most stale citations. */
  attention: { key: string; filename: string; city: string; possibleConflicts: number; staleCitations: number }[];
  /** Stale citations the deterministic scanner found that the agent didn't flag, by file. */
  scannerDisagreements: { filename: string; mappings: string[] }[];
  checkedOn: string[];
};

export function aggregate(digests: DocDigest[]): BatchSummary {
  const ok = digests.filter((d) => !d.needsUser);
  const totals = { ...emptyCounts(), staleCitations: 0, items: 0 };
  const cities = new Map<string, BatchSummary["byCity"][number]>();
  const stale = new Map<string, Set<string>>();

  for (const d of ok) {
    for (const k of Object.keys(d.statusCounts) as ItemStatus[]) totals[k] += d.statusCounts[k];
    totals.staleCitations += d.staleCitations;
    totals.items += d.itemCount;

    const c = cities.get(d.city) ?? { city: d.city, documents: 0, staleCitations: 0, possibleConflicts: 0, paths: [] };
    c.documents++;
    c.staleCitations += d.staleCitations;
    c.possibleConflicts += d.statusCounts.possible_conflict;
    if (d.path && !c.paths.includes(`${d.path.name} (${d.path.clock})`)) c.paths.push(`${d.path.name} (${d.path.clock})`);
    cities.set(d.city, c);

    for (const m of d.staleMappings) {
      const norm = m.replace(/\s+/g, " ");
      stale.set(norm, (stale.get(norm) ?? new Set()).add(d.filename));
    }
  }

  return {
    documents: digests.length,
    needsUser: digests.filter((d) => d.needsUser).map((d) => ({ key: d.key, filename: d.filename, reason: d.needsUser! })),
    totals,
    byCity: [...cities.values()].sort((a, b) => b.documents - a.documents || a.city.localeCompare(b.city)),
    recurringStale: [...stale.entries()]
      .map(([mapping, files]) => ({ mapping, documents: files.size, files: [...files].slice(0, 20) }))
      .sort((a, b) => b.documents - a.documents)
      .slice(0, 15),
    attention: ok
      .map((d) => ({
        key: d.key,
        filename: d.filename,
        city: d.city,
        possibleConflicts: d.statusCounts.possible_conflict,
        staleCitations: d.staleCitations,
      }))
      .filter((a) => a.possibleConflicts + a.staleCitations > 0)
      .sort((a, b) => b.possibleConflicts - a.possibleConflicts || b.staleCitations - a.staleCitations)
      .slice(0, 10),
    scannerDisagreements: ok.filter((d) => d.scannerOnlyStale.length).map((d) => ({ filename: d.filename, mappings: d.scannerOnlyStale })),
    checkedOn: [...new Set(ok.map((d) => d.checkedOn).filter(Boolean))].sort(),
  };
}
