// POST /api/fill: one turn of the fill conversation.
//
// The browser sends the form, the fields so far and the transcript; we ask
// Claude for the next step and stream back FillEvents as NDJSON (one JSON
// object per line). Each request is self-contained: nothing is stored here,
// and uploads are only held in memory for the length of the request.

import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import { sampleForms } from "@/lib/fill/forms";
import { irvineAduFields } from "@/lib/fill/mock/irvine-adu";
import type { FillRequest, ServerEvent } from "@/lib/fill/protocol";
import { mergeFields } from "@/lib/fill/server/merge";
import { SYSTEM_PROMPT, TURN_SCHEMA, turnText, type Turn } from "@/lib/fill/server/prompt";
import { summarizeFields } from "@/lib/fill/summary";
import { TOO_LARGE_MESSAGE } from "@/lib/fill/upload";
import { MODEL_CHOICES, parseModelChoice } from "@/lib/models";

// Web searches can make a turn take a while.
export const maxDuration = 120;

// Sonnet 5.5: a live chat, so speed matters, and half Opus 5.5's price. It still reads
// the PDF, matches boxes to labels and web-searches, so effort stays at medium below.
const MODEL = "claude-sonnet-5-5";
// Vercel rejects bodies over 4.5 MB before this route runs; match it so local
// dev fails the same way. The browser caps uploads at 3 MB (~4 MB as base64).
const MAX_BODY_BYTES = 4.5 * 1024 * 1024;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

type DocBlock = Anthropic.Beta.BetaRequestDocumentBlock;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { message: "The server has no Claude API key. Add ANTHROPIC_API_KEY to web/.env and restart the dev server." },
      { status: 500 },
    );
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return Response.json({ message: TOO_LARGE_MESSAGE }, { status: 413 });
  }

  // ?model=sonnet | opus overrides MODEL for this turn (the /fill page forwards it).
  let model: string;
  try {
    const choice = parseModelChoice(new URL(request.url).searchParams.get("model"));
    model = choice ? MODEL_CHOICES[choice] : MODEL;
  } catch (err) {
    return Response.json({ message: (err as Error).message }, { status: 400 });
  }

  let body: FillRequest;
  try {
    body = (await request.json()) as FillRequest;
    if (!body?.form || !Array.isArray(body.fields) || !Array.isArray(body.transcript)) throw new Error();
  } catch {
    return Response.json({ message: "The request was malformed." }, { status: 400 });
  }

  let doc: { block: DocBlock; label: string; curated: boolean };
  try {
    doc = await documentFor(body, request);
  } catch (err) {
    return Response.json({ message: err instanceof Error ? err.message : "Couldn't read the form." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: ServerEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(ev)}\n`));
      try {
        await runTurn(body, doc, model, send);
      } catch (err) {
        console.error("[api/fill]", err);
        send({ type: "error", message: friendlyError(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-fast-track-model": model },
  });
}

async function runTurn(
  body: FillRequest,
  doc: { block: DocBlock; label: string; curated: boolean },
  model: string,
  send: (ev: ServerEvent) => void,
) {
  const firstTurn = body.transcript.length === 0;
  send({ type: "status", text: firstTurn ? "Reading your form…" : "Thinking about your answer…" });

  // The form document comes first and is cached, so later turns re-read it cheaply.
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: [
        { ...doc.block, cache_control: { type: "ephemeral" } },
        { type: "text", text: turnText(body, doc.label, doc.curated) },
      ],
    },
  ];

  let final: Anthropic.Beta.BetaMessage | null = null;
  // A turn that uses web search can pause; send it back so it continues.
  for (let attempt = 0; attempt < 4; attempt++) {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 32000,
      // If a safety check declines the request, the API re-runs it on a
      // suitable fallback model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: TURN_SCHEMA } },
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      messages,
    });
    for await (const ev of stream) {
      if (ev.type === "content_block_start" && ev.content_block.type === "server_tool_use") {
        send({ type: "status", text: "Looking that up online…" });
      }
    }
    final = await stream.finalMessage();
    logUsage(final);
    if (final.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: final.content as Anthropic.Beta.BetaContentBlockParam[] });
  }

  if (!final) throw new Error("No response");
  if (final.stop_reason === "refusal") {
    throw new UserFacingError("Fast Track couldn't help with this form. Please try a different form.");
  }
  if (final.stop_reason === "max_tokens") throw new Error("Reply was cut off (max_tokens)");

  const turn = parseTurn(final);
  const { fields, changed } = mergeFields(body.fields, turn.fields, {
    curated: doc.curated,
    pdfFields: body.pdfFields,
  });

  for (const field of changed) send({ type: "field", field });
  if (turn.message) send({ type: "message", text: turn.message });

  if (turn.done || !turn.question) {
    send({ type: "done", summary: summarizeFields(fields, turn.summary), fields });
  } else {
    send({ type: "question", text: turn.question, fieldIds: changed.map((f) => f.id) });
  }
}

/** The JSON reply is the text after the last fallback marker, if any. */
function parseTurn(message: Anthropic.Beta.BetaMessage): Turn {
  const lastFallback = message.content.findLastIndex((b) => b.type === "fallback");
  const text = message.content
    .slice(lastFallback + 1)
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const turn = JSON.parse(text) as Turn;
  if (!Array.isArray(turn.fields) || typeof turn.done !== "boolean") throw new Error("Reply had the wrong shape");
  return turn;
}

async function documentFor(body: FillRequest, request: Request) {
  if (body.form.kind === "sample") {
    const id = body.form.id;
    const form = sampleForms.find((f) => f.id === id);
    if (!form) throw new UserFacingError("We couldn't find that form.");
    // Sample PDFs are static files in public/forms; fetch our own copy.
    const res = await fetch(new URL(`/forms/${form.id}.pdf`, request.url));
    if (!res.ok) throw new UserFacingError("We couldn't load that form.");
    const data = Buffer.from(await res.arrayBuffer()).toString("base64");
    const curated = form.id === "irvine-adu-application";
    if (curated && body.fields.length === 0) body.fields = irvineAduFields();
    return {
      block: {
        type: "document",
        title: `${form.city}: ${form.title}`,
        source: { type: "base64", media_type: "application/pdf", data },
      } satisfies DocBlock,
      label: `${form.city}: ${form.title} (${form.pages} pages${curated ? "; fill the Building Permit Application on page 2" : ""})`,
      curated,
    };
  }

  const { name, fileKind, data } = body.form;
  if (fileKind === "pdf") {
    return {
      block: { type: "document", title: name, source: { type: "base64", media_type: "application/pdf", data } } satisfies DocBlock,
      label: `${name} (uploaded PDF)`,
      curated: false,
    };
  }
  // Word: Claude reads text, so convert the .docx first.
  const { value: text } = await mammoth.extractRawText({ buffer: Buffer.from(data, "base64") });
  if (!text.trim()) throw new UserFacingError("That Word document looks empty.");
  return {
    block: { type: "document", title: name, source: { type: "text", media_type: "text/plain", data: text } } satisfies DocBlock,
    label: `${name} (uploaded Word document, converted to text)`,
    curated: false,
  };
}

class UserFacingError extends Error {}

function friendlyError(err: unknown): string {
  if (err instanceof UserFacingError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return "The server's Claude API key isn't valid. Check ANTHROPIC_API_KEY in web/.env.";
  if (err instanceof Anthropic.PermissionDeniedError) return "The Claude API key doesn't have access to this model.";
  if (err instanceof Anthropic.RateLimitError) return "Fast Track is busy right now. Please wait a moment and try again.";
  if (err instanceof Anthropic.BadRequestError) return "Claude couldn't read this request. Try a smaller or different file.";
  if (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500) return "Claude is having trouble right now. Please try again in a moment.";
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach Claude. Check the internet connection and try again.";
  return "Something went wrong on our side. Please try again.";
}

/** Log what each call costs, so we know what a demo run uses. */
function logUsage(m: Anthropic.Beta.BetaMessage) {
  const u = m.usage;
  console.log(
    `[api/fill] ${m.model} stop=${m.stop_reason} in=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens} searches=${u.server_tool_use?.web_search_requests ?? 0}`,
  );
}
