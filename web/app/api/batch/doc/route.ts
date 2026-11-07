// POST /api/batch/doc: audit ONE checklist as part of a batch, streaming progress as NDJSON.
//
// The browser sends each file of a batch (up to ~20) in its own request, a few at a time
// (lib/batch/runner.ts). That keeps every request under Vercel's 4.5 MB body limit and the
// 300 s function limit, and the model only ever holds one document. The last line is
//   { "type": "doc", digest, parsed, compliance, cached }
// The browser keeps parsed + compliance for the full report and sends only digests for the
// batch summary.
//
// multipart/form-data: file (PDF, ≤ 3 MB), city, projectType (default "adu"), package (optional PDF)
// ?model=sonnet|opus like /api/check. ?mock=1 (or MOCK=1 in the env) uses fixtures, no API calls.

import { ProjectType } from "@/lib/agents/schemas";
import type { ProgressEvent } from "@/lib/agents/schemas";
import { parseModelChoice, type ModelChoice } from "@/lib/models";
import type { DocInput } from "@/lib/batch/process";

export const maxDuration = 300;

const MAX_BYTES = 3 * 1024 * 1024; // matches the fill upload cap; keeps the body under 4.5 MB
const MAX_BODY = 4.5 * 1024 * 1024;

type BatchEvent = ProgressEvent | { type: "doc"; [k: string]: unknown };

async function readInput(req: Request, model: ModelChoice | undefined): Promise<DocInput> {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Send one PDF as 'file'.");
  if (file.type && file.type !== "application/pdf") throw new Error(`${file.name} is not a PDF.`);
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is over 3 MB.`);
  const pkg = form.get("package");
  const city = String(form.get("city") ?? "").trim().slice(0, 80);
  if (!city) throw new Error("Say which city this checklist is from.");
  return {
    pdfBase64: Buffer.from(await file.arrayBuffer()).toString("base64"),
    filename: file.name.slice(0, 200),
    city,
    projectType: ProjectType.catch("unknown").parse(form.get("projectType") ?? "adu"),
    packagePdfBase64: pkg instanceof File && pkg.size > 0 ? Buffer.from(await pkg.arrayBuffer()).toString("base64") : undefined,
    modelChoice: model,
  };
}

export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) {
    return Response.json({ error: "That upload is too large. Keep each file under 3 MB." }, { status: 413 });
  }
  let input: DocInput;
  let model: ModelChoice | undefined;
  const mock = new URL(req.url).searchParams.get("mock") === "1" || process.env.MOCK === "1";
  try {
    model = parseModelChoice(new URL(req.url).searchParams.get("model"));
    input = await readInput(req, model);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
  if (!mock && !process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "The server has no Claude API key. Add ?mock=1 to try the demo." }, { status: 500 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: BatchEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          closed = true;
        }
      };
      try {
        const { processDoc } = await import("@/lib/batch/process");
        const { withModel } = await import("@/lib/agents/client");
        const result = await withModel(model, () => processDoc(input, send, { mock }));
        send({ type: "doc", ...result });
      } catch (err) {
        console.error("[api/batch/doc]", err);
        send({ type: "error", message: (err as Error).message ?? "Unknown error" });
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {}
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
