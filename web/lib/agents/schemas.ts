// Shared contracts between the master agent, the three subagents, the API route and the UI.
// This file is the handoff point (PLAN.md §3). Change it only by agreement: the parser,
// compliance, producer, master, route and UI all build against these shapes.
//
// Structured-output friendly: no min/max/length constraints, no recursion. Fields the model
// must always emit use .nullable() rather than .optional(), so the UI never has to guess.

import { z } from "zod";

// ---------- shared enums ----------

export const ProjectType = z.enum([
  "adu",
  "jadu",
  "sb9_two_unit",
  "sb9_lot_split",
  "sb684_small_subdivision",
  "streamlined_multifamily",
  "unknown",
]);
export type ProjectType = z.infer<typeof ProjectType>;

export const ItemStatus = z.enum([
  "current", // citation is current law
  "stale", // citation was renumbered; see newCitation
  "uncited", // requirement cites no authority
  "possible_conflict", // looks stricter than state law: "confirm with city staff or counsel"
  "unverified", // couldn't confirm today
]);
export type ItemStatus = z.infer<typeof ItemStatus>;

export const PackageStatus = z.enum(["present", "missing", "inconsistent", "cant_tell"]);
export type PackageStatus = z.infer<typeof PackageStatus>;

// ---------- 1. PARSER output ----------

export const ParsedItem = z.object({
  id: z.string().describe("Stable id, e.g. 'p1-3' for page 1 line 3"),
  text: z.string().describe("The checklist line, verbatim"),
  page: z.number().int(),
  citations: z
    .array(z.string())
    .describe("Statute citations exactly as written, e.g. 'Gov. Code 65852.2'"),
  kind: z.enum(["requirement", "document", "fee", "info"]),
});
export type ParsedItem = z.infer<typeof ParsedItem>;

export const ParsedDoc = z.object({
  isChecklist: z
    .boolean()
    .describe("False if the upload is not a permit checklist/application (e.g. a menu)"),
  containsPersonalInfo: z
    .boolean()
    .describe("True if the upload contains a private person's name, address, phone or email"),
  city: z.string(),
  projectType: ProjectType,
  docTitle: z.string(),
  docDate: z.string().nullable(),
  items: z.array(ParsedItem),
  package: z
    .array(z.object({ itemId: z.string(), status: PackageStatus, note: z.string() }))
    .nullable()
    .describe("Only when an applicant package was uploaded; otherwise null"),
});
export type ParsedDoc = z.infer<typeof ParsedDoc>;

// ---------- 2. COMPLIANCE output ----------

export const ComplianceResult = z.object({
  checkedOn: z.string().describe("Today's date, YYYY-MM-DD"),
  path: z
    .object({
      name: z.string(),
      statute: z.string(),
      clock: z.string().describe("e.g. '60 days', or 'unknown'"),
      sourceUrl: z.string(),
    })
    .nullable(),
  items: z.array(
    z.object({
      id: z
        .string()
        .describe(
          "ParsedItem.id this row audits. One row per finding: repeat the id when a line has several (e.g. two stale citations + a possible conflict)",
        ),
      status: ItemStatus,
      newCitation: z.string().nullable(),
      note: z.string(),
      sourceUrl: z.string().nullable(),
    }),
  ),
  steps: z.array(
    z.object({
      order: z.number().int(),
      step: z.string(),
      fee: z.string().nullable(),
      time: z.string().nullable(),
      outsidePlanningClock: z
        .boolean()
        .describe("True for sign-offs not counted in the legal clock (e.g. Anaheim sewer check)"),
      sourceUrl: z.string().nullable(),
    }),
  ),
  hcdLetters: z.array(z.object({ title: z.string(), date: z.string(), url: z.string() })),
  hcdLettersNote: z.string().describe("e.g. 'unknown: dashboard unreadable; ask HAUportal@hcd.ca.gov'"),
  timelines: z.array(z.object({ metric: z.string(), value: z.string(), source: z.string() })),
  unverified: z.array(z.string()),
});
export type ComplianceResult = z.infer<typeof ComplianceResult>;

// ---------- 3. PRODUCER output (what the UI renders) ----------

export const Report = z.object({
  header: z.object({
    city: z.string(),
    projectType: ProjectType,
    docTitle: z.string(),
    checkedOn: z.string(),
    disclaimer: z.string().describe("Always 'Prototype · not legal advice'"),
  }),
  trafficLight: z.object({
    pathFound: z.boolean(),
    staleCitations: z.number().int(),
    possibleConflicts: z.number().int(),
    gaps: z.number().int(),
  }),
  path: z
    .object({
      name: z.string(),
      statute: z.string(),
      clock: z.string(),
      sourceUrl: z.string(),
      note: z.string(),
    })
    .nullable(),
  stepsAndFees: z.array(
    z.object({
      order: z.number().int(),
      step: z.string(),
      fee: z.string().nullable(),
      time: z.string().nullable(),
      outsidePlanningClock: z.boolean(),
      sourceUrl: z.string().nullable(),
    }),
  ),
  auditTable: z.array(
    z.object({
      itemId: z.string(),
      line: z.string(),
      page: z.number().int(),
      cites: z.array(z.string()),
      status: ItemStatus,
      newCitation: z.string().nullable(),
      note: z.string(),
      sourceUrl: z.string().nullable(),
    }),
  ),
  timelines: z.array(z.object({ metric: z.string(), value: z.string(), source: z.string() })),
  hcdLetters: z.object({
    letters: z.array(z.object({ title: z.string(), date: z.string(), url: z.string() })),
    note: z.string(),
  }),
  packageGaps: z.array(z.object({ item: z.string(), status: PackageStatus, note: z.string() })),
  couldntVerify: z.array(z.string()).describe("Always present, may be empty"),
  markdown: z.string().describe("The whole report as Markdown, for download"),
});
export type Report = z.infer<typeof Report>;

/** One report per city; `comparison` is filled only for two-city runs (test 3 / C02). */
export const FinalReport = z.object({
  reports: z.array(Report),
  comparison: z
    .array(
      z.object({
        topic: z.string(),
        values: z.array(z.object({ city: z.string(), value: z.string().describe("'unknown' if no source") })),
      }),
    )
    .nullable(),
});
export type FinalReport = z.infer<typeof FinalReport>;

// ---------- run input / outcome / progress stream ----------

export type CheckInput = {
  mode: "checklist" | "site";
  city: string;
  projectType: ProjectType;
  /** Checklist mode: one or two city checklist PDFs (two = side-by-side). */
  checklists: { city: string; pdfBase64: string; filename: string }[];
  /** Optional applicant package PDF. */
  packagePdfBase64?: string;
  /** Site mode: listing text / address for a publicly listed lot. */
  siteDescription?: string;
};

export type RunOutcome =
  | { kind: "report"; report: FinalReport }
  | { kind: "question"; question: string }; // master stopped to ask the user (bad upload, blocked source, PII)

export type AgentName = "master" | "parser" | "compliance" | "producer";

/** Streamed from /api/check as newline-delimited JSON, one event per line. */
export type ProgressEvent =
  | { type: "progress"; agent: AgentName; message: string }
  | { type: "result"; outcome: RunOutcome }
  | { type: "error"; message: string };

export type Emit = (e: ProgressEvent) => void;

// ---------- subagent function signatures (implemented in parser.ts / compliance.ts / producer.ts) ----------

export type RunParser = (
  args: { pdfBase64: string; city: string; projectType: ProjectType; packagePdfBase64?: string; note?: string },
  emit: Emit,
) => Promise<ParsedDoc>;

export type RunCompliance = (
  args: { parsed: ParsedDoc; note?: string; checkSmap?: boolean },
  emit: Emit,
) => Promise<ComplianceResult>;

export type RunProducer = (
  args: { inputs: { parsed: ParsedDoc; compliance: ComplianceResult }[]; note?: string },
  emit: Emit,
) => Promise<FinalReport>;
