// Per-city facts we already collected (HCD letters, APR ADU stats), handed to the compliance
// agent as a note so it doesn't re-research the same city for every document. With twenty
// checklists from three cities, that's three cities' worth of lookups instead of twenty.
// Server only (reads ../data at request time, like lib/agents/prompts.ts).

import fs from "node:fs";
import path from "node:path";

type Letter = { date: string; kind: string; url: string; summary: string };
type Row = {
  jurisdiction: string;
  adu: { permitUnitsTotal: number | null; permitUnitsLatestYear: { year: number; units: number } | null; permitToCoMedianDays: number | null; permitToCoN: number };
  flags: string[];
};

let cache: { letters: Record<string, Letter[]>; rows: Row[]; checkedOn: string; aprOn: string } | null = null;

function load() {
  if (cache) return cache;
  const dir = path.join(process.cwd(), "..", "data");
  try {
    const letters = JSON.parse(fs.readFileSync(path.join(dir, "oc-hcd-letters.json"), "utf8"));
    const card = JSON.parse(fs.readFileSync(path.join(dir, "oc-adu-scorecard.json"), "utf8"));
    cache = { letters: letters.jurisdictions, rows: card.rows, checkedOn: letters.checkedOn, aprOn: card.aprFetchedOn };
  } catch {
    cache = { letters: {}, rows: [], checkedOn: "", aprOn: "" };
  }
  return cache;
}

/** Normalize "Anaheim", "City of Anaheim", "anaheim, ca" → "ANAHEIM". */
export function cityKey(city: string): string {
  return city
    .toUpperCase()
    .replace(/^CITY OF\s+|^COUNTY OF\s+/, "")
    .replace(/,?\s*(CA|CALIFORNIA)\.?$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A short note for the compliance agent, or "" when we have nothing on this city. Capped so it
 * never crowds the checklist itself out of the prompt.
 */
export function cityNote(city: string, maxChars = 2500): string {
  const { letters, rows, checkedOn, aprOn } = load();
  const key = cityKey(city);
  const ls = (letters[key] ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const row = rows.find((r) => r.jurisdiction === key);
  if (!ls.length && !row) return "";

  const lines = [
    `Facts we already collected for ${key} (use these instead of re-fetching; cite their URLs; still verify statutes as usual):`,
  ];
  if (ls.length) {
    lines.push(`HCD letters on this city's ADU rules (checked ${checkedOn}; summaries are ours, the letters are the source):`);
    for (const l of ls.slice(0, 5)) lines.push(`- ${l.date} ${l.kind.replace(/_/g, " ")}: ${l.summary} ${l.url}`);
    lines.push("Put these in hcdLetters (title, date, url).");
  } else {
    lines.push(`No HCD ADU letter found for this city in our ${checkedOn} search (that doesn't mean none exists).`);
  }
  if (row?.adu.permitUnitsTotal != null) {
    const ly = row.adu.permitUnitsLatestYear;
    lines.push(
      `APR Table A2 (data.ca.gov, fetched ${aprOn}): ${row.adu.permitUnitsTotal} ADU permit units reported in total` +
        (ly ? `, ${ly.units} in ${ly.year}` : "") +
        (row.adu.permitToCoMedianDays != null ? `; median permit-to-certificate-of-occupancy ${row.adu.permitToCoMedianDays} days (n=${row.adu.permitToCoN})` : "") +
        ". You may use these in timelines with that source instead of re-querying.",
    );
  }
  if (row?.flags.length) lines.push(`Data notes: ${row.flags.join(" ")}`);
  const text = lines.join("\n");
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}
