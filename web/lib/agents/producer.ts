// PRODUCER SUBAGENT: turns parsed + checked documents into the final report.
//
// Code does everything that has a right answer (joins, counts, gap list, "couldn't verify",
// Markdown), so the traffic-light numbers can't be miscounted and no source gets dropped.
// The model writes only the parts that need judgment: why this path fits, and the two-city
// comparison. If the model call fails, the report still ships with those parts left plain.

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { client, MODELS, today, logUsage } from "./client";
import { mergeById, staleCitationCount } from "./findings";
import { RULES } from "./prompts";
import {
  FinalReport,
  type ComplianceResult,
  type Emit,
  type ParsedDoc,
  type Report,
  type RunProducer,
} from "./schemas";

type Input = { parsed: ParsedDoc; compliance: ComplianceResult };

const DISCLAIMER = "Prototype · not legal advice";

// ---------- deterministic assembly ----------

export function assembleReport({ parsed, compliance }: Input): Report {
  const itemsById = new Map(parsed.items.map((i) => [i.id, i]));
  // One audit row per checklist line. A line with several findings (e.g. two stale citations +
  // a possible conflict) is merged into one row showing the most serious status.
  const merged = mergeById(compliance.items);
  const findingById = new Map(merged.map((c) => [c.id, c]));

  // Every parsed line appears in the audit table, even if compliance skipped it.
  const auditTable: Report["auditTable"] = parsed.items.map((item) => {
    const c = findingById.get(item.id);
    if (!c) {
      return {
        itemId: item.id,
        line: item.text,
        page: item.page,
        cites: item.citations,
        status: item.citations.length ? ("unverified" as const) : ("uncited" as const),
        newCitation: null,
        note: "Not checked in this run.",
        sourceUrl: null,
      };
    }
    return {
      itemId: item.id,
      line: item.text,
      page: item.page,
      cites: item.citations,
      status: c.status,
      newCitation: c.newCitation,
      note: c.note,
      sourceUrl: c.sourceUrl,
    };
  });
  // Compliance rows that don't match a parsed line (shouldn't happen) are kept, not dropped.
  for (const c of merged) {
    if (!itemsById.has(c.id)) {
      auditTable.push({
        itemId: c.id,
        line: "(line not found in parsed checklist)",
        page: 0,
        cites: [],
        status: c.status,
        newCitation: c.newCitation,
        note: c.note,
        sourceUrl: c.sourceUrl,
      });
    }
  }

  const packageGaps: Report["packageGaps"] = (parsed.package ?? [])
    .filter((p) => p.status !== "present")
    .map((p) => ({ item: itemsById.get(p.itemId)?.text ?? p.itemId, status: p.status, note: p.note }));

  const couldntVerify = [
    ...compliance.unverified,
    ...auditTable
      .filter((r) => r.status === "unverified" && !compliance.unverified.some((u) => u.includes(r.itemId)))
      .map((r) => `${r.itemId} "${truncate(r.line, 80)}": ${r.note}`),
  ];
  if (!compliance.path) couldntVerify.push("No approval path could be confirmed from a live source today.");
  if (compliance.hcdLetters.length === 0 && compliance.hcdLettersNote)
    couldntVerify.push(`HCD letters: ${compliance.hcdLettersNote}`);

  const count = (s: Report["auditTable"][number]["status"]) => auditTable.filter((r) => r.status === s).length;

  const report: Report = {
    header: {
      city: parsed.city,
      projectType: parsed.projectType,
      docTitle: parsed.docTitle,
      checkedOn: compliance.checkedOn || today(),
      disclaimer: DISCLAIMER,
    },
    trafficLight: {
      pathFound: compliance.path !== null,
      // Counts citations, not lines: a possible-conflict row can also carry renumbered cites.
      staleCitations: auditTable.reduce((n, r) => n + staleCitationCount(r.newCitation), 0),
      possibleConflicts: count("possible_conflict"),
      gaps: packageGaps.length,
    },
    path: compliance.path ? { ...compliance.path, note: "" } : null,
    stepsAndFees: [...compliance.steps].sort((a, b) => a.order - b.order),
    auditTable,
    timelines: compliance.timelines,
    hcdLetters: { letters: compliance.hcdLetters, note: compliance.hcdLettersNote },
    packageGaps,
    couldntVerify,
    markdown: "",
  };
  return report;
}

// ---------- Markdown (follows fast-path-check/reference/report-template.md) ----------

const STATUS_LABEL: Record<Report["auditTable"][number]["status"], string> = {
  current: "Current",
  stale: "**Stale**",
  uncited: "Uncited",
  possible_conflict: "**Possible conflict**",
  unverified: "Unknown",
};

const PROJECT_LABEL: Record<Report["header"]["projectType"], string> = {
  adu: "ADU",
  jadu: "JADU",
  sb9_two_unit: "SB 9 (2021) two-unit",
  sb9_lot_split: "SB 9 (2021) lot split",
  sb684_small_subdivision: "SB 684 small subdivision",
  streamlined_multifamily: "Streamlined multifamily",
  unknown: "Project type unknown",
};

function cell(s: string | null | undefined): string {
  return (s ?? "").replace(/\|/g, "\\|").replace(/\n+/g, " ");
}
function link(url: string | null | undefined, label = "source"): string {
  return url ? `[${label}](${url})` : "none";
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function renderMarkdown(r: Report, packageProvided: boolean): string {
  const d = r.header.checkedOn;
  const out: string[] = [];
  out.push(`## Fast Path Check: ${r.header.city}, ${PROJECT_LABEL[r.header.projectType]}`);
  out.push(`**Date checked:** ${d} · **${r.header.disclaimer}**`, "");

  out.push("### At a glance");
  out.push("| Path found | Stale citations | Possible conflicts | Package gaps |", "|---|---|---|---|");
  out.push(
    `| ${r.path ? cell(r.path.name) : "none confirmed"} | ${r.trafficLight.staleCitations} | ${
      r.trafficLight.possibleConflicts
    } | ${packageProvided ? r.trafficLight.gaps : "no package provided"} |`,
    "",
  );

  out.push("### 1. Path and legal clock");
  if (r.path) {
    out.push(`- **Path:** ${r.path.name}`);
    out.push(`- **Clock:** ${r.path.clock}, per ${link(r.path.sourceUrl, r.path.statute)} (checked ${d})`);
    if (r.path.note) out.push(`- **Why this path:** ${r.path.note}`);
  } else {
    out.push("No path confirmed from a live source today. See section 6.");
  }
  out.push("");

  out.push("### 2. Steps, fees and timelines");
  if (r.stepsAndFees.length) {
    out.push("| # | Step | Fee | Time | Source |", "|---|---|---|---|---|");
    for (const s of r.stepsAndFees) {
      const time = s.time ? `${s.time}${s.outsidePlanningClock ? " (outside the legal clock)" : ""}` : "unknown";
      out.push(`| ${s.order} | ${cell(s.step)} | ${cell(s.fee ?? "unknown")} | ${cell(time)} | ${link(s.sourceUrl)} |`);
    }
  } else out.push("No steps confirmed today.");
  out.push("");

  out.push("### 3. Checklist audit");
  out.push(`Source checklist: ${r.header.docTitle}`, "");
  out.push("| # | Checklist line | Cites | Status | Current law / note | Source |", "|---|---|---|---|---|---|");
  r.auditTable.forEach((row, i) => {
    const status =
      row.status === "stale" && row.newCitation
        ? `**Stale → ${row.newCitation}**`
        : row.newCitation
          ? `${STATUS_LABEL[row.status]}; stale: ${row.newCitation}`
          : STATUS_LABEL[row.status];
    out.push(
      `| ${i + 1} | ${cell(truncate(row.line, 160))} | ${cell(row.cites.join("; ") || "none")} | ${status} | ${cell(
        row.note,
      )} | ${link(row.sourceUrl)} |`,
    );
  });
  out.push("", "*Possible conflict: confirm with city staff or counsel. This is not a ruling.*", "");

  out.push("### 4. Package gaps");
  if (!packageProvided) out.push("No applicant package was provided.");
  else if (r.packageGaps.length === 0) out.push("No gaps found in the package provided.");
  else {
    out.push("| Checklist item | Status | Note |", "|---|---|---|");
    const label = { present: "Present", missing: "Missing", inconsistent: "Inconsistent", cant_tell: "Can't tell" };
    for (const g of r.packageGaps) out.push(`| ${cell(g.item)} | ${label[g.status]} | ${cell(g.note)} |`);
  }
  out.push("");

  out.push("### 5. Local numbers and HCD letters");
  if (r.timelines.length) {
    out.push("| Metric | Value | Source |", "|---|---|---|");
    for (const t of r.timelines) out.push(`| ${cell(t.metric)} | ${cell(t.value)} | ${cell(t.source)} |`);
    out.push("", "APR data shows permits and dates as reported by the city. It has no data on plan-check correction cycles.");
  } else out.push("No local timeline data checked today.");
  out.push("");
  if (r.hcdLetters.letters.length) {
    for (const l of r.hcdLetters.letters) out.push(`- ${link(l.url, l.title)} (${l.date})`);
  }
  if (r.hcdLetters.note) out.push(`HCD letters: ${r.hcdLetters.note}`);
  out.push("");

  out.push("### 6. What we couldn't verify today");
  if (r.couldntVerify.length) for (const c of r.couldntVerify) out.push(`- ${c}`);
  else out.push("- Nothing: every claim above was checked against a source today.");
  out.push("");
  return out.join("\n");
}

function renderComparison(c: NonNullable<FinalReport["comparison"]>, cities: string[]): string {
  const out = ["## Side by side", "", `| Topic | ${cities.join(" | ")} |`, `|---|${cities.map(() => "---").join("|")}|`];
  for (const row of c) {
    const vals = cities.map((city) => cell(row.values.find((v) => v.city === city)?.value ?? "unknown"));
    out.push(`| ${cell(row.topic)} | ${vals.join(" | ")} |`);
  }
  return out.join("\n");
}

// ---------- the model's part: path notes + comparison ----------

const Judgment = z.object({
  pathNotes: z.array(
    z.object({
      city: z.string(),
      note: z
        .string()
        .describe("One or two sentences: why this path fits and which other paths were considered. Label assumptions ASSUMPTION."),
    }),
  ),
  comparison: z
    .array(
      z.object({
        topic: z.string(),
        values: z.array(z.object({ city: z.string(), value: z.string().describe("'unknown' if the data doesn't say") })),
      }),
    )
    .nullable()
    .describe("Only for two or more cities; otherwise null"),
});
type Judgment = z.infer<typeof Judgment>;

const SYSTEM = `You write the judgment parts of a Fast Path Check report for an Orange County permit tech, homeowner or nonprofit project manager. The rest of the report is assembled by code from sourced data you'll be given.

Write:
1. pathNotes: for each city, one or two plain-English sentences on why the identified approval path fits this project, and which other paths were considered and why they don't fit or weren't confirmed. Use only facts in the data. If no path was confirmed, say so.
2. comparison: only when there are two or more cities. Rows such as: approval path, legal clock, stale citations, possible conflicts, published review timeline, fees, HCD letters, recent ADU permits (APR). Every value comes from the data; if the data doesn't say, write "unknown". Never fill a gap from general knowledge.

Name "SB 9" with its year: SB 9 (2021) is the two-unit / lot-split law; SB 9 (2025) concerns HCD voiding non-compliant ADU ordinances.

${RULES}`;

function compactForModel(reports: Report[]) {
  return reports.map((r) => ({
    city: r.header.city,
    projectType: r.header.projectType,
    docTitle: r.header.docTitle,
    checkedOn: r.header.checkedOn,
    path: r.path,
    trafficLight: r.trafficLight,
    steps: r.stepsAndFees,
    audit: r.auditTable.map(({ line, cites, status, newCitation, note }) => ({
      line: truncate(line, 200),
      cites,
      status,
      newCitation,
      note,
    })),
    timelines: r.timelines,
    hcdLetters: r.hcdLetters,
    couldntVerify: r.couldntVerify,
  }));
}

async function writeJudgment(reports: Report[], note: string | undefined, emit: Emit): Promise<Judgment | null> {
  try {
    const msg = await client.beta.messages.parse({
      model: MODELS.producer,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(Judgment) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Today is ${today()}.${note ? `\nCoordinator note: ${note}` : ""}\n\nReport data:\n${JSON.stringify(
            compactForModel(reports),
            null,
            1,
          )}`,
        },
      ],
    });
    logUsage("producer", msg.usage);
    if (msg.stop_reason === "refusal") {
      emit({ type: "progress", agent: "producer", message: "Model declined the summary step; using plain report" });
      return null;
    }
    if (msg.stop_reason === "max_tokens" || !msg.parsed_output) {
      emit({ type: "progress", agent: "producer", message: "Summary step incomplete; using plain report" });
      return null;
    }
    return msg.parsed_output;
  } catch (err) {
    console.error("[producer] judgment call failed:", err);
    emit({ type: "progress", agent: "producer", message: "Summary step failed; using plain report" });
    return null;
  }
}

// ---------- entry point ----------

export const runProducer: RunProducer = async ({ inputs, note }, emit) => {
  if (inputs.length === 0) throw new Error("runProducer needs at least one parsed + checked document.");
  emit({ type: "progress", agent: "producer", message: `Assembling ${inputs.length === 1 ? "report" : `${inputs.length} reports`}` });

  const reports = inputs.map(assembleReport);

  emit({
    type: "progress",
    agent: "producer",
    message: inputs.length > 1 ? "Writing path notes and side-by-side comparison" : "Writing path note",
  });
  const judgment = await writeJudgment(reports, note, emit);

  for (const [i, r] of reports.entries()) {
    if (r.path) {
      const n = judgment?.pathNotes.find((p) => p.city.toLowerCase() === r.header.city.toLowerCase())
        ?? judgment?.pathNotes[i];
      r.path.note = n?.note ?? "";
    }
    r.markdown = renderMarkdown(r, inputs[i].parsed.package !== null);
  }

  let comparison: FinalReport["comparison"] = null;
  if (reports.length > 1) {
    comparison = judgment?.comparison ?? [
      // Fallback built from data if the model step failed.
      { topic: "Approval path", values: reports.map((r) => ({ city: r.header.city, value: r.path?.name ?? "unknown" })) },
      { topic: "Legal clock", values: reports.map((r) => ({ city: r.header.city, value: r.path?.clock ?? "unknown" })) },
      {
        topic: "Stale citations",
        values: reports.map((r) => ({ city: r.header.city, value: String(r.trafficLight.staleCitations) })),
      },
      {
        topic: "Possible conflicts",
        values: reports.map((r) => ({ city: r.header.city, value: String(r.trafficLight.possibleConflicts) })),
      },
    ];
    const cmp = renderComparison(comparison, reports.map((r) => r.header.city));
    reports[0].markdown = `${cmp}\n\n${reports[0].markdown}`;
  }

  const final = FinalReport.parse({ reports, comparison });
  emit({ type: "progress", agent: "producer", message: "Report ready" });
  return final;
};
