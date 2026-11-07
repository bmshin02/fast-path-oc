// Score our audit of a city document against HCD's findings for that city.
//   cd web && npx tsx scripts/score-hcd.ts                       # Anaheim checklist, scanner only
//   cd web && npx tsx scripts/score-hcd.ts --compliance lib/agents/fixtures/anaheim-compliance.sample.json
//   cd web && npx tsx scripts/score-hcd.ts --letter irvine-2025-01-07 --text path/to/text.txt
// No API key needed: the scanner is deterministic, and --compliance reads a saved agent output.

import fs from "node:fs";
import path from "node:path";
import { scanText } from "../lib/features/citations";
import { flagsFromCompliance, flagsFromScan, formatScore, scoreAudit, type HcdKey } from "../lib/features/hcd-score";

const args = process.argv.slice(2);
const opt = (name: string, def: string | null = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};

const repo = path.join(process.cwd(), "..");
const key = JSON.parse(fs.readFileSync(path.join(repo, "data", "hcd-findings.json"), "utf8")) as HcdKey;
const letterId = opt("letter", "anaheim-2025-03-24")!;
const letter = key.letters.find((l) => l.id === letterId);
if (!letter) throw new Error(`No letter ${letterId}. Options: ${key.letters.map((l) => l.id).join(", ")}`);

const textPath = opt("text", path.join(repo, "evals", "fixtures", "anaheim-adu-checklist-z412-nov-2025.txt"))!;
const text = fs.readFileSync(textPath, "utf8");

const flags = flagsFromScan(scanText(text));
const compliancePath = opt("compliance");
if (compliancePath) flags.push(...flagsFromCompliance(JSON.parse(fs.readFileSync(compliancePath, "utf8"))));

console.log(`Document: ${path.relative(repo, textPath)}${compliancePath ? ` + agent output ${compliancePath}` : " (scanner only)"}\n`);
console.log(formatScore(scoreAudit(letter, flags, text)));
