// Check every source the skill depends on for changes since the saved baseline.
//   cd web && npx tsx scripts/check-sources.ts            # compare against ../data/source-baselines.json
//   cd web && npx tsx scripts/check-sources.ts --update   # save today's state as the new baseline
// One request per source, sequential, to be kind to servers. Exit code 2 if anything changed.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { compare, SOURCES, type Baseline, type Observation, type Source } from "../lib/features/source-monitor";

const UA = "Mozilla/5.0 (compatible; fast-path-check/0.1; hackathon prototype)";
const file = path.join(process.cwd(), "..", "data", "source-baselines.json");

async function observe(s: Source): Promise<Observation> {
  try {
    const res = await fetch(s.url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(30_000) });
    const o: Observation = { id: s.id, status: res.status };
    if (res.ok && s.kind === "hash") {
      o.sha256 = crypto.createHash("sha256").update(Buffer.from(await res.arrayBuffer())).digest("hex");
    } else if (res.ok && s.kind === "ckan") {
      const body = (await res.json()) as { result?: { metadata_modified?: string; resources?: Array<{ id: string; last_modified?: string }> } };
      const a2 = body.result?.resources?.find((r) => r.id === "fe505d9b-8c36-42ba-ba30-08bc4f34e022");
      o.lastModified = a2?.last_modified ?? body.result?.metadata_modified;
    } else {
      await res.body?.cancel();
    }
    return o;
  } catch (e) {
    return { id: s.id, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const current: Observation[] = [];
  for (const s of SOURCES) current.push(await observe(s));
  const baseline: Baseline | null = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  const changes = compare(SOURCES, current, baseline);
  const icon = { ok: "✓", changed: "Δ", new: "+", unexpected_status: "!", error: "✗" } as const;
  for (const c of changes) console.log(`${icon[c.level]} ${c.id.padEnd(26)} ${c.message}`);

  if (process.argv.includes("--update")) {
    const next: Baseline = { checkedOn: new Date().toISOString().slice(0, 10), observations: Object.fromEntries(current.map((o) => [o.id, o])) };
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
    console.log(`\nSaved baseline to ${file}`);
  }
  if (changes.some((c) => c.level === "changed" || c.level === "unexpected_status")) process.exitCode = 2;
}

main();
