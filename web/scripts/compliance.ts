// Run the compliance subagent alone (one real API call, effort high, with web search/fetch).
//   cd web && npx tsx --env-file=.env.local scripts/compliance.ts                 # built-in Anaheim fixture
//   cd web && npx tsx --env-file=.env.local scripts/compliance.ts parsed.json     # output of scripts/parse.ts
//   ... scripts/compliance.ts parsed.json "re-run note"                            # simulate a master re-run
//
// Chain them: npx tsx --env-file=.env.local scripts/parse.ts <pdf> Anaheim > /tmp/p.json && \
//             npx tsx --env-file=.env.local scripts/compliance.ts /tmp/p.json

import fs from "node:fs";
import { runCompliance } from "../lib/agents/compliance";
import { ParsedDoc } from "../lib/agents/schemas";

// Hand-written from fast-path-check/reference/cities.md (Anaheim Z412, Nov 2025). Test fixture only.
// p1-6 cites 65852.26 on purpose: trick test 4 (unmapped old cite must come back unverified, not guessed).
const ANAHEIM_FIXTURE: ParsedDoc = {
  isChecklist: true,
  containsPersonalInfo: false,
  city: "Anaheim",
  projectType: "adu",
  docTitle: "Accessory Dwelling Unit Submittal Requirements Checklist (Z412)",
  docDate: "2025-11",
  package: null,
  items: [
    { id: "p1-1", page: 1, kind: "requirement", citations: [], text: "Sewer deficiency verification from Public Works. Email request; allow up to four days." },
    { id: "p1-2", page: 1, kind: "document", citations: [], text: "Meter spot report, if adding, upgrading or moving an electric meter." },
    { id: "p1-3", page: 1, kind: "document", citations: [], text: "New address request." },
    {
      id: "p1-4",
      page: 1,
      kind: "requirement",
      citations: ["AMC 18.38.015.110", "California Government Code Section 65852.2", "California Government Code Section 65852.22"],
      text: "JADUs only: Owner-occupancy covenant, required by AMC 18.38.015.110 and authorized by the California Government Code Sections 65852.2 and 65852.22. Drafted by the City Attorney and recorded before permit issuance.",
    },
    { id: "p1-5", page: 1, kind: "document", citations: [], text: "Title report (prepared within the last 6 months) and grant deed, for the covenant." },
    { id: "p1-6", page: 1, kind: "info", citations: ["Gov. Code 65852.26"], text: "[TEST LINE, not in the real checklist] See Government Code Section 65852.26." },
  ],
};

// No top-level await: web/package.json isn't "type": "module", so tsx compiles this as CJS.
async function main() {
  const [file, note] = process.argv.slice(2);
  const parsed = file ? ParsedDoc.parse(JSON.parse(fs.readFileSync(file, "utf8"))) : ANAHEIM_FIXTURE;

  const t0 = Date.now();
  const result = await runCompliance({ parsed, note }, (e) =>
    console.error(`[${e.type === "progress" ? e.agent : e.type}]`, "message" in e ? e.message : ""),
  );
  console.log(JSON.stringify(result, null, 2));
  console.error(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
