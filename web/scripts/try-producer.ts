// Try the producer subagent by hand.
//   cd web && npx tsx scripts/try-producer.ts            # code-only assembly, no API call
//   cd web && npx tsx --env-file=.env.local scripts/try-producer.ts --live   # full run (one + two cities)
//
// Uses the real fixtures (anaheim-parsed.json, anaheim-compliance.json) when they exist,
// otherwise the hand-written *.sample.json files.

import fs from "node:fs";
import path from "node:path";
import { ComplianceResult, ParsedDoc, type ProgressEvent } from "../lib/agents/schemas";
import { assembleReport, renderMarkdown, runProducer } from "../lib/agents/producer";

const DIR = path.join(process.cwd(), "lib", "agents", "fixtures");

function load<T>(name: string, schema: { parse: (x: unknown) => T }): T {
  const real = path.join(DIR, `${name}.json`);
  const file = fs.existsSync(real) ? real : path.join(DIR, `${name}.sample.json`);
  console.log(`  loading ${path.basename(file)}`);
  const { _note, ...data } = JSON.parse(fs.readFileSync(file, "utf8"));
  void _note;
  return schema.parse(data);
}

const emit = (e: ProgressEvent) => {
  if (e.type === "progress") console.log(`  [${e.agent}] ${e.message}`);
};

async function main() {
  const anaheim = { parsed: load("anaheim-parsed", ParsedDoc), compliance: load("anaheim-compliance", ComplianceResult) };
  const irvine = { parsed: load("irvine-parsed", ParsedDoc), compliance: load("irvine-compliance", ComplianceResult) };

  // 1. Code-only assembly (no API key needed)
  const r = assembleReport(anaheim);
  console.log("\n== assembled (code only) ==");
  console.log("trafficLight:", r.trafficLight);
  console.log(renderMarkdown(r, anaheim.parsed.package !== null));

  if (!process.argv.includes("--live")) {
    console.log("\n(pass --live to run the model step)");
    return;
  }

  // 2. Single city, with the model's path note
  console.log("\n== live: Anaheim ==");
  const one = await runProducer({ inputs: [anaheim] }, emit);
  console.log("path note:", one.reports[0].path?.note);
  fs.writeFileSync(path.join(DIR, "anaheim-report.json"), JSON.stringify(one, null, 2));
  console.log("  saved fixtures/anaheim-report.json");

  // 3. Two cities (test 3 / C02)
  console.log("\n== live: Anaheim vs Irvine ==");
  const two = await runProducer({ inputs: [anaheim, irvine] }, emit);
  console.table(
    (two.comparison ?? []).map((row) => ({
      topic: row.topic,
      ...Object.fromEntries(row.values.map((v) => [v.city, v.value])),
    })),
  );
  fs.writeFileSync(path.join(DIR, "anaheim-irvine-report.json"), JSON.stringify(two, null, 2));
  console.log("  saved fixtures/anaheim-irvine-report.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
