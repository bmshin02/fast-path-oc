// Deterministic statute-citation scanner for California ADU law.
//
// Finds Government Code citations in plain text and maps renumbered sections to current law
// using HCD's official "State ADU/JADU Law Statutory Conversion Table" (enclosed in HCD's
// 3/24/25 Anaheim and 1/7/25 Irvine findings letters; see research/hcd-letters.md) plus the
// 2025 renumbers listed in the HCD ADU Handbook (Mar 2026, p.13).
//
// No model involved, so it can't invent a section number. Use it as a cross-check on the
// AI parser/compliance output: anything the scanner finds that the model missed (or vice
// versa) is worth a second look. Sections it doesn't know come back "unverified", never guessed.

export const HCD_TABLE_SOURCE =
  "HCD State ADU/JADU Law Statutory Conversion Table (SB 477), enclosed in https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/anaheim-adu-sb9-findings-032425.pdf";
export const HANDBOOK_2025_SOURCE =
  "HCD ADU Handbook, Mar 2026, p.13: https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/adu-handbook-update.pdf";

export type Citation = {
  raw: string; // the matched text, e.g. "Sections 65852.2 and 65852.22"
  section: string; // e.g. "65852.2"
  subdivision: string | null; // e.g. "(a)(3)"
  index: number; // character offset in the input
};

export type CitationStatus = "stale" | "current" | "unverified";

export type CitationMapping = {
  citation: string; // normalized, e.g. "Gov. Code 65852.2(a)(3)"
  status: CitationStatus;
  current: string[]; // current section(s), e.g. ["66317"]
  chain: string[]; // every hop, e.g. ["65852.2(f)", "66324 (SB 477, 2024)", "66311.5 (2025)"]
  note: string;
  source: string | null;
};

// ---------- conversion data ----------

// 2025 renumbers inside Chapter 13 (HCD ADU Handbook, Mar 2026, p.13).
const RENUMBERED_2025: Record<string, string> = {
  "66324": "66311.5",
  "66327": "66313.5",
  "66332": "66311.7",
};

// SB 477 (2024): old subdivision → new section, from HCD's conversion table.
const FROM_65852_2: Array<[RegExp, string[]]> = [
  [/^\(a\)\(1\)/, ["66314"]],
  [/^\(a\)\(2\)/, ["66318"]],
  [/^\(a\)\(3\)/, ["66317"]],
  [/^\(a\)\(4\)/, ["66314"]],
  [/^\(a\)\(5\)/, ["66314"]],
  [/^\(a\)\(6\)/, ["66316"]],
  [/^\(a\)\(7\)/, ["66317"]],
  [/^\(a\)\(8\)/, ["66315"]],
  [/^\(a\)\(9\)/, ["66318"]],
  [/^\(a\)\(10\)/, ["66319", "66342"]],
  [/^\(b\)/, ["66320"]],
  [/^\(c\)/, ["66321"]],
  [/^\(d\)/, ["66322"]],
  [/^\(e\)/, ["66323"]],
  [/^\(f\)/, ["66324"]],
  [/^\(g\)/, ["66325"]],
  [/^\(h\)/, ["66326"]],
  [/^\(i\)/, ["66327"]],
  [/^\(j\)/, ["66313"]],
  [/^\(k\)/, ["66328"]],
  [/^\(l\)/, ["66329"]],
  [/^\(m\)/, ["66330"]],
  [/^\(n\)/, ["66331"]],
];
const FROM_65852_22: Array<[RegExp, string[]]> = [
  [/^\(a\)/, ["66333"]],
  [/^\(b\)/, ["66334"]],
  [/^\(c\)/, ["66335"]],
  [/^\(d\)/, ["66336"]],
  [/^\(e\)/, ["66337"]],
  [/^\(f\)/, ["66338"]],
  [/^\(g\)/, ["66338"]],
  [/^\(h\)/, ["66339"]],
  [/^\(j\)/, ["66313"]],
];
const FROM_65852_26: Array<[RegExp, string[]]> = [
  [/^\(a\)/, ["66341"]],
  [/^\(b\)/, ["66340"]],
];
const FROM_65852_150: Array<[RegExp, string[]]> = [
  [/^\(a\)/, ["66310"]],
  [/^\(b\)/, ["66311"]],
  [/^\(c\)/, ["66312"]],
];

// Whole-section mappings when no subdivision is given.
const WHOLE_SECTION: Record<string, { current: string[]; label: string }> = {
  "65852.2": { current: ["66314–66331"], label: "ADU approvals (Gov. Code Title 7, Div. 1, Ch. 13, Art. 2)" },
  "65852.22": { current: ["66333–66339"], label: "Junior ADUs (Ch. 13, Art. 3)" },
  "65852.23": { current: ["66332"], label: "ADU provisions (moved to 66332, then 66311.7 in 2025)" },
  "65852.26": { current: ["66340–66341"], label: "ADU sales (Ch. 13, Art. 4)" },
  "65852.150": { current: ["66310–66312"], label: "Legislative findings (Ch. 13, Art. 1)" },
};

const SUBDIVISION_TABLES: Record<string, Array<[RegExp, string[]]>> = {
  "65852.2": FROM_65852_2,
  "65852.22": FROM_65852_22,
  "65852.26": FROM_65852_26,
  "65852.150": FROM_65852_150,
};

// Sections confirmed live on leginfo by hand on 2026-11-07 (see reference/sources.md).
// 66310–66342 are current except the three moved in 2025.
const KNOWN_CURRENT = new Set<string>([
  "65852.21", // SB 9 two-unit
  "66411.7", // SB 9 lot split
  "65913.4", // SB 35 / SB 423
  "65913.4.5", // permits for SB 684 parcels
  "65913.3", // AB 2234 post-entitlement permits
  "66311.5",
  "66311.7",
  "66313.5",
]);
const MULTI_VERSION = new Set<string>(["66499.41", "65852.28"]); // several versions on leginfo

function isChapter13(section: string): boolean {
  const n = Number(section);
  return Number.isInteger(n) && n >= 66310 && n <= 66342;
}

function isAb2011(section: string): boolean {
  const m = /^65912\.(\d{3})$/.exec(section);
  return !!m && Number(m[1]) >= 100 && Number(m[1]) <= 140;
}

// ---------- extraction ----------

const SECTION = String.raw`6\d{4}(?:\.\d+){0,2}`;
const SUBDIV = String.raw`(?:\s*\([0-9A-Za-z]{1,4}\))*`;
// A run like "65852.2(a)(3), 65852.22 and 65852.26" after a Gov Code / Section marker.
const RUN = new RegExp(
  String.raw`(?:Gov(?:ernment|\.|'t)?\s*Code|G\.?C\.?|Sections?|Secs?\.|§§?)\s*(?:Sections?\s*|§§?\s*)?(${SECTION}${SUBDIV}(?:\s*(?:,|and|&|or|through|-|–)\s*(?:Sections?\s*|§\s*)?${SECTION}${SUBDIV})*)`,
  "gi",
);
const ONE = new RegExp(String.raw`(${SECTION})((?:\s*\([0-9A-Za-z]{1,4}\))*)`, "g");

/**
 * Extract Government Code citations from text. Only numbers that follow a "Gov Code",
 * "Section" or "§" marker are taken, so phone numbers, ZIP codes and fees aren't mistaken
 * for statutes. Municipal code citations (e.g. "AMC 18.38.015") don't match the 6xxxx shape.
 */
export function extractCitations(text: string): Citation[] {
  const out: Citation[] = [];
  const seen = new Set<string>();
  for (const run of text.matchAll(RUN)) {
    const body = run[1];
    const bodyStart = (run.index ?? 0) + run[0].indexOf(body);
    for (const m of body.matchAll(ONE)) {
      const section = m[1];
      const subdivision = m[2] ? m[2].replace(/\s+/g, "") : null;
      const index = bodyStart + (m.index ?? 0);
      const key = `${index}:${section}${subdivision ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ raw: run[0].trim(), section, subdivision: subdivision || null, index });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

// ---------- mapping ----------

function apply2025(sections: string[]): { current: string[]; hops: string[] } {
  const hops: string[] = [];
  const current = sections.map((s) => {
    const moved = RENUMBERED_2025[s];
    if (moved) {
      hops.push(`${s} → ${moved} (2025)`);
      return moved;
    }
    return s;
  });
  return { current, hops };
}

export function mapCitation(section: string, subdivision: string | null = null): CitationMapping {
  const citation = `Gov. Code ${section}${subdivision ?? ""}`;

  // 1. Deleted by SB 477 (2024).
  const table = SUBDIVISION_TABLES[section];
  const whole = WHOLE_SECTION[section];
  if (table || whole) {
    let sb477: string[] | null = null;
    if (subdivision && table) {
      const hit = table.find(([re]) => re.test(subdivision));
      if (hit) sb477 = hit[1];
    }
    if (!sb477 && whole) sb477 = whole.current;
    if (sb477) {
      const { current, hops } = apply2025(sb477);
      const chain = [`${section}${subdivision ?? ""}`, `${sb477.join(", ")} (SB 477, 2024)`, ...hops.map((h) => h.split(" → ")[1])];
      const label = whole ? ` ${whole.label}.` : "";
      return {
        citation,
        status: "stale",
        current,
        chain,
        note:
          `Gov. Code ${section} was deleted by SB 477 (effective March 25, 2024); its content is now in ${current.join(", ")}.${label}` +
          (hops.length ? ` Renumbered again in 2025 (${hops.join("; ")}).` : "") +
          (subdivision && !table?.some(([re]) => re.test(subdivision))
            ? " The subdivision wasn't in HCD's table, so only the section-level mapping is given."
            : ""),
        source: hops.length ? `${HCD_TABLE_SOURCE}; ${HANDBOOK_2025_SOURCE}` : HCD_TABLE_SOURCE,
      };
    }
  }

  // 2. Moved within Chapter 13 in 2025.
  const moved = RENUMBERED_2025[section];
  if (moved) {
    return {
      citation,
      status: "stale",
      current: [moved],
      chain: [section, `${moved} (2025)`],
      note: `Gov. Code ${section} was renumbered to ${moved} in 2025.`,
      source: HANDBOOK_2025_SOURCE,
    };
  }

  // 3. Known current.
  if (MULTI_VERSION.has(section)) {
    return {
      citation,
      status: "unverified",
      current: [section],
      chain: [section],
      note: `Gov. Code ${section} has several versions on leginfo; confirm which one is operative before relying on it.`,
      source: null,
    };
  }
  if (isChapter13(section) || KNOWN_CURRENT.has(section) || isAb2011(section)) {
    return {
      citation,
      status: "current",
      current: [section],
      chain: [section],
      note: `Gov. Code ${section} is current (hand-checked on leginfo 2026-11-07).`,
      source: `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=${section}.`,
    };
  }

  // 4. Unknown: never guess.
  return {
    citation,
    status: "unverified",
    current: [],
    chain: [section],
    note: `Gov. Code ${section} isn't in our conversion table or our list of checked sections. Confirm on leginfo; don't assume it's current.`,
    source: null,
  };
}

export type ScanResult = Citation & { mapping: CitationMapping };

/** Extract and map every citation in a block of text. */
export function scanText(text: string): ScanResult[] {
  return extractCitations(text).map((c) => ({ ...c, mapping: mapCitation(c.section, c.subdivision) }));
}

/** Short summary counts, handy for a traffic-light display. */
export function summarize(results: ScanResult[]): Record<CitationStatus, number> {
  const out: Record<CitationStatus, number> = { stale: 0, current: 0, unverified: 0 };
  for (const r of results) out[r.mapping.status]++;
  return out;
}
