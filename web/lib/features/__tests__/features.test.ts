// Unit tests for the deterministic features. No network, no API key.
//   cd web && npx tsx --test lib/features/__tests__/*.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { extractCitations, mapCitation, scanText, summarize } from "../citations";
import {
  addBusinessDays,
  computeClock,
  federalHolidays,
  makeCalendar,
} from "../shot-clock";
import { draftCompletenessLetter } from "../completeness-letter";
import { delayCost } from "../delay-cost";
import { daysBetween, median, mergeProjects, percentile, summarizeCity, type AprRow } from "../apr";

// ---------- citations ----------

test("extracts the two stale citations from Anaheim's checklist wording", () => {
  const text =
    "AMC Section 18.38.015.110 requires the recordation of an owner occupancy covenant for all JADUs, authorized by the California Government Code\nSections 65852.2 and 65852.22. The covenant...";
  const r = scanText(text);
  assert.deepEqual(
    r.map((x) => x.section),
    ["65852.2", "65852.22"],
  );
  assert.equal(summarize(r).stale, 2);
  assert.deepEqual(r[0].mapping.current, ["66314–66331"]);
  assert.deepEqual(r[1].mapping.current, ["66333–66339"]);
});

test("ignores municipal code, phone numbers, ZIP codes and non-6xxxx section numbers", () => {
  const r = extractCitations("AMC Section 18.38.015, call (714) 765-5139, Anaheim CA 92805, Section 12345, fee $65852.");
  assert.equal(r.length, 0);
});

test("maps subdivisions through HCD's table, including 2025 renumbers", () => {
  assert.deepEqual(mapCitation("65852.2", "(a)(3)").current, ["66317"]);
  assert.deepEqual(mapCitation("65852.2", "(a)(8)").current, ["66315"]);
  assert.deepEqual(mapCitation("65852.2", "(a)(10)").current, ["66319", "66342"]);
  const f = mapCitation("65852.2", "(f)");
  assert.deepEqual(f.current, ["66311.5"]);
  assert.equal(f.chain.length, 3);
  assert.deepEqual(mapCitation("65852.23").current, ["66311.7"]);
  assert.deepEqual(mapCitation("65852.26", "(a)").current, ["66341"]);
  assert.deepEqual(mapCitation("65852.26", "(b)").current, ["66340"]);
  assert.deepEqual(mapCitation("65852.22", "(g)").current, ["66338"]);
  assert.deepEqual(mapCitation("66327").current, ["66313.5"]);
});

test("current and unknown sections", () => {
  assert.equal(mapCitation("66317").status, "current");
  assert.equal(mapCitation("65852.21").status, "current");
  assert.equal(mapCitation("65912.120").status, "current");
  assert.equal(mapCitation("66499.41").status, "unverified"); // several versions on leginfo
  const u = mapCitation("65852.99");
  assert.equal(u.status, "unverified");
  assert.deepEqual(u.current, []); // never guesses
});

test("handles lists, ranges and § forms", () => {
  const r = extractCitations("See Gov. Code §§ 65852.2(a)(1)(A), 65852.22 and 66314 through 66331; also G.C. 65852.26(b).");
  assert.deepEqual(
    r.map((x) => `${x.section}${x.subdivision ?? ""}`),
    ["65852.2(a)(1)(A)", "65852.22", "66314", "66331", "65852.26(b)"],
  );
});

test("finds both stale citations in the real Anaheim fixture text, if pdftotext output is present", (t) => {
  const p = path.join(__dirname, "..", "..", "..", "..", "evals", "fixtures", "anaheim-adu-checklist-z412-nov-2025.txt");
  if (!fs.existsSync(p)) return t.skip("text extract not present");
  const r = scanText(fs.readFileSync(p, "utf8"));
  assert.deepEqual(
    r.map((x) => [x.section, x.mapping.status]),
    [
      ["65852.2", "stale"],
      ["65852.22", "stale"],
    ],
  );
});

// ---------- shot clock ----------

test("federal holidays for 2026 use observed dates", () => {
  const h = federalHolidays(2026);
  assert.ok(h.includes("2026-07-03")); // July 4 is a Saturday
  assert.ok(h.includes("2026-11-11")); // Veterans Day
  assert.ok(h.includes("2026-11-26")); // Thanksgiving
  assert.ok(h.includes("2026-01-19")); // MLK Day
  assert.ok(h.includes("2026-05-25")); // Memorial Day
});

test("15 business days skips weekends and Veterans Day", () => {
  const cal = makeCalendar(2026, 2027);
  assert.equal(addBusinessDays("2026-11-02", 15, cal), "2026-11-24");
  // Extra city closure (e.g. day after Thanksgiving) pushes a later deadline.
  const cal2 = makeCalendar(2026, 2027, ["2026-11-27"]);
  assert.equal(addBusinessDays("2026-11-16", 10, cal2), "2026-12-02");
  assert.equal(addBusinessDays("2026-11-16", 10, cal), "2026-12-01");
});

test("complete on time: 60 days from receipt", () => {
  const r = computeClock({
    submissions: [{ received: "2026-11-02", noticeDate: "2026-11-20", noticeResult: "complete" }],
    existingDwelling: true,
    today: "2026-12-01",
  });
  assert.equal(r.rounds[0].completenessDeadline, "2026-11-24");
  assert.equal(r.completeOn, "2026-11-02");
  assert.equal(r.decisionDeadline, "2027-01-01");
  assert.equal(r.status, "in_review");
  assert.equal(r.daysLeft, 31);
  assert.equal(r.flags.length, 0);
});

test("no notice by the deadline: deemed complete", () => {
  const r = computeClock({
    submissions: [{ received: "2026-11-02" }],
    existingDwelling: true,
    today: "2026-11-30",
  });
  assert.equal(r.rounds[0].outcome, "deemed_complete");
  assert.ok(r.flags.some((f) => f.code === "no_completeness_notice"));
  assert.equal(r.decisionDeadline, "2027-01-01");
});

test("still inside the 15 days: awaiting completeness with days left", () => {
  const r = computeClock({ submissions: [{ received: "2026-11-02" }], existingDwelling: true, today: "2026-11-10" });
  assert.equal(r.status, "awaiting_completeness");
  assert.equal(r.daysLeft, 14);
});

test("late notice is deemed complete; new items on resubmittal are flagged", () => {
  const r = computeClock({
    submissions: [
      { received: "2026-03-02", noticeDate: "2026-03-13", noticeResult: "incomplete", listedItems: ["soils report"] },
      {
        received: "2026-04-01",
        noticeDate: "2026-05-15",
        noticeResult: "incomplete",
        listedItems: ["grading plan"],
        newItemsRequested: ["grading plan"],
      },
    ],
    existingDwelling: true,
    today: "2026-05-20",
  });
  assert.equal(r.rounds[0].outcome, "incomplete");
  assert.equal(r.rounds[1].outcome, "deemed_complete"); // notice after 15 business days
  assert.ok(r.flags.some((f) => f.code === "new_items_on_resubmittal"));
  assert.ok(r.flags.some((f) => f.code === "late_completeness_notice"));
  assert.equal(r.completeOn, "2026-04-01");
  assert.equal(r.decisionDeadline, "2026-05-31");
});

test("past 60 days with no decision: possible deemed approval; tolling extends", () => {
  const base = {
    submissions: [{ received: "2026-01-05", noticeDate: "2026-01-12", noticeResult: "complete" as const }],
    existingDwelling: true,
    today: "2026-03-20",
  };
  const r = computeClock(base);
  assert.equal(r.decisionDeadline, "2026-03-06");
  assert.equal(r.status, "deemed_approved_possible");
  const t = computeClock({ ...base, tolledDays: 30 });
  assert.equal(t.decisionDeadline, "2026-04-05");
  assert.equal(t.status, "in_review");
});

test("ADU submitted with a new home: clock may wait", () => {
  const r = computeClock({
    submissions: [{ received: "2026-01-05", noticeDate: "2026-01-12", noticeResult: "complete" }],
    existingDwelling: false,
    submittedWithNewDwelling: true,
    today: "2026-04-01",
  });
  assert.equal(r.status, "clock_may_wait_for_main_dwelling");
  assert.equal(r.decisionDeadline, null);
});

test("rejects bad dates", () => {
  assert.throws(() => computeClock({ submissions: [{ received: "2026-02-30" }], existingDwelling: true, today: "2026-03-01" }));
  assert.throws(() => computeClock({ submissions: [], existingDwelling: true, today: "2026-03-01" }));
});

// ---------- completeness letter ----------

test("letter cites the right subdivisions and uses placeholders, not personal data", () => {
  const l = draftCompletenessLetter({
    city: "Anaheim",
    projectLabel: "detached ADU",
    submissions: [
      { received: "2026-03-02", noticeDate: "2026-03-13", noticeResult: "incomplete", listedItems: ["soils report"] },
      { received: "2026-04-01", newItemsRequested: ["fire plan"] },
    ],
    existingDwelling: true,
    today: "2026-05-01",
  });
  assert.equal(l.applies, true);
  assert.match(l.body, /66317\(a\)\(2\)\(D\)/);
  assert.match(l.body, /66317\(a\)\(2\)\(F\)/);
  assert.match(l.body, /\[PROPERTY ADDRESS\]/);
  assert.match(l.body, /Not legal advice/);
  assert.match(l.subject, /^Detached ADU application/);
});

test("no letter when the city is on time", () => {
  const l = draftCompletenessLetter({
    city: "Irvine",
    submissions: [{ received: "2026-11-02", noticeDate: "2026-11-05", noticeResult: "complete" }],
    existingDwelling: true,
    today: "2026-11-20",
  });
  assert.equal(l.applies, false);
});

// ---------- delay cost ----------

test("delay cost matches the mentor's framework", () => {
  const flip = delayCost({ price: 1_000_000, monthsOfDelay: 12, targetProfit: 300_000 });
  assert.equal(flip.loan, 800_000);
  assert.equal(flip.monthlyInterest, 4867);
  assert.equal(flip.totalCost, 58_400);
  assert.equal(flip.amortizingPayment, 5485);
  assert.equal(flip.monthsToEraseProfit, 62);
  const home = delayCost({ price: 535_000, monthsOfDelay: 48 });
  assert.equal(home.monthlyInterest, 2604);
  assert.equal(home.totalCost, 124_976);
  assert.throws(() => delayCost({ price: 0, monthsOfDelay: 1 }));
});

// ---------- APR ----------

const row = (o: Partial<AprRow>): AprRow => ({
  JURIS_NAME: "TESTVILLE",
  YEAR: 2024,
  APN: null,
  STREET_ADDRESS: null,
  JURS_TRACKING_ID: null,
  ENT_APPROVE_DT1: null,
  BP_ISSUE_DT1: null,
  CO_ISSUE_DT1: null,
  NO_BUILDING_PERMITS: 0,
  CO_UNITS: 0,
  ...o,
});

test("merges the same project across reporting years and measures permit → CO", () => {
  const rows = [
    row({ YEAR: 2023, JURS_TRACKING_ID: "BLD-1", BP_ISSUE_DT1: "2023-03-01", NO_BUILDING_PERMITS: 1 }),
    row({ YEAR: 2024, JURS_TRACKING_ID: "bld-1 ", CO_ISSUE_DT1: "2024-01-01", CO_UNITS: 1 }),
    row({ YEAR: 2024, APN: "123-45", BP_ISSUE_DT1: "2024-02-01", CO_ISSUE_DT1: "2024-08-01", NO_BUILDING_PERMITS: 1, CO_UNITS: 1 }),
    row({ YEAR: 2024, STREET_ADDRESS: "1 Main", BP_ISSUE_DT1: "2024-05-01", CO_ISSUE_DT1: "2010-01-01" }), // negative: dropped
  ];
  assert.equal(mergeProjects(rows).length, 3);
  const s = summarizeCity("TESTVILLE", rows);
  assert.equal(s.projects, 3);
  assert.equal(s.permitToCo.n, 2);
  assert.deepEqual(s.permitUnitsByYear, { "2023": 1, "2024": 1 });
  assert.equal(s.coUnitsTotal, 2);
  assert.equal(s.latestYear, 2024);
  assert.equal(daysBetween("2023-03-01", "2024-01-01"), 306);
});

test("median and percentile", () => {
  assert.equal(median([]), null);
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([1, 2, 3, 4]), 3); // rounds 2.5 up
  assert.equal(percentile([10, 20, 30, 40], 25), 10);
  assert.equal(percentile([10, 20, 30, 40], 75), 30);
});
