// Try the producer subagent by hand: it marks up the Anaheim Z412 checklist PDF using the
// recorded run's findings and writes the edited PDF to disk.
//   cd web && npx tsx scripts/try-producer.ts                 # code-only markup, no API call
//   cd web && npx tsx --env-file=.env.local scripts/try-producer.ts --live   # model plans the edits
//   add --out <dir> to choose where the PDF goes (default: the OS temp folder)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ProgressEvent } from "../lib/agents/schemas";
import { editForm } from "../lib/agents/producer";
import { recordedInput } from "../lib/agents/mock";

const PDF = path.join(process.cwd(), "public", "forms", "anaheim-adu-checklist.pdf");

const emit = (e: ProgressEvent) => {
  if (e.type === "progress") console.log(`  [${e.agent}] ${e.message}`);
};

async function main() {
  const live = process.argv.includes("--live");
  const outArg = process.argv.indexOf("--out");
  const outDir = outArg > -1 ? process.argv[outArg + 1] : os.tmpdir();

  const form = await editForm(
    { ...recordedInput, pdfBase64: fs.readFileSync(PDF).toString("base64"), filename: path.basename(PDF) },
    emit,
    { useModel: live },
  );

  console.log(`\n== ${live ? "live" : "code-only"}: ${form.city} ==`);
  console.table(
    form.changes.map((c) => ({
      kind: c.kind,
      no: c.number ?? "",
      page: c.page ?? "",
      original: c.original.slice(0, 40),
      newText: c.newText ?? "",
      placed: c.placed,
    })),
  );
  const out = path.join(outDir, form.fileName);
  fs.writeFileSync(out, Buffer.from(form.pdfBase64, "base64"));
  console.log(`  saved ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
