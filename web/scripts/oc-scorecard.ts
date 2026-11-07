// Build the Orange County ADU scorecard from the two data files.
//   cd web && npx tsx scripts/apr-oc.ts        # refresh APR data first (optional)
//   cd web && npx tsx scripts/oc-scorecard.ts
// Writes ../data/oc-adu-scorecard.json and prints the Markdown table.

import fs from "node:fs";
import path from "node:path";
import type { CitySummary } from "../lib/features/apr";
import { buildScorecard, scorecardMarkdown, type HcdLetterRef } from "../lib/features/scorecard";

const repo = path.join(process.cwd(), "..");
const apr = JSON.parse(fs.readFileSync(path.join(repo, "data", "oc-adu-apr.json"), "utf8")) as {
  fetchedOn: string;
  cities: CitySummary[];
};
const letters = JSON.parse(fs.readFileSync(path.join(repo, "data", "oc-hcd-letters.json"), "utf8")) as {
  jurisdictions: Record<string, HcdLetterRef[]>;
};

const rows = buildScorecard(apr.cities, letters.jurisdictions);
fs.writeFileSync(
  path.join(repo, "data", "oc-adu-scorecard.json"),
  JSON.stringify({ builtFrom: ["data/oc-adu-apr.json", "data/oc-hcd-letters.json"], aprFetchedOn: apr.fetchedOn, rows }, null, 2) + "\n",
);
console.log(scorecardMarkdown(rows, apr.fetchedOn));
const withLetters = rows.filter((r) => r.hcd.letters > 0).length;
const enforcement = rows.filter((r) => r.hcd.enforcement).map((r) => r.jurisdiction);
console.error(`\n${rows.length} jurisdictions; ${withLetters} with HCD ADU letters; enforcement: ${enforcement.join(", ") || "none"}`);
