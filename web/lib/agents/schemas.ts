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
      clock: z
        .string()
        .describe(
          "The rule only, e.g. '15 business days to decide completeness, then 60 days to approve or deny', or 'unknown'. No source sentence: the source goes in statute and sourceUrl",
        ),
      sourceUrl: z.string(),
    })
    .nullable(),
  items: z.array(
    z.object({
      id: z
        .string()
        .describe(
          "ParsedItem.id this row audits. Exactly one row per line: when a line has several findings (e.g. two stale citations + a possible conflict), use the most serious status, list every mapping in newCitation and cover all of them in note",
        ),
      status: ItemStatus,
      topic: z
        .string()
        .describe("Short HCD-style topic label for the line, e.g. 'Owner Occupancy', 'Deed Restriction', 'Statute Citations', 'Sewer Capacity'"),
      newCitation: z.string().nullable(),
      stateRule: z
        .string()
        .nullable()
        .describe(
          "stale or possible_conflict only (else null): what current state law says, cited HCD-style down to the subdivision when the handbook or reference files give it, e.g. 'Gov. Code, § 66333, subd. (b) requires owner occupancy for a JADU only when it shares sanitation facilities with the main house.' Put words in quotes only when you have the source's exact words",
        ),
      suggestedFix: z
        .string()
        .nullable()
        .describe(
          "stale or possible_conflict only (else null): one sentence on what the city could change in this checklist line, e.g. 'Replace 65852.22 with Gov. Code, § 66333.' Never say 'must'",
        ),
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

// ---------- 3. PRODUCER output: the uploaded form, filled in and corrected ----------

/** One edit the producer plans on the form's own text. Code finds it on the page and applies it. */
export const FormEdit = z.object({
  page: z.number().int().describe("1-based page the text is on"),
  near: z
    .string()
    .nullable()
    .describe("6 to 15 words copied exactly from the page text around `find`, so the right place is found if `find` appears more than once"),
  find: z.string().describe("The exact text on the page to change or flag, e.g. '65852.22'"),
  replace: z
    .string()
    .nullable()
    .describe("Stale citations only: the current section, about as short as the original, e.g. '66333'. Null for a note"),
  note: z
    .string()
    .nullable()
    .describe("Possible conflicts only: one or two sentences with the state rule and its section, ending 'Possible conflict, confirm with city staff or counsel.'"),
  sourceUrl: z.string().nullable(),
});
export type FormEdit = z.infer<typeof FormEdit>;

/** One fillable box the producer fills from the research. Never personal details. */
export const FormFill = z.object({
  field: z.string().describe("The box's exact name from the field list"),
  value: z.string().describe("Text, an option name, or 'Yes' / 'No' for a checkbox"),
  sourceUrl: z.string().nullable(),
});
export type FormFill = z.infer<typeof FormFill>;

export const FormPlan = z.object({ edits: z.array(FormEdit), fills: z.array(FormFill) });
export type FormPlan = z.infer<typeof FormPlan>;

/** What happened to each planned edit or fill, so the UI and the change page can list it. */
export const FormChange = z.object({
  kind: z.enum(["citation", "note", "fill"]),
  /** The numbered marker on the page, for notes. */
  number: z.number().int().nullable(),
  page: z.number().int().nullable(),
  /** The text that was on the page, or the box name for a fill. */
  original: z.string(),
  /** The replacement text or the value put in the box; null for a note. */
  newText: z.string().nullable(),
  note: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  /** False when it couldn't be placed on the page; it's still listed on the change page. */
  placed: z.boolean(),
});
export type FormChange = z.infer<typeof FormChange>;

export const FilledForm = z.object({
  city: z.string(),
  docTitle: z.string(),
  checkedOn: z.string(),
  fileName: z.string(),
  /** The uploaded PDF with the edits drawn on its pages, boxes filled, and one change page at the end. */
  pdfBase64: z.string(),
  changes: z.array(FormChange),
  disclaimer: z.string().describe("Always 'Prototype · not legal advice'"),
});
export type FilledForm = z.infer<typeof FilledForm>;

/** One filled form per uploaded checklist, in upload order. */
export const FilledForms = z.object({ forms: z.array(FilledForm) });
export type FilledForms = z.infer<typeof FilledForms>;

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
  | { kind: "forms"; result: FilledForms }
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

export type ProducerInput = {
  parsed: ParsedDoc;
  compliance: ComplianceResult;
  /** The uploaded checklist, so the producer can edit and fill it. */
  pdfBase64: string;
  filename: string;
};

export type RunProducer = (args: { inputs: ProducerInput[]; note?: string }, emit: Emit) => Promise<FilledForms>;
