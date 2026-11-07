// PRODUCER SUBAGENT: edits the uploaded form itself. It doesn't write a separate report.
//
// The model plans the edits from the page's real text and the compliance findings: which
// renumbered citation to swap for which current section, which line gets a possible-conflict
// note, and which fillable boxes it can fill from the research. Code then checks that plan
// against the compliance data (no unsourced mapping, no personal-details boxes) and draws it on
// the PDF (form-edit.ts). If the model call fails, the same kind of plan is built by code from
// the compliance data, so the form still comes back corrected.

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { client, MODELS, today, logUsage } from "./client";
import { mergeById } from "./findings";
import { applyFormPlan, checkPlan, formFields, planFromData } from "./form-edit";
import { pageLines, readPdfText, type PageText } from "./pdf-text";
import { RULES } from "./prompts";
import {
  FormPlan,
  type Emit,
  type FilledForm,
  type FilledForms,
  type ProducerInput,
  type RunProducer,
} from "./schemas";

const DISCLAIMER = "Prototype · not legal advice";

const SYSTEM = `You are the producer for Fast Path Check, a prototype that checks Orange County, California permit checklists against current state law. Another agent has already checked the city's form line by line. Your job is to mark up the city's own form, not to write a report: you plan small edits to the form's text and fill its boxes, and code draws them on the PDF.

You get the form's page text (copied from the PDF), the checked findings, the approval path and steps, and the form's fillable boxes (if any).

edits:
- One edit per renumbered citation on the page: find = the old section number exactly as printed (e.g. "65852.22"), replace = the current section from the finding's newCitation, written about as short as the original so it fits on the line (e.g. "66333", or "66310-66342" for a whole range). Keep the form's own wording around it; only the number changes. Use only mappings in newCitation; never work out a section yourself.
- One edit per possible conflict: find = the first few words of that line as printed (e.g. "OWNER OCCUPANCY COVENANT"), replace = null, note = one or two plain sentences: what current state law says, with its section (from stateRule), then "Possible conflict, confirm with city staff or counsel." Never call anything illegal or invalid.
- near: 6 to 15 words copied exactly from the page text that contain find, so code finds the right place when find appears more than once.
- sourceUrl: the finding's sourceUrl.
- Nothing else: don't reword requirements, fees or instructions, and don't edit lines whose status is current, uncited or unverified.

fills:
- Only boxes whose answer is a public fact in the data you're given: the approval path, its statute, the review clock, current code sections, the city. Copy the box name exactly from the field list. For a checkbox, value is "Yes" or "No"; for a radio or dropdown, one of its options.
- Never fill anything about the applicant, owner or property (names, addresses, phone, email, APN, signatures, dates, project sizes or counts). The applicant fills those.
- A checklist with no boxes, or no box that matches a researched fact, gets fills: [].

${RULES}`;

function modelInput(input: ProducerInput, pages: PageText[], fields: Awaited<ReturnType<typeof formFields>>) {
  const { parsed, compliance } = input;
  const items = new Map(parsed.items.map((i) => [i.id, i]));
  return {
    city: parsed.city,
    docTitle: parsed.docTitle,
    projectType: parsed.projectType,
    pages: pages.map((p) => ({ page: p.page, text: pageLines(p).join("\n") })),
    findings: mergeById(compliance.items)
      .filter((c) => c.status === "stale" || c.status === "possible_conflict" || c.newCitation)
      .map((c) => ({
        itemId: c.id,
        page: items.get(c.id)?.page ?? null,
        line: items.get(c.id)?.text ?? null,
        status: c.status,
        newCitation: c.newCitation,
        stateRule: c.stateRule,
        suggestedFix: c.suggestedFix,
        sourceUrl: c.sourceUrl,
      })),
    path: compliance.path,
    steps: compliance.steps,
    fields,
  };
}

async function planEdits(
  input: ProducerInput,
  pages: PageText[],
  fields: Awaited<ReturnType<typeof formFields>>,
  note: string | undefined,
  emit: Emit,
): Promise<FormPlan | null> {
  try {
    const msg = await client.beta.messages.parse({
      model: MODELS.producer,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(FormPlan) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Today is ${today()}.${note ? `\nCoordinator note: ${note}` : ""}\n\nForm and findings:\n${JSON.stringify(
            modelInput(input, pages, fields),
            null,
            1,
          )}`,
        },
      ],
    });
    logUsage("producer", msg.usage);
    if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens" || !msg.parsed_output) {
      emit({ type: "progress", agent: "producer", message: "Edit plan incomplete; marking up the form from the findings directly" });
      return null;
    }
    return msg.parsed_output;
  } catch (err) {
    console.error("[producer] edit plan failed:", err);
    emit({ type: "progress", agent: "producer", message: "Edit plan failed; marking up the form from the findings directly" });
    return null;
  }
}

function outputName(filename: string): string {
  return `${filename.replace(/\.pdf$/i, "").replace(/[^\w-]+/g, "-")}-fast-track.pdf`;
}

/**
 * Marks up one form. `useModel: false` skips the model and builds the plan from the findings
 * (demo mode replays recorded findings this way, with no API call).
 */
export async function editForm(
  input: ProducerInput,
  emit: Emit,
  opts: { note?: string; useModel?: boolean } = {},
): Promise<FilledForm> {
  const { parsed, compliance } = input;
  const bytes = new Uint8Array(Buffer.from(input.pdfBase64, "base64"));
  const checkedOn = compliance.checkedOn || today();

  const [pages, fields] = await Promise.all([readPdfText(bytes), formFields(bytes)]);
  emit({
    type: "progress",
    agent: "producer",
    message: `Marking up the ${parsed.city} form (${pages.length} page${pages.length === 1 ? "" : "s"}, ${fields.length} fillable box${fields.length === 1 ? "" : "es"})`,
  });

  const planned = opts.useModel === false ? null : await planEdits(input, pages, fields, opts.note, emit);
  const { plan, dropped } = checkPlan(planned ?? planFromData(parsed, compliance), compliance, new Set(fields.map((f) => f.name)));

  const title = `City of ${parsed.city}, ${parsed.docTitle}${parsed.docDate ? ` (${parsed.docDate})` : ""}`;
  const out = await applyFormPlan(bytes, pages, plan, { title, checkedOn, dropped });

  const placed = out.changes.filter((c) => c.placed);
  const count = (k: string) => placed.filter((c) => c.kind === k).length;
  emit({
    type: "progress",
    agent: "producer",
    message:
      `${parsed.city}: ${count("citation")} citation(s) corrected, ${count("note")} possible conflict(s) marked, ${count("fill")} box(es) filled` +
      (out.changes.length > placed.length ? `, ${out.changes.length - placed.length} listed on the change page only` : ""),
  });

  return {
    city: parsed.city,
    docTitle: parsed.docTitle,
    checkedOn,
    fileName: outputName(input.filename),
    pdfBase64: Buffer.from(out.bytes).toString("base64"),
    changes: out.changes,
    disclaimer: DISCLAIMER,
  };
}

export const runProducer: RunProducer = async ({ inputs, note }, emit): Promise<FilledForms> => {
  const forms = await Promise.all(inputs.map((input) => editForm(input, emit, { note })));
  emit({ type: "progress", agent: "producer", message: forms.length === 1 ? "Form ready" : `${forms.length} forms ready` });
  return { forms };
};
