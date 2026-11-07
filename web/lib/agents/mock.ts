// MOCK MODE (MOCK=1): replays a real recorded run so demos and UI work spend no API credits.
// The recording is genuine agent output: /api/check on the Anaheim Z412 checklist
// (evals/fixtures/anaheim-adu-checklist-z412-nov-2025.pdf), recorded live on 2026-11-07.
// To refresh it, run the live check once and save its NDJSON into fixtures/anaheim-run.recorded.json.
//
// The recording predates the form-editing producer, so it holds the old report. Demo mode
// rebuilds the parsed lines and compliance findings from it and marks up the uploaded PDF by
// code (no model call), the same fallback the producer uses when its model step fails.

import recorded from "./fixtures/anaheim-run.recorded.json";
import { editForm } from "./producer";
import type { ComplianceResult, Emit, FilledForms, ItemStatus, ParsedDoc, ProgressEvent, ProjectType } from "./schemas";

/** Cities with a recorded run. Mock mode refuses other cities rather than show Anaheim's findings under their name. */
export const MOCK_CITIES = ["anaheim"];

export const mockRecordedOn: string = recorded.recordedOn;

export const mockEvents: ProgressEvent[] = [
  { type: "progress", agent: "master", message: `Demo mode: replaying a recorded run from ${recorded.recordedOn}` },
  // The recorded producer events describe the old report; the live markup below emits its own.
  ...(recorded.events as ProgressEvent[]).filter((e) => e.type !== "progress" || e.agent !== "producer"),
];

type RecordedReport = {
  header: { city: string; projectType: ProjectType; docTitle: string; checkedOn: string };
  path: ComplianceResult["path"];
  stepsAndFees: ComplianceResult["steps"];
  findings: { itemId: string; topic: string; stateRule: string | null; suggestedFix: string | null }[];
  auditTable: {
    itemId: string;
    line: string;
    page: number;
    cites: string[];
    status: ItemStatus;
    newCitation: string | null;
    note: string;
    sourceUrl: string | null;
  }[];
};

const rec = recorded.report.reports[0] as unknown as RecordedReport;

const parsed: ParsedDoc = {
  isChecklist: true,
  containsPersonalInfo: false,
  city: rec.header.city,
  projectType: rec.header.projectType,
  docTitle: rec.header.docTitle,
  docDate: "NOV 2025",
  items: rec.auditTable.map((a) => ({ id: a.itemId, text: a.line, page: a.page, citations: a.cites, kind: "requirement" })),
  package: null,
};

const compliance: ComplianceResult = {
  checkedOn: rec.header.checkedOn,
  path: rec.path,
  items: rec.auditTable.map((a) => {
    const f = rec.findings.find((x) => x.itemId === a.itemId);
    return {
      id: a.itemId,
      status: a.status,
      topic: f?.topic ?? "",
      newCitation: a.newCitation,
      stateRule: f?.stateRule ?? null,
      suggestedFix: f?.suggestedFix ?? null,
      note: a.note,
      sourceUrl: a.sourceUrl,
    };
  }),
  steps: rec.stepsAndFees,
  hcdLetters: [],
  hcdLettersNote: "",
  timelines: [],
  unverified: [],
};

/** The recorded run's parsed lines and findings, rebuilt from its report. */
export const recordedInput = { parsed, compliance };

/** Marks up the uploaded Anaheim PDF with the recorded findings. */
export async function mockForms(pdfBase64: string, filename: string, emit: Emit): Promise<FilledForms> {
  const form = await editForm({ parsed, compliance, pdfBase64, filename }, emit, { useModel: false });
  return { forms: [form] };
}
