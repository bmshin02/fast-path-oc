// ADU timelines from the state's Housing Element Annual Progress Report (APR) data.
//
// Source: data.ca.gov, "Housing Element Annual Progress Report (APR) Data by Jurisdiction
// and Year", Table A2 (resource fe505d9b-8c36-42ba-ba30-08bc4f34e022). Each row is one
// project as reported by a city for one reporting year, with up to three milestone dates:
// entitlement approved (ENT_APPROVE_DT1), building permit issued (BP_ISSUE_DT1) and
// certificate of occupancy issued (CO_ISSUE_DT1).
//
// The same project often appears in several reporting years (one row per year it had
// activity), so rows are merged per project before any duration is measured. Pure functions
// only: fetching lives in scripts/apr-oc.ts so this file can be unit-tested offline.

export const APR_TABLE_A2 = "fe505d9b-8c36-42ba-ba30-08bc4f34e022";
export const APR_DATASET_URL =
  "https://data.ca.gov/dataset/housing-element-annual-progress-report-apr-data-by-jurisdiction-and-year";

export type AprRow = {
  JURIS_NAME: string;
  YEAR: number;
  APN: string | null;
  STREET_ADDRESS: string | null;
  JURS_TRACKING_ID: string | null;
  ENT_APPROVE_DT1: string | null;
  BP_ISSUE_DT1: string | null;
  CO_ISSUE_DT1: string | null;
  NO_BUILDING_PERMITS: number | null;
  CO_UNITS: number | null; // sum of the CO_* income columns, computed by the fetch script
};

export type Project = {
  city: string;
  key: string;
  entitlement: string | null;
  permit: string | null;
  co: string | null;
};

const DAY = 86_400_000;
const MAX_PLAUSIBLE_DAYS = 3650; // ignore durations over 10 years as data-entry errors

/** Parse YYYY-MM-DD (or an ISO timestamp) to a UTC day number; null if missing or invalid. */
export function dayNumber(d: string | null | undefined): number | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(t) ? null : Math.round(t / DAY);
}

function earliest(a: string | null, b: string | null): string | null {
  const da = dayNumber(a);
  const db = dayNumber(b);
  if (da === null) return db === null ? null : b;
  if (db === null) return a;
  return da <= db ? a : b;
}

/**
 * A stable per-project key. Prefer the city's tracking id, then APN, then street address.
 * Rows with none of these can't be merged safely, so each becomes its own project.
 */
export function projectKey(r: AprRow, fallbackIndex: number): string {
  const norm = (s: string | null) => (s ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  const id = norm(r.JURS_TRACKING_ID);
  if (id && id !== "N/A" && id !== "NA" && id !== "NONE") return `id:${id}`;
  const apn = norm(r.APN);
  if (apn && apn !== "N/A" && apn !== "0") return `apn:${apn}`;
  const addr = norm(r.STREET_ADDRESS);
  if (addr) return `addr:${addr}`;
  return `row:${fallbackIndex}`;
}

/** Merge rows into projects, keeping the earliest date seen for each milestone. */
export function mergeProjects(rows: AprRow[]): Project[] {
  const byKey = new Map<string, Project>();
  rows.forEach((r, i) => {
    const key = `${r.JURIS_NAME}|${projectKey(r, i)}`;
    const p = byKey.get(key);
    if (!p) {
      byKey.set(key, {
        city: r.JURIS_NAME,
        key,
        entitlement: r.ENT_APPROVE_DT1,
        permit: r.BP_ISSUE_DT1,
        co: r.CO_ISSUE_DT1,
      });
    } else {
      p.entitlement = earliest(p.entitlement, r.ENT_APPROVE_DT1);
      p.permit = earliest(p.permit, r.BP_ISSUE_DT1);
      p.co = earliest(p.co, r.CO_ISSUE_DT1);
    }
  });
  return [...byKey.values()];
}

/** Days from a to b, or null if either is missing, negative, or implausibly long. */
export function daysBetween(a: string | null, b: string | null): number | null {
  const da = dayNumber(a);
  const db = dayNumber(b);
  if (da === null || db === null) return null;
  const d = db - da;
  if (d < 0 || d > MAX_PLAUSIBLE_DAYS) return null;
  return d;
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function percentile(xs: number[], p: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}

export type DurationStat = { n: number; median: number | null; p25: number | null; p75: number | null };

function stat(xs: number[]): DurationStat {
  return { n: xs.length, median: median(xs), p25: percentile(xs, 25), p75: percentile(xs, 75) };
}

export type CitySummary = {
  city: string;
  rows: number;
  projects: number;
  permitUnitsByYear: Record<string, number>;
  coUnitsByYear: Record<string, number>;
  permitUnitsTotal: number;
  coUnitsTotal: number;
  /** Building permit issued → certificate of occupancy (construction + final inspections). */
  permitToCo: DurationStat;
  /** Entitlement → building permit. ADUs are ministerial, so most have no entitlement date. */
  entitlementToPermit: DurationStat;
  latestYear: number | null;
};

export function summarizeCity(city: string, rows: AprRow[]): CitySummary {
  const permitUnitsByYear: Record<string, number> = {};
  const coUnitsByYear: Record<string, number> = {};
  let latestYear: number | null = null;
  for (const r of rows) {
    const y = String(r.YEAR);
    permitUnitsByYear[y] = (permitUnitsByYear[y] ?? 0) + (r.NO_BUILDING_PERMITS ?? 0);
    coUnitsByYear[y] = (coUnitsByYear[y] ?? 0) + (r.CO_UNITS ?? 0);
    latestYear = latestYear === null ? r.YEAR : Math.max(latestYear, r.YEAR);
  }
  const projects = mergeProjects(rows);
  const p2c: number[] = [];
  const e2p: number[] = [];
  for (const p of projects) {
    const a = daysBetween(p.permit, p.co);
    if (a !== null) p2c.push(a);
    const b = daysBetween(p.entitlement, p.permit);
    if (b !== null) e2p.push(b);
  }
  const sum = (o: Record<string, number>) => Object.values(o).reduce((s, v) => s + v, 0);
  return {
    city,
    rows: rows.length,
    projects: projects.length,
    permitUnitsByYear,
    coUnitsByYear,
    permitUnitsTotal: sum(permitUnitsByYear),
    coUnitsTotal: sum(coUnitsByYear),
    permitToCo: stat(p2c),
    entitlementToPermit: stat(e2p),
    latestYear,
  };
}

export function summarizeAll(rows: AprRow[]): CitySummary[] {
  const byCity = new Map<string, AprRow[]>();
  for (const r of rows) {
    const list = byCity.get(r.JURIS_NAME) ?? [];
    list.push(r);
    byCity.set(r.JURIS_NAME, list);
  }
  return [...byCity.entries()]
    .map(([city, rs]) => summarizeCity(city, rs))
    .sort((a, b) => a.city.localeCompare(b.city));
}
