// POST /api/tools/delay-cost  { price, monthsOfDelay, downPaymentPct?, annualRatePct?,
//                               monthlyTaxesAndInsurance?, targetProfit? }
// Interest carrying cost of permit delay (mentor's framework). Every input is an ASSUMPTION.

import { z } from "zod";
import { delayCost } from "@/lib/features/delay-cost";

const Body = z.object({
  price: z.number().positive().max(1e9),
  monthsOfDelay: z.number().min(0).max(600),
  downPaymentPct: z.number().min(0).max(99).optional(),
  annualRatePct: z.number().min(0).max(30).optional(),
  monthlyTaxesAndInsurance: z.number().min(0).max(1e6).optional(),
  targetProfit: z.number().positive().max(1e9).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  return Response.json(delayCost(parsed.data));
}
