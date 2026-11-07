// POST /api/check: runs the master agent and streams ProgressEvents back as NDJSON
// (one JSON object per line). Server only: the API key never reaches the browser.
//
// multipart/form-data fields:
//   mode         "checklist" | "site"            (default "checklist")
//   projectType  ProjectType                     (default "adu")
//   checklist    1 or 2 PDF files
//   city         one per checklist, same order   (e.g. city=Anaheim&city=Irvine)
//   package      optional applicant package PDF
//   site         site-mode listing text
//
// Optional query parameter:
//   ?model=sonnet | opus   run every agent on that model (default: each agent's own model,
//                          see DEFAULT_MODELS in lib/agents/client.ts). Anything else is a 400.
//
// MOCK=1 in the env streams the canned report from lib/agents/mock.ts with no API calls.

import { ProjectType, type CheckInput, type ProgressEvent } from "@/lib/agents/schemas";
import { parseModelChoice, type ModelChoice } from "@/lib/models";

export const maxDuration = 300;

const MAX_PDF_BYTES = 20 * 1024 * 1024;

async function pdfToBase64(f: File): Promise<string> {
  if (f.type && f.type !== "application/pdf") throw new Error(`${f.name} is not a PDF`);
  if (f.size > MAX_PDF_BYTES) throw new Error(`${f.name} is over 20 MB`);
  return Buffer.from(await f.arrayBuffer()).toString("base64");
}

async function readInput(req: Request): Promise<CheckInput> {
  const form = await req.formData();
  const mode = form.get("mode") === "site" ? "site" : "checklist";
  const projectType = ProjectType.catch("unknown").parse(form.get("projectType") ?? "adu");
  const files = form.getAll("checklist").filter((v): v is File => v instanceof File);
  const cities = form.getAll("city").map(String);
  if (files.length > 2) throw new Error("Upload at most two checklists.");

  const checklists = await Promise.all(
    files.map(async (f, i) => ({
      city: cities[i] ?? cities[0] ?? "unknown",
      filename: f.name,
      pdfBase64: await pdfToBase64(f),
    })),
  );
  const pkg = form.get("package");
  return {
    mode,
    city: cities[0] ?? "unknown",
    projectType,
    checklists,
    packagePdfBase64: pkg instanceof File && pkg.size > 0 ? await pdfToBase64(pkg) : undefined,
    siteDescription: (form.get("site") as string | null) ?? undefined,
  };
}

export async function POST(req: Request) {
  let input: CheckInput;
  let model: ModelChoice | undefined;
  try {
    model = parseModelChoice(new URL(req.url).searchParams.get("model"));
    input = await readInput(req);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: ProgressEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // client disconnected; keep running so usage is still logged
        }
      };
      try {
        if (process.env.MOCK === "1") {
          const { mockEvents, mockReport } = await import("@/lib/agents/mock");
          for (const e of mockEvents) {
            emit(e);
            await new Promise((r) => setTimeout(r, 600));
          }
          emit({ type: "result", outcome: { kind: "report", report: mockReport } });
        } else {
          const { runMaster } = await import("@/lib/agents/master");
          const { withModel, modelFor } = await import("@/lib/agents/client");
          const outcome = await withModel(model, async () => {
            const roles = ["coordinator", "parser", "compliance", "producer"] as const;
            emit({
              type: "progress",
              agent: "master",
              message: `Models${model ? ` (?model=${model})` : ""}: ${roles.map((r) => `${r} ${modelFor(r)}`).join(", ")}`,
            });
            return runMaster(input, emit);
          });
          emit({ type: "result", outcome });
        }
      } catch (err) {
        console.error("[api/check]", err);
        emit({ type: "error", message: (err as Error).message ?? "Unknown error" });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
