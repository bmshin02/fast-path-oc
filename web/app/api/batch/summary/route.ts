// POST /api/batch/summary  { "digests": DocDigest[] }  → BatchSummary
// Cross-document rollup computed in code from compact digests (lib/batch/aggregate.ts):
// totals, per-city, stale citations that recur across files, which files to look at first.
// No model call, so its cost and accuracy don't change with the number of files.

import { aggregate } from "@/lib/batch/aggregate";
import type { DocDigest } from "@/lib/batch/digest";

const MAX_DOCS = 25;

function looksLikeDigest(d: unknown): d is DocDigest {
  const x = d as Partial<DocDigest>;
  return (
    !!x &&
    typeof x.key === "string" &&
    typeof x.filename === "string" &&
    typeof x.city === "string" &&
    typeof x.itemCount === "number" &&
    !!x.statusCounts &&
    Array.isArray(x.staleMappings) &&
    Array.isArray(x.scannerOnlyStale)
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { digests?: unknown[] } | null;
  const digests = body?.digests;
  if (!Array.isArray(digests) || digests.length === 0) return Response.json({ error: "Send { digests: [...] }." }, { status: 400 });
  if (digests.length > MAX_DOCS) return Response.json({ error: `At most ${MAX_DOCS} documents per batch.` }, { status: 400 });
  if (!digests.every(looksLikeDigest)) return Response.json({ error: "One or more digests are malformed." }, { status: 400 });
  return Response.json(aggregate(digests));
}
