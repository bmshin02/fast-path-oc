// Tests for the HCD scorer, the OC scorecard and the source monitor, plus integrity checks
// on the committed data files. No network.
//   cd web && npx tsx --test lib/features/__tests__/*.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { scanText } from "../citations";
import { flagsFromCompliance, flagsFromScan, inScope, scoreAudit, type HcdKey } from "../hcd-score";
import { buildScorecard } from "../scorecard";
import { compare, SOURCES, type Baseline, type Observation } from "../source-monitor";
import type { CitySummary } from "../apr";

const repo = path.join(__dirname, "..", "..", "..", "..");
const readJson = <T,>(p: string): T => JSON.parse(fs.readFileSync(path.join(repo, p), "utf8")) as T;

// ---------- HCD answer key ----------

test("HCD key: both letters present, ids unique, every finding has a detector", () => {
  const key = readJson<HcdKey>("data/hcd-findings.json");
  assert.deepEqual(
    key.letters.map((l) => l.id),
    ["anaheim-2025-03-24", "irvine-2025-01-07"],
  );
  assert.equal(key.letters[0].findings.length, 17);
  assert.equal(key.letters[1].findings.length, 14);
  for (const l of key.letters) {
    const ids = l.findings.map((f) => f.id);
    assert.equal(new Set(ids).size, ids.length, `${l.id} has duplicate finding ids`);
    for (const f of l.findings) {
      assert.ok((f.detect.staleSections?.length ?? 0) + (f.detect.keywords?.length ?? 0) > 0, `${l.id} ${f.id} has no detector`);
      for (const k of f.detect.keywords ?? []) assert.doesNotThrow(() => new RegExp(k, "i"), `${f.id} bad regex ${k}`);
    }
  }
});

test("scanner alone catches HCD's in-scope finding on Anaheim's checklist, with no false scope", () => {
  const key = readJson<HcdKey>("data/hcd-findings.json");
  const text = fs.readFileSync(path.join(repo, "evals/fixtures/anaheim-adu-checklist-z412-nov-2025.txt"), "utf8");
  const s = scoreAudit(key.letters[0], flagsFromScan(scanText(text)), text);
  assert.equal(s.inScope, 1); // only the statutory-numbering finding appears in the checklist
  assert.equal(s.caught, 1);
  assert.equal(s.recall, 1);
  assert.equal(s.findings.find((f) => f.id === "ADU-1")?.caught, true);
  // "SEWER DEFICIENCY" must not pull the approval/denial finding into scope.
  assert.equal(s.findings.find((f) => f.id === "ADU-10")?.inScope, false);
});

test("agent rows using the most-serious status still get credit for stale citations", () => {
  const key = readJson<HcdKey>("data/hcd-findings.json");
  const flags = flagsFromCompliance({
    items: [{ status: "possible_conflict", newCitation: "65852.2 → 66310–66342", note: "Renumbered by SB 477; also owner-occupancy looks stricter than 66333(b)." }],
  });
  const s = scoreAudit(key.letters[0], flags, null); // null text: every finding in scope
  assert.equal(s.findings.find((f) => f.id === "ADU-1")?.caught, true);
  assert.equal(s.inScope, 17);
});

test("Irvine: keyword findings match agent notes", () => {
  const key = readJson<HcdKey>("data/hcd-findings.json");
  const irvine = key.letters[1];
  const flags = flagsFromCompliance({
    items: [
      { status: "possible_conflict", newCitation: null, note: "Recorded covenant on every ADU looks like a deed restriction, which Gov 66315 prohibits." },
      { status: "possible_conflict", newCitation: null, note: "120-day review exceeds the 60 days in Gov 66317." },
      { status: "current", newCitation: null, note: "Mentions parking." }, // not a flagging status: ignored
    ],
  });
  const s = scoreAudit(irvine, flags, null);
  assert.equal(s.findings.find((f) => f.id === "ADU-5")?.caught, true);
  assert.equal(s.findings.find((f) => f.id === "ADU-6")?.caught, true);
  assert.equal(s.findings.find((f) => f.id === "ADU-13")?.caught, false);
  assert.equal(inScope(irvine.findings[0], "nothing relevant here"), false);
});

// ---------- OC letters + scorecard ----------

type Letters = { jurisdictions: Record<string, Array<{ date: string; kind: string; url: string; summary: string }>> };

test("OC letters file: 35 jurisdictions, valid dates, kinds and hcd.ca.gov URLs", () => {
  const d = readJson<Letters>("data/oc-hcd-letters.json");
  const names = Object.keys(d.jurisdictions);
  assert.equal(names.length, 35); // 34 cities + unincorporated Orange County
  const kinds = new Set(["findings", "technical_assistance", "notice_of_potential_violation", "notice_of_violation", "compliance", "city_response", "findings_response"]);
  for (const [j, ls] of Object.entries(d.jurisdictions)) {
    for (const l of ls) {
      assert.match(l.date, /^\d{4}-\d{2}-\d{2}$/, `${j} date`);
      assert.ok(kinds.has(l.kind), `${j} kind ${l.kind}`);
      assert.match(l.url, /^https:\/\/www\.hcd\.ca\.gov\/.+\.pdf$/, `${j} url`);
    }
  }
  assert.equal(names.filter((n) => d.jurisdictions[n].length > 0).length, 25);
});

test("scorecard joins APR + letters and raises data-quality flags", () => {
  const apr: CitySummary[] = [
    {
      city: "ALPHA",
      rows: 10,
      projects: 8,
      permitUnitsByYear: { "2024": 5, "2025": 6 },
      coUnitsByYear: { "2024": 0, "2025": 0 },
      permitUnitsTotal: 11,
      coUnitsTotal: 0,
      permitToCo: { n: 0, median: null, p25: null, p75: null },
      entitlementToPermit: { n: 0, median: null, p25: null, p75: null },
      latestYear: 2025,
    },
  ];
  const rows = buildScorecard(apr, {
    ALPHA: [{ date: "2024-01-01", kind: "notice_of_violation", url: "u", summary: "s" }],
    BETA: [{ date: "2025-12-05", kind: "technical_assistance", url: "u", summary: "Ordinance on file is from 2020." }],
  });
  assert.equal(rows.length, 2);
  const a = rows[0];
  assert.equal(a.adu.permitUnitsLatestYear?.units, 6);
  assert.equal(a.hcd.enforcement, true);
  assert.ok(a.flags.some((f) => /zero certificates/.test(f)));
  const b = rows[1];
  assert.equal(b.adu.permitUnitsTotal, null);
  assert.ok(b.flags.some((f) => /dates from 2020/.test(f)));
});

// ---------- source monitor ----------

test("source monitor: detects content changes, new 200s on blocked sites, and errors", () => {
  const obs = (id: string, o: Partial<Observation> = {}): Observation => ({ id, status: 200, ...o });
  const baseline: Baseline = {
    checkedOn: "2026-11-07",
    observations: {
      "hcd-adu-handbook": obs("hcd-adu-handbook", { sha256: "aaa" }),
      "apr-dataset": obs("apr-dataset", { lastModified: "2026-11-06" }),
    },
  };
  const current = SOURCES.map((s) => {
    if (s.id === "hcd-adu-handbook") return obs(s.id, { sha256: "bbb" });
    if (s.id === "apr-dataset") return obs(s.id, { lastModified: "2026-11-06" });
    if (s.id === "anaheim-adu-checklist") return obs(s.id, { status: 200 });
    if (s.id === "leginfo-66317") return obs(s.id, { status: 0, error: "timeout" });
    return obs(s.id, { status: s.expect ?? 200 });
  });
  const c = Object.fromEntries(compare(SOURCES, current, baseline).map((x) => [x.id, x]));
  assert.equal(c["hcd-adu-handbook"].level, "changed");
  assert.equal(c["apr-dataset"].level, "ok");
  assert.equal(c["anaheim-adu-checklist"].level, "unexpected_status");
  assert.match(c["anaheim-adu-checklist"].message, /good news/);
  assert.equal(c["leginfo-66317"].level, "error");
  assert.equal(c["hcd-fact-sheets"].level, "new");
});
