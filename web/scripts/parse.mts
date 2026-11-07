// Run the parser subagent alone on a PDF (one real API call, effort low).
//   cd web && npx tsx --env-file=.env.local scripts/parse.mts ../evals/fixtures/anaheim-adu-checklist-z412-nov-2025.pdf Anaheim
// Optional third arg: an applicant package PDF.

import fs from "node:fs";
import { runParser } from "../lib/agents/parser";

const [pdf, city = "unknown", pkg] = process.argv.slice(2);
if (!pdf) {
  console.error("usage: scripts/parse.mts <checklist.pdf> [city] [package.pdf]");
  process.exit(1);
}

const t0 = Date.now();
const doc = await runParser(
  {
    pdfBase64: fs.readFileSync(pdf).toString("base64"),
    city,
    projectType: "adu",
    packagePdfBase64: pkg ? fs.readFileSync(pkg).toString("base64") : undefined,
  },
  (e) => console.error(`[${e.type === "progress" ? e.agent : e.type}]`, "message" in e ? e.message : ""),
);
console.log(JSON.stringify(doc, null, 2));
console.error(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
