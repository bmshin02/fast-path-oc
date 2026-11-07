// POST /api/batch/form: the marked-up form for ONE file the user opened from a batch.
//
// The producer edits the city's own PDF (corrected citations, possible-conflict notes, filled
// boxes, a change page). The browser already holds this file's parsed + compliance results from
// /api/batch/doc, so nothing is re-audited; it sends them back with the PDF. One file per
// request keeps the body under Vercel's 4.5 MB limit (the PDF goes as raw bytes, not base64).
//
// multipart/form-data: file (the original PDF, ≤ 3 MB), results (JSON: { parsed, compliance })
// ?model=sonnet|opus. ?mock=1, MOCK=1 or no API key: edits are planned by code from the
// findings (no model call), the same fallback the producer uses when its model call fails.

import { z } from "zod";
import { ComplianceResult, ParsedDoc } from "@/lib/agents/schemas";
import { parseModelChoice, type ModelChoice } from "@/lib/models";

export const maxDuration = 120;

const MAX_BYTES = 3 * 1024 * 1024;
const Results = z.object({ parsed: ParsedDoc, compliance: ComplianceResult });

export async function POST(req: Request) {
  const url = new URL(req.url);
  let model: ModelChoice | undefined;
  try {
    model = parseModelChoice(url.searchParams.get("model"));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
  const mock = url.searchParams.get("mock") === "1" || process.env.MOCK === "1" || !process.env.ANTHROPIC_API_KEY;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Send multipart form data with 'file' and 'results'." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Send the original PDF as 'file'." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: `${file.name} is over 3 MB.` }, { status: 413 });
  let results: z.infer<typeof Results>;
  try {
    results = Results.parse(JSON.parse(String(form.get("results") ?? "")));
  } catch {
    return Response.json({ error: "'results' must be this file's { parsed, compliance } from /api/batch/doc." }, { status: 400 });
  }

  try {
    const { editForm } = await import("@/lib/agents/producer");
    const { withModel } = await import("@/lib/agents/client");
    const input = {
      ...results,
      pdfBase64: Buffer.from(await file.arrayBuffer()).toString("base64"),
      filename: file.name.slice(0, 200),
    };
    const filled = await withModel(model, () => editForm(input, () => {}, { useModel: !mock }));
    return Response.json(filled);
  } catch (err) {
    console.error("[api/batch/form]", err);
    return Response.json({ error: (err as Error).message ?? "Couldn't mark up the form." }, { status: 500 });
  }
}
