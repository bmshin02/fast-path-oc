// MOCK DATA for UI work and demos without API calls (MOCK=1). Not produced by the agents.
// Facts are taken from fast-path-check/reference/cities.md and renumbering.md (checked 2026-11-07),
// but the report itself is hand-written, so treat it as a layout fixture, not a result.

import type { FinalReport, ProgressEvent, Report } from "./schemas";

// leginfo sections hand-checked in a browser 2026-11-07 (fast-path-check/reference/sources.md).
const LEGINFO = (n: string) => `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=${n}.`;
const HCD_LETTER =
  "https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/anaheim-adu-sb9-findings-032425.pdf";
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
    statute: "Gov. Code 66317 (permit clock); 66314–66331 (ADU), 66333 (JADU)",
    clock:
      "15 business days to decide completeness (with a list of every missing item), then 60 days from a complete application to approve or deny",
    sourceUrl: LEGINFO("66317"),
    note: "The checklist publishes no overall review clock; Gov 66317 sets one. If the city misses either deadline, the application is deemed complete or approved. Sewer and meter sign-offs run outside it.",
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
      time: "15 business days to decide completeness, then 60 days to approve or deny (Gov 66317)",
      outsidePlanningClock: false,
      sourceUrl: LEGINFO("66317"),
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
      note: "Local utility sign-off; no state authority cited. Runs outside the Gov 66317 clock.",
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
      line: "JADUs only: owner-occupancy covenant, required by AMC 18.38.015.110 and authorized by the California Government Code Sections 65852.2 and 65852.22. Drafted by the City Attorney and recorded before permit issuance.",
      page: 1,
      cites: ["AMC 18.38.015.110", "Gov. Code 65852.2", "Gov. Code 65852.22"],
      status: "possible_conflict",
      newCitation: "65852.2 → 66310–66342; 65852.22 → 66333",
      note: "Both state citations were renumbered by SB 477 (2024), and HCD's 3/24/25 letter told Anaheim to replace them. Requiring owner-occupancy for all JADUs looks stricter than Gov. 66333(b), which applies it only when the JADU shares sanitation with the main house. Possible conflict, confirm with city staff or counsel.",
      sourceUrl: LEGINFO("66333"),
    },
  ],
  timelines: [
    { metric: "ADU building-permit units, 2024 (APR Table A2)", value: "429", source: APR },
    { metric: "ADU building-permit units, 2025 (APR Table A2)", value: "441", source: APR },
  ],
  hcdLetters: {
    letters: [
      {
        title: "HCD findings on Anaheim ADU Ord. 6570 and SB 9 Ord. 6524 (Finding 1: replace deleted sections 65852.2, 65852.22, 65852.26)",
        date: "2025-03-24",
        url: HCD_LETTER,
      },
    ],
    note: "HCD told Anaheim on 3/24/25 to stop citing the deleted 65852.2 and 65852.22. The Nov 2025 checklist still cites both. The letter didn't raise the JADU owner-occupancy covenant. Not checked: whether Anaheim has amended its ordinance since.",
  },
  packageGaps: [],
  couldntVerify: [
    "Anaheim ADU fees: fee page returns 403 to automated fetches.",
    "Statute text not read live today: leginfo blocks automated fetches (403). Gov 66317 and 66333 were hand-checked in a browser on 2026-11-07.",
  ],
  markdown: "# [MOCK] Fast Path Check: Anaheim, ADU\n\n**Date checked:** 2026-11-07 · Prototype · not legal advice\n",
};

export const mockReport: FinalReport = { reports: [anaheim], comparison: null };

export const mockEvents: ProgressEvent[] = [
  { type: "progress", agent: "master", message: "[mock] Planning the run" },
  { type: "progress", agent: "parser", message: "[mock] Parsing checklist: 5 lines, 2 citations" },
  { type: "progress", agent: "compliance", message: "[mock] Checking 65852.2 and 65852.22 against HCD's conversion table and its 3/24/25 Anaheim letter" },
  { type: "progress", agent: "producer", message: "[mock] Writing report" },
];
