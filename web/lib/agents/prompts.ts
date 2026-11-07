import fs from "node:fs";
import path from "node:path";

// The rules and reference data live in ../fast-path-check (source of truth, owned by Person B).
// Read at request time and memoized, so edits to reference/*.md show up on the next dev-server restart.
const ROOT = path.join(process.cwd(), "..", "fast-path-check");

const cache = new Map<string, string>();
function read(rel: string): string {
  let text = cache.get(rel);
  if (text === undefined) {
    text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    cache.set(rel, text);
  }
  return text;
}

export type ReferenceFile = "pathways" | "renumbering" | "sources" | "cities" | "report-template";

export const skill = () => read("SKILL.md");
export const reference = (name: ReferenceFile) => read(`reference/${name}.md`);

/** The rules every agent's system prompt starts with (PLAN.md §3). */
export const RULES = `Rules that do not bend:
- Never invent a statute, section number, fee, deadline, address or parcel fact. If the source doesn't say, the answer is "unknown".
- Every legal or numeric claim gets a source URL and the date checked (today's date).
- Live source beats reference file. If they disagree, show both with dates, don't pick silently, and flag that reference/ needs updating.
- Label assumptions ASSUMPTION.
- Say "possible conflict, confirm with city staff or counsel". Never call anything illegal.
- No personal information. If an upload contains a real person's details, stop and say so.
- Never submit, email or file anything. Draft only.
- Be kind to servers: one fetch per page, no bulk crawling.
- leginfo.legislature.ca.gov returns 403 to automated fetches. Don't fetch it; use the hand-checked rows in the reference files, HCD guidance, and web search. Never claim to have read leginfo live.`;
