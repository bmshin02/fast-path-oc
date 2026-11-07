// GET /api/tools/oc                  → the whole Orange County ADU scorecard
// GET /api/tools/oc?city=Anaheim     → one jurisdiction: scorecard row + every HCD letter
// Reads ../data (built by scripts/apr-oc.ts and scripts/oc-scorecard.ts). No API key.

import fs from "node:fs";
import path from "node:path";

const DATA = path.join(process.cwd(), "..", "data");

function read<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8")) as T;
}

type Scorecard = { aprFetchedOn: string; rows: Array<{ jurisdiction: string } & Record<string, unknown>> };
type Letters = { checkedOn: string; caveats: string[]; jurisdictions: Record<string, unknown[]> };

export async function GET(req: Request) {
  // Read the request first: with Cache Components on, touching req.url makes this a
  // request-time handler instead of a build-time prerender.
  const city = new URL(req.url).searchParams.get("city");
  let scorecard: Scorecard;
  let letters: Letters;
  try {
    scorecard = read<Scorecard>("oc-adu-scorecard.json");
    letters = read<Letters>("oc-hcd-letters.json");
  } catch {
    return Response.json({ error: "Data files missing. Run scripts/apr-oc.ts and scripts/oc-scorecard.ts." }, { status: 500 });
  }
  if (!city) {
    return Response.json({ aprFetchedOn: scorecard.aprFetchedOn, lettersCheckedOn: letters.checkedOn, caveats: letters.caveats, rows: scorecard.rows });
  }
  const key = city.trim().toUpperCase();
  const row = scorecard.rows.find((r) => r.jurisdiction === key);
  if (!row) {
    return Response.json(
      { error: `Unknown jurisdiction "${city}"`, options: scorecard.rows.map((r) => r.jurisdiction) },
      { status: 404 },
    );
  }
  return Response.json({ row, letters: letters.jurisdictions[key] ?? [], caveats: letters.caveats });
}
