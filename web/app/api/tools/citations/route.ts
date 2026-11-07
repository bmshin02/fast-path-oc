// POST /api/tools/citations  { "text": "...checklist text..." }
// Deterministic Gov. Code citation scan: finds citations and maps renumbered ones to current law
// using HCD's conversion table. No model, no API key. See lib/features/citations.ts.

import { z } from "zod";
import { scanText, summarize } from "@/lib/features/citations";

const Body = z.object({ text: z.string().max(500_000) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send JSON: { text: string } (max 500k chars)" }, { status: 400 });
  const results = scanText(parsed.data.text);
  return Response.json({
    summary: summarize(results),
    citations: results.map((r) => ({ raw: r.raw, section: r.section, subdivision: r.subdivision, ...r.mapping })),
    checkedOn: "2026-11-07",
    note: "Deterministic cross-check. Sections not in our table come back 'unverified', never guessed.",
  });
}
