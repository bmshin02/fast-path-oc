// MASTER AGENT: decides which subagent to run, re-runs one with a note when its output is
// incomplete, and stops to ask the user when an upload is unusable or a source is blocked.
// The PDFs never go to the master: it sees doc ids and compact summaries only.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { client, MODELS, today, logUsage } from "./client";
import { RULES } from "./prompts";
import { runParser } from "./parser";
import { runCompliance } from "./compliance";
import { runProducer } from "./producer";
import type { CheckInput, ComplianceResult, Emit, FilledForms, ParsedDoc, ProducerInput, RunOutcome } from "./schemas";

const MAX_TOOL_CALLS = 8;

const SYSTEM = `You are the coordinator of Fast Path Check, a prototype that checks Orange County, California permit checklists against current state housing law. You don't read documents yourself. You direct three subagents through tools:

- parse_document: turns one uploaded PDF into structured checklist lines and citations.
- check_compliance: checks a parsed document against current law (web search + HCD guidance) and picks the approval path and its legal clock.
- produce_deliverables: marks up each uploaded form itself (current citations written in, possible conflicts flagged, researched boxes filled) from parsed + checked documents. Call it once, with every doc id, at the end.
- ask_user: stop and ask the user a question instead of producing the forms.

How to run:
1. Parse every uploaded document.
2. If a parse result says isChecklist=false, call ask_user ("this doesn't look like a permit checklist...") and stop. If containsPersonalInfo=true, call ask_user telling them the upload contains personal information and to find an organizer, and stop.
3. If a parse looks incomplete (zero items, or no citations on a checklist that obviously cites law), re-run parse_document once with a note saying what's missing.
4. Run check_compliance on each parsed document. For multifamily projects set checkSmap=true. If many items come back "unverified" because a fetch failed, you may re-run once with a note to use web search instead; after that, accept "unverified today".
5. Call produce_deliverables once with all doc ids.
6. When produce_deliverables succeeds, reply with one short sentence and stop.

You have at most ${MAX_TOOL_CALLS} tool calls. Never guess or fill in content yourself; the subagents' sourced output is the only content.

${RULES}`;

export async function runMaster(input: CheckInput, emit: Emit): Promise<RunOutcome> {
  if (input.mode === "site") {
    return { kind: "question", question: "Site mode isn't built yet. Upload a city checklist PDF instead." };
  }
  if (input.checklists.length === 0) {
    return { kind: "question", question: "Please upload a city permit checklist PDF." };
  }

  // Server-side state for this run. The model only ever sees ids.
  const docs = new Map(input.checklists.map((c, i) => [`doc${i + 1}`, c]));
  const parsed = new Map<string, ParsedDoc>();
  const checked = new Map<string, ComplianceResult>();
  let filled: FilledForms | null = null;
  let question: string | null = null;
  let toolCalls = 0;

  const guard = (name: string) => {
    toolCalls += 1;
    if (toolCalls > MAX_TOOL_CALLS) {
      throw new Error(`Tool-call cap (${MAX_TOOL_CALLS}) reached. Call produce_deliverables now if you can, otherwise stop.`);
    }
    if (question) throw new Error("You already asked the user a question. Stop now.");
    emit({ type: "progress", agent: "master", message: `Calling ${name}` });
  };

  const producerInput = (id: string): ProducerInput => ({
    parsed: parsed.get(id)!,
    compliance: checked.get(id)!,
    pdfBase64: docs.get(id)!.pdfBase64,
    filename: docs.get(id)!.filename,
  });

  const docId = z.enum([...docs.keys()] as [string, ...string[]]);

  const parseTool = betaZodTool({
    name: "parse_document",
    description: "Parse one uploaded PDF into checklist lines, citations and package status.",
    inputSchema: z.object({
      docId,
      note: z.string().optional().describe("What the previous parse missed, when re-running"),
    }),
    run: async ({ docId, note }) => {
      guard("parse_document");
      const doc = docs.get(docId)!;
      const result = await runParser(
        {
          pdfBase64: doc.pdfBase64,
          city: doc.city,
          projectType: input.projectType,
          packagePdfBase64: input.packagePdfBase64,
          note,
        },
        emit,
      );
      parsed.set(docId, result);
      return JSON.stringify({
        docId,
        isChecklist: result.isChecklist,
        containsPersonalInfo: result.containsPersonalInfo,
        city: result.city,
        projectType: result.projectType,
        docTitle: result.docTitle,
        docDate: result.docDate,
        itemCount: result.items.length,
        citations: [...new Set(result.items.flatMap((i) => i.citations))],
        packageItems: result.package?.length ?? null,
      });
    },
  });

  const complianceTool = betaZodTool({
    name: "check_compliance",
    description: "Check a parsed document against current California law. Requires parse_document first.",
    inputSchema: z.object({
      docId,
      note: z.string().optional().describe("What to fix or try differently, when re-running"),
      checkSmap: z.boolean().optional().describe("Multifamily only: check HCD's SB 35 SMAP dashboard"),
    }),
    run: async ({ docId, note, checkSmap }) => {
      guard("check_compliance");
      const p = parsed.get(docId);
      if (!p) throw new Error(`${docId} hasn't been parsed yet. Call parse_document first.`);
      const result = await runCompliance({ parsed: p, note, checkSmap }, emit);
      checked.set(docId, result);
      const counts: Record<string, number> = {};
      for (const it of result.items) counts[it.status] = (counts[it.status] ?? 0) + 1;
      return JSON.stringify({ docId, path: result.path, statusCounts: counts, unverified: result.unverified });
    },
  });

  const produceTool = betaZodTool({
    name: "produce_deliverables",
    description: "Mark up every parsed and checked form (the uploaded PDFs themselves). Call once, at the end.",
    inputSchema: z.object({
      docIds: z.array(docId),
      note: z.string().optional(),
    }),
    run: async ({ docIds, note }) => {
      guard("produce_deliverables");
      const inputs = docIds.map((id) => {
        if (!parsed.has(id) || !checked.has(id)) throw new Error(`${id} needs parse_document and check_compliance first.`);
        return producerInput(id);
      });
      filled = await runProducer({ inputs, note }, emit);
      return JSON.stringify({
        ok: true,
        forms: filled.forms.map((f) => ({ city: f.city, changes: f.changes.length })),
      });
    },
  });

  const askTool = betaZodTool({
    name: "ask_user",
    description: "Stop the run and ask the user a question (bad upload, personal info, blocked source).",
    inputSchema: z.object({ question: z.string() }),
    run: async ({ question: q }) => {
      question = q;
      emit({ type: "progress", agent: "master", message: `Stopping to ask: ${q}` });
      return "Question sent to the user. Stop now.";
    },
  });

  const docList = [...docs.entries()]
    .map(([id, d]) => `- ${id}: ${d.filename} (city: ${d.city})`)
    .join("\n");

  emit({ type: "progress", agent: "master", message: "Planning the run" });

  const runner = client.beta.messages.toolRunner({
    model: MODELS.coordinator,
    max_tokens: 16000,
    max_iterations: MAX_TOOL_CALLS + 4,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    tools: [parseTool, complianceTool, produceTool, askTool],
    messages: [
      {
        role: "user",
        content: `Today is ${today()}. Project type: ${input.projectType}. Uploaded documents:\n${docList}${
          input.packagePdfBase64 ? "\nAn applicant package PDF was also uploaded (the parser receives it with each checklist)." : ""
        }`,
      },
    ],
  });

  let final: Anthropic.Beta.BetaMessage;
  try {
    final = await runner.runUntilDone();
  } catch (err) {
    if (question) return { kind: "question", question };
    throw err;
  }
  logUsage("master", final.usage);

  if (question) return { kind: "question", question };
  if (filled) return { kind: "forms", result: filled };

  if (final.stop_reason === "refusal") {
    throw new Error(`Master agent declined the request (${final.stop_details?.category ?? "no category"}).`);
  }

  // The master stopped without producing (cap hit or it gave up). Produce from whatever we have.
  const ready = [...checked.keys()].filter((id) => parsed.has(id));
  if (ready.length > 0) {
    emit({ type: "progress", agent: "master", message: "Coordinator stopped early; marking up the forms from what's done" });
    const result = await runProducer({ inputs: ready.map(producerInput), note: "The run stopped early." }, emit);
    return { kind: "forms", result };
  }
  return {
    kind: "question",
    question: "The run couldn't check this upload. Is it a readable city permit checklist PDF?",
  };
}
