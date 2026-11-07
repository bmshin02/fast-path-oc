// COMPLIANCE SUBAGENT: checks one ParsedDoc against current California law and picks the
// approval path + its legal clock. Server tools only (web search + web fetch, run by Anthropic),
// so there's no client tool loop; we only resume `pause_turn` when the server-side loop pauses.
//
// In:  ParsedDoc (+ optional note from the master, + checkSmap for multifamily)
// Out: ComplianceResult (schemas.ts), validated with zod, then passed through code guardrails
//      that the prompt alone can't guarantee (every item audited, no unsourced "stale" mapping).

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { client, MODEL, today, logUsage } from "./client";
import { RULES, reference, skill } from "./prompts";
import { mergeById, staleCitationCount } from "./findings";
import { ComplianceResult, type Emit, type ParsedDoc, type RunCompliance } from "./schemas";

const HANDBOOK_PDF =
  "https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/adu-handbook-update.pdf";
const APR_A2 = "fe505d9b-8c36-42ba-ba30-08bc4f34e022";
const MAX_PAUSE_RESUMES = 4;

// leginfo is search-only: it 403s on fetch (sources.md), so it's never in the fetch allow-list.
const SEARCH_DOMAINS = ["leginfo.legislature.ca.gov", "hcd.ca.gov", "data.ca.gov", "backyardadu.net"];
const FETCH_DOMAINS = ["hcd.ca.gov", "data.ca.gov", "backyardadu.net"];

/** Every official city host listed in reference/cities.md (stable across runs, so the prompt cache holds). */
function cityHosts(): string[] {
  const hosts = new Set<string>();
  for (const m of reference("cities").matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
    hosts.add(m[1].toLowerCase().replace(/^www\./, ""));
  }
  return [...hosts].sort();
}

/** APR Table A2 ADU-permits-by-year query for one city, pre-built so web_fetch is allowed to open it. */
function aprUrl(city: string): string {
  const juris = city.toUpperCase().replace(/'/g, "''");
  const sql =
    `SELECT "JURIS_NAME","YEAR",SUM("NO_BUILDING_PERMITS") AS bp_units FROM "${APR_A2}" ` +
    `WHERE "JURIS_NAME"='${juris}' AND "UNIT_CAT"='ADU' GROUP BY 1,2 ORDER BY 1,2`;
  return `https://data.ca.gov/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`;
}

const isAduProject = (p: ParsedDoc) => p.projectType === "adu" || p.projectType === "jadu";

// Stable across runs: keep it free of dates and per-run values so it caches.
function systemPrompt(): string {
  return `You are the compliance subagent of Fast Path Check, a prototype that checks Orange County, California housing permit checklists against current state law. A coordinator gives you one parsed checklist. You check it and return a ComplianceResult as JSON. You don't talk to the end user.

Your job, in order:
1. PATH. Pick the ministerial approval path for this project type using reference/pathways.md. Take the statute and legal clock from the exact section pathways.md names (for ADU/JADU that's Gov 66317: 15 business days to decide completeness with a list of every missing item, then 60 days from a complete application to approve or deny). Where sources.md records that section as hand-checked, cite its leginfo URL and say "hand-checked in a browser <date>, per reference/sources.md"; never say you read leginfo today. Cross-check it against the attached HCD ADU Handbook (or the HCD guidance in sources.md for other paths); if they disagree, show both. If neither confirms the clock, set clock to "unknown" and say why in unverified. If the project type is unknown or the checklist doesn't support a path, set path to null.
2. AUDIT EVERY ITEM. Return exactly one row per checklist item id you were given, using the same id. Never repeat an id: when a line has several findings, put them all in that one row (most serious status, every mapping in newCitation, every finding in the note). Status:
   - "stale": the item cites a section that was renumbered. Put the current section in newCitation (if an item cites several stale sections, list each mapping, e.g. "65852.2 → 66310–66342; 65852.22 → 66333"). Only use a mapping that reference/renumbering.md marks Confirmed or that a live source you read today states. A stale row must have a sourceUrl.
   - "current": every citation in the item is current law.
   - "uncited": the item is a requirement, document or fee with no legal authority cited. Local code citations (e.g. "AMC 18.38.015") count as cited, but state that it's local.
   - "possible_conflict": the item looks stricter than state law allows. The note must say what state law says, cite the section, and end with "Possible conflict, confirm with city staff or counsel." Never call anything illegal or invalid. Its sourceUrl is the statute section that sets the state rule (e.g. the leginfo URL for Gov 66333 from sources.md), not general guidance. An item can be both stale and a possible conflict; use "possible_conflict", still fill newCitation, and name the renumbering in the note too.
   - "unverified": you couldn't confirm it today (e.g. a section marked "fetch to confirm" in renumbering.md that no live source settled). newCitation must be null; never guess a section number.
   Purely informational items with no legal content are "uncited" with a short note.
3. STEPS. List what the applicant does, in order, with fee and time only when a source states them (otherwise null). Mark sign-offs that run outside the legal clock (e.g. a utility or sewer check) with outsidePlanningClock=true. Source each step: the city's checklist URL from cities.md, or the HCD source.
4. HCD LETTERS. Start with the HCD letters reference/cities.md lists for this city: return each one (title, date, URL) and say in hcdLettersNote what it found that bears on this checklist (e.g. HCD told the city to stop citing the deleted sections and the checklist still cites them). If cities.md lists none, web-search for the city's ordinance-review letters (URL pattern in sources.md). HCD's enforcement dashboard is an embedded app you can't read. If you find no letter, return an empty list and set hcdLettersNote to "unknown: no HCD letter found for <city> today; ask HAUportal@hcd.ca.gov for copies".
5. TIMELINES. Fetch the APR Table A2 URL given in the request and report ADU building-permit units by year exactly as returned, one row per year, with the URL as the source. Metric names like "ADU building-permit units, 2024 (APR Table A2)". Don't compute medians or durations you weren't given. If the fetch fails, leave timelines empty and say so in unverified.
6. UNVERIFIED. List everything you couldn't confirm today, one plain sentence each: blocked fetches, statute text not read live, unknown fees, reference rows that disagree with a live source (say "reference/<file>.md needs updating").

How to use the tools:
- One fetch per URL. If a fetch fails, don't retry it; try web search once, then mark it unverified.
- Never fetch leginfo.legislature.ca.gov (it returns 403). Web search may show its snippets; you may use them and say so in the note ("per leginfo search snippet").
- Prefer the attached HCD ADU Handbook over fetching it again. Cite it as ${HANDBOOK_PDF}.
- Stop searching once each item and the path have a source or are marked unverified. Don't crawl.

Writing:
- Notes are one or two short sentences a city permit tech can read. Plain words.
- checkedOn is today's date from the request.
- sourceUrl is a URL you read or that the reference files give for that exact claim, never a homepage you didn't open.

${RULES}

===== fast-path-check/SKILL.md =====
${skill()}

===== reference/renumbering.md =====
${reference("renumbering")}

===== reference/pathways.md =====
${reference("pathways")}

===== reference/sources.md =====
${reference("sources")}

===== reference/cities.md =====
${reference("cities")}`;
}

function requestText(parsed: ParsedDoc, note?: string, checkSmap?: boolean): string {
  const items = parsed.items.map(({ id, text, page, citations, kind }) => ({ id, page, kind, citations, text }));
  return [
    `Today is ${today()}.`,
    `City: ${parsed.city}`,
    `Project type: ${parsed.projectType}`,
    `Document: ${parsed.docTitle}${parsed.docDate ? ` (dated ${parsed.docDate})` : ""}`,
    `APR Table A2 URL for this city: ${aprUrl(parsed.city)}`,
    checkSmap
      ? "Multifamily project: also fetch the HCD SMAP dashboard (sources.md) and say whether SB 35/423 streamlining applies in this city."
      : "",
    isAduProject(parsed)
      ? "The HCD ADU Handbook (Mar 2026) is attached above."
      : "No handbook attached; use the HCD guidance in sources.md for this path.",
    note ? `Note from the coordinator (this is a re-run): ${note}` : "",
    "",
    `Checklist items (${items.length}). Return one audit row per id:`,
    JSON.stringify(items, null, 1),
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** Short progress lines for the UI as server tools run. */
function describeBlock(block: Anthropic.Beta.BetaContentBlock): string | null {
  if (block.type === "server_tool_use") {
    const input = (block.input ?? {}) as { query?: string; url?: string };
    if (block.name === "web_search" && input.query) return `Searching: ${input.query}`;
    if (block.name === "web_fetch" && input.url) return `Fetching ${input.url}`;
  }
  if (block.type === "web_fetch_tool_result") {
    const c = block.content as { type: string; error_code?: string; url?: string };
    if (c.type === "web_fetch_tool_result_error") return `Fetch failed (${c.error_code}); will mark unverified`;
  }
  if (block.type === "web_search_tool_result" && !Array.isArray(block.content)) {
    return `Search failed (${(block.content as { error_code?: string }).error_code})`;
  }
  return null;
}

/** Deterministic checks the prompt can't guarantee. */
function enforceGuardrails(result: ComplianceResult, parsed: ParsedDoc, emit: Emit): ComplianceResult {
  const ids = new Set(parsed.items.map((i) => i.id));
  const seen = new Set<string>();
  const unverified = [...result.unverified];

  // One row per line: if the model repeated an id for several findings, merge them rather than
  // drop all but the first (that would lose a possible conflict listed after a stale citation).
  const items = mergeById(result.items).flatMap((row) => {
    if (!ids.has(row.id)) return []; // unknown id: the UI joins on id
    seen.add(row.id);
    // A renumbering with no source is a guess. Downgrade it (trick test 4).
    if (row.status === "stale" && (!row.sourceUrl || !row.newCitation)) {
      unverified.push(`Item ${row.id}: current section for its citation not confirmed today.`);
      return [{ ...row, status: "unverified" as const, newCitation: null, note: `Not confirmed today. ${row.note}` }];
    }
    if (row.status === "unverified" && row.newCitation) return [{ ...row, newCitation: null }];
    return [row];
  });

  const missing = parsed.items.filter((i) => !seen.has(i.id));
  for (const i of missing) {
    items.push({ id: i.id, status: "unverified", newCitation: null, note: "Not checked in this run.", sourceUrl: null });
  }
  if (missing.length > 0) {
    unverified.push(`${missing.length} checklist item(s) weren't checked in this run.`);
    emit({ type: "progress", agent: "compliance", message: `${missing.length} item(s) not audited; marked unverified` });
  }

  const order = new Map(parsed.items.map((i, n) => [i.id, n]));
  items.sort((a, b) => order.get(a.id)! - order.get(b.id)!);

  return { ...result, checkedOn: today(), items, unverified };
}

export const runCompliance: RunCompliance = async ({ parsed, note, checkSmap }, emit) => {
  emit({
    type: "progress",
    agent: "compliance",
    message: `Checking ${parsed.items.length} lines and ${new Set(parsed.items.flatMap((i) => i.citations)).size} citations for ${parsed.city}`,
  });

  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: 6, allowed_domains: SEARCH_DOMAINS },
    {
      type: "web_fetch_20260209",
      name: "web_fetch",
      max_uses: 8,
      allowed_domains: [...new Set([...FETCH_DOMAINS, ...cityHosts()])],
      max_content_tokens: 40000,
    },
  ];

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (isAduProject(parsed)) {
    content.push({
      type: "document",
      source: { type: "url", url: HANDBOOK_PDF },
      title: "HCD ADU Handbook (Mar 2026, with Jan 2026 addendum)",
      cache_control: { type: "ephemeral", ttl: "1h" },
    });
  }
  content.push({ type: "text", text: requestText(parsed, note, checkSmap) });

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content }];
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: systemPrompt(), cache_control: { type: "ephemeral", ttl: "1h" } },
  ];

  for (let resumes = 0; ; resumes++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: betaZodOutputFormat(ComplianceResult) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      tools,
      messages,
    });
    stream.on("contentBlock", (block) => {
      const msg = describeBlock(block);
      if (msg) emit({ type: "progress", agent: "compliance", message: msg });
    });

    const message = await stream.finalMessage();
    logUsage("compliance", message.usage);

    if (message.stop_reason === "pause_turn") {
      if (resumes >= MAX_PAUSE_RESUMES) throw new Error("Compliance check ran too long (server tool loop kept pausing).");
      messages.push({ role: "assistant", content: message.content });
      emit({ type: "progress", agent: "compliance", message: "Still checking sources" });
      continue;
    }
    if (message.stop_reason === "refusal") {
      throw new Error(`Compliance subagent declined (${message.stop_details?.category ?? "no category"}).`);
    }
    if (message.stop_reason === "max_tokens") {
      throw new Error("Compliance subagent ran out of output tokens before finishing.");
    }

    const output = message.parsed_output ?? null;
    if (!output) throw new Error("Compliance subagent returned no valid ComplianceResult JSON.");

    const result = enforceGuardrails(output, parsed, emit);
    const stale = result.items.reduce((n, i) => n + staleCitationCount(i.newCitation), 0);
    const conflicts = result.items.filter((i) => i.status === "possible_conflict").length;
    emit({
      type: "progress",
      agent: "compliance",
      message: `Done: path ${result.path ? `"${result.path.name}", ${result.path.clock}` : "not found"}; ${stale} stale, ${conflicts} possible conflict(s), ${result.unverified.length} unverified`,
    });
    return result;
  }
};
