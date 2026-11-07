// POST /api/tools/shot-clock
// Gov. Code 66317 deadlines for an ADU application, plus (optionally) a draft letter.
// Body: {
//   submissions: [{ received: "YYYY-MM-DD", noticeDate?, noticeResult?: "complete"|"incomplete",
//                   listedItems?: string[], newItemsRequested?: string[] }, ...],
//   existingDwelling: boolean, submittedWithNewDwelling?: boolean, decisionDate?, tolledDays?,
//   today?: "YYYY-MM-DD" (defaults to today), extraClosures?: string[],
//   letter?: { city: string, projectLabel?: string }
// }
// Never include names, addresses or permit numbers: the letter uses [PLACEHOLDERS].

import { z } from "zod";
import { computeClock } from "@/lib/features/shot-clock";
import { draftCompletenessLetter } from "@/lib/features/completeness-letter";

const Date_ = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Body = z.object({
  submissions: z
    .array(
      z.object({
        received: Date_,
        noticeDate: Date_.nullish(),
        noticeResult: z.enum(["complete", "incomplete"]).nullish(),
        listedItems: z.array(z.string().max(200)).max(100).optional(),
        newItemsRequested: z.array(z.string().max(200)).max(100).optional(),
      }),
    )
    .min(1)
    .max(10),
  existingDwelling: z.boolean(),
  submittedWithNewDwelling: z.boolean().optional(),
  decisionDate: Date_.nullish(),
  tolledDays: z.number().int().min(0).max(3650).optional(),
  today: Date_.optional(),
  extraClosures: z.array(Date_).max(400).optional(),
  letter: z.object({ city: z.string().max(80), projectLabel: z.string().max(80).optional() }).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  const { letter, ...rest } = parsed.data;
  const input = { ...rest, today: rest.today ?? new Date().toISOString().slice(0, 10) };
  try {
    if (letter) {
      const l = draftCompletenessLetter({ ...input, city: letter.city, projectLabel: letter.projectLabel });
      return Response.json({ clock: l.clock, letter: { applies: l.applies, subject: l.subject, body: l.body } });
    }
    return Response.json({ clock: computeClock(input) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
