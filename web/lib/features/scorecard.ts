// County-wide ADU scorecard: joins APR timelines (data/oc-adu-apr.json) with HCD letters
// (data/oc-hcd-letters.json) into one row per Orange County jurisdiction.
//
// Pure functions; scripts/oc-scorecard.ts reads the data files and writes the outputs.

import type { CitySummary } from "./apr";

export type HcdLetterRef = { date: string; kind: string; url: string; summary: string };

export type ScorecardRow = {
  jurisdiction: string;
  adu: {
    permitUnitsTotal: number | null;
    permitUnitsLatestYear: { year: number; units: number } | null;
    coUnitsTotal: number | null;
    permitToCoMedianDays: number | null;
    permitToCoN: number;
  };
  hcd: {
    letters: number;
    latest: HcdLetterRef | null;
    latestKind: string | null;
    enforcement: boolean; // a notice of (potential) violation on record
    formalFindings: number;
    closedCompliant: boolean; // HCD closed the matter as compliant in its latest letter
  };
  flags: string[];
};

const ENFORCEMENT = new Set(["notice_of_violation", "notice_of_potential_violation"]);

export function buildScorecard(
  apr: CitySummary[],
  letters: Record<string, HcdLetterRef[]>,
): ScorecardRow[] {
  const byCity = new Map(apr.map((c) => [c.city, c]));
  const names = new Set([...byCity.keys(), ...Object.keys(letters)]);
  const rows: ScorecardRow[] = [];
  for (const j of [...names].sort()) {
    const a = byCity.get(j) ?? null;
    const ls = [...(letters[j] ?? [])].sort((x, y) => x.date.localeCompare(y.date));
    const latest = ls.length ? ls[ls.length - 1] : null;
    const latestYear = a?.latestYear ?? null;
    const flags: string[] = [];

    if (!a) flags.push("No ADU rows in APR Table A2.");
    else {
      if (a.permitUnitsTotal > 0 && a.coUnitsTotal === 0) flags.push("Reports ADU permits but zero certificates of occupancy: likely a reporting gap.");
      if (a.permitToCo.n > 0 && a.permitToCo.n < 10) flags.push(`Permit→CO median rests on only ${a.permitToCo.n} project${a.permitToCo.n === 1 ? "" : "s"}.`);
      if (a.permitToCo.median === 0) flags.push("Median permit→CO of 0 days: dates look copied, not real milestones.");
    }
    if (ls.some((l) => ENFORCEMENT.has(l.kind))) flags.push("HCD enforcement letter on record.");
    if (!ls.length) flags.push("No HCD ADU letter found (that doesn't mean none exists).");
    if (latest?.kind === "technical_assistance" && /2020/.test(latest.summary)) flags.push("HCD says the ordinance on file dates from 2020.");

    rows.push({
      jurisdiction: j,
      adu: {
        permitUnitsTotal: a?.permitUnitsTotal ?? null,
        permitUnitsLatestYear:
          a && latestYear !== null ? { year: latestYear, units: a.permitUnitsByYear[String(latestYear)] ?? 0 } : null,
        coUnitsTotal: a?.coUnitsTotal ?? null,
        permitToCoMedianDays: a?.permitToCo.median ?? null,
        permitToCoN: a?.permitToCo.n ?? 0,
      },
      hcd: {
        letters: ls.length,
        latest,
        latestKind: latest?.kind ?? null,
        enforcement: ls.some((l) => ENFORCEMENT.has(l.kind)),
        formalFindings: ls.filter((l) => l.kind === "findings").length,
        closedCompliant: latest?.kind === "compliance",
      },
      flags,
    });
  }
  return rows;
}

export function scorecardMarkdown(rows: ScorecardRow[], fetchedOn: string): string {
  const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-US"));
  const head = [
    "| Jurisdiction | ADU permits (all years) | Latest year | Median permit→CO (days, n) | HCD letters | Latest HCD letter | Notes |",
    "|---|---:|---|---|---:|---|---|",
  ];
  const body = rows.map((r) => {
    const ly = r.adu.permitUnitsLatestYear ? `${r.adu.permitUnitsLatestYear.units} in ${r.adu.permitUnitsLatestYear.year}` : "—";
    const med = r.adu.permitToCoMedianDays === null ? "—" : `${r.adu.permitToCoMedianDays} (n=${r.adu.permitToCoN})`;
    const latest = r.hcd.latest ? `[${r.hcd.latest.date} ${r.hcd.latest.kind.replace(/_/g, " ")}](${r.hcd.latest.url})` : "none found";
    const name = r.jurisdiction.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    return `| ${name} | ${fmt(r.adu.permitUnitsTotal)} | ${ly} | ${med} | ${r.hcd.letters} | ${latest} | ${r.flags.join(" ")} |`;
  });
  return [...head, ...body].join("\n") + `\n\n*APR data fetched ${fetchedOn}; HCD letters checked 2026-11-07.*\n`;
}
