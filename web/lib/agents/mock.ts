// MOCK DATA for UI work and demos without API calls (MOCK=1). Not produced by the agents.
// Facts are taken from fast-path-check/reference/cities.md and renumbering.md (checked 2026-11-07),
// but the report itself is hand-written, so treat it as a layout fixture, not a result.

import type { FinalReport, ProgressEvent, Report } from "./schemas";

const HANDBOOK = "https://www.hcd.ca.gov/building-standards/adu/handbook";
const CHECKLIST =
  "https://www.anaheim.net/DocumentCenter/View/35053/Accessory-Dwelling-Unit-Submittal-Requirements-Checklist";
const APR = "https://data.ca.gov/dataset/housing-element-annual-progress-report-apr-data-by-jurisdiction-and-year";
const CHECKED = "2026-11-07";

const anaheim: Report = {
  header: {
    city: "Anaheim",
    projectType: "adu",
    docTitle: "[MOCK] Accessory Dwelling Unit Submittal Requirements Checklist (Z412, Nov 2025)",
    checkedOn: CHECKED,
    disclaimer: "Prototype · not legal advice · MOCK DATA",
  },
  trafficLight: { pathFound: true, staleCitations: 2, possibleConflicts: 1, gaps: 0 },
  path: {
    name: "ADU / JADU (ministerial)",
    statute: "Gov. Code 66314–66331 (ADU), 66333 (JADU)",
    clock: "60 days from a complete application",
    sourceUrl: HANDBOOK,
    note: "The checklist publishes no overall review clock; state law sets 60 days. Sewer and meter sign-offs run outside it.",
  },
  stepsAndFees: [
    {
      order: 1,
      step: "Request sewer deficiency verification from Public Works (by email)",
      fee: null,
      time: "up to 4 days",
      outsidePlanningClock: true,
      sourceUrl: CHECKLIST,
    },
    {
      order: 2,
      step: "Meter spot report, if adding, upgrading or moving an electric meter",
      fee: null,
      time: "2–3 business days",
      outsidePlanningClock: true,
      sourceUrl: CHECKLIST,
    },
    { order: 3, step: "New address request", fee: null, time: null, outsidePlanningClock: false, sourceUrl: CHECKLIST },
    {
      order: 4,
      step: "Submit for building plan check",
      fee: "unknown (fee page returns 403)",
      time: "60 days (state clock)",
      outsidePlanningClock: false,
      sourceUrl: HANDBOOK,
    },
    {
      order: 5,
      step: "JADU only: owner-occupancy covenant drafted by the City Attorney and recorded before permit",
      fee: null,
      time: null,
      outsidePlanningClock: false,
      sourceUrl: CHECKLIST,
    },
  ],
  auditTable: [
    {
      itemId: "p1-1",
      line: "Sewer deficiency verification from Public Works (allow up to four days)",
      page: 1,
      cites: [],
      status: "uncited",
      newCitation: null,
      note: "Local utility sign-off; no state authority cited. Runs outside the 60-day planning clock.",
      sourceUrl: CHECKLIST,
    },
    {
      itemId: "p1-2",
      line: "Meter spot report, if adding, upgrading or moving an electric meter",
      page: 1,
      cites: [],
      status: "uncited",
      newCitation: null,
      note: "Local utility sign-off.",
      sourceUrl: CHECKLIST,
    },
    {
      itemId: "p1-4",
      line: "Owner-occupancy covenant ... authorized by California Government Code Sections 65852.2 and 65852.22",
      page: 1,
      cites: ["Gov. Code 65852.2"],
      status: "stale",
      newCitation: "Gov. Code 66310–66342",
      note: "Renumbered by SB 477 (2024).",
      sourceUrl: HANDBOOK,
    },
    {
      itemId: "p1-4b",
      line: "Owner-occupancy covenant ... authorized by California Government Code Sections 65852.2 and 65852.22",
      page: 1,
      cites: ["Gov. Code 65852.22"],
      status: "stale",
      newCitation: "Gov. Code 66333",
      note: "Renumbered by SB 477 (2024).",
      sourceUrl: HANDBOOK,
    },
    {
      itemId: "p1-4c",
      line: "Owner-occupancy covenant required for all JADUs (AMC 18.38.015.110)",
      page: 1,
      cites: ["AMC 18.38.015.110"],
      status: "possible_conflict",
      newCitation: null,
      note: "Gov. 66333(b) requires owner-occupancy only when the JADU shares sanitation with the main house. Possible conflict, confirm with city staff or counsel.",
      sourceUrl: HANDBOOK,
    },
  ],
  timelines: [
    { metric: "ADU building-permit units, 2024 (APR Table A2)", value: "429", source: APR },
    { metric: "ADU building-permit units, 2025 (APR Table A2)", value: "441", source: APR },
  ],
  hcdLetters: {
    letters: [],
    note: "unknown: HCD's enforcement dashboard is an embedded app. Ask HAUportal@hcd.ca.gov for copies.",
  },
  packageGaps: [],
  couldntVerify: [
    "Anaheim ADU fees: fee page returns 403 to automated fetches.",
    "Statute text read live from leginfo: blocked (403); used HCD ADU Handbook (Mar 2026) instead.",
  ],
  markdown: "# [MOCK] Fast Path Check: Anaheim, ADU\n\n**Date checked:** 2026-11-07 · Prototype · not legal advice\n",
};

export const mockReport: FinalReport = { reports: [anaheim], comparison: null };

export const mockEvents: ProgressEvent[] = [
  { type: "progress", agent: "master", message: "[mock] Planning the run" },
  { type: "progress", agent: "parser", message: "[mock] Parsing checklist: 5 lines, 2 citations" },
  { type: "progress", agent: "compliance", message: "[mock] Checking 65852.2 and 65852.22 against HCD ADU Handbook" },
  { type: "progress", agent: "producer", message: "[mock] Writing report" },
];
