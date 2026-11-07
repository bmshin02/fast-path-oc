// Pull every Orange County ADU row from APR Table A2 and write per-city summaries.
//   cd web && npx tsx scripts/apr-oc.ts
// No API key needed (data.ca.gov is open). One paginated query, then aggregation offline.
// Writes ../data/oc-adu-apr.json (aggregates only: no addresses, APNs or tracking ids).

import fs from "node:fs";
import path from "node:path";
import { APR_DATASET_URL, APR_TABLE_A2, summarizeAll, type AprRow } from "../lib/features/apr";

const CO_COLS = [
  "CO_ACUTELY_LOW_INCOME_DR",
  "CO_ACUTELY_LOW_INCOME_NDR",
  "CO_EXTREMELY_LOW_INCOME_DR",
  "CO_EXTREMELY_LOW_INCOME_NDR",
  "CO_VLOW_INCOME_DR",
  "CO_VLOW_INCOME_NDR",
  "CO_LOW_INCOME_DR",
  "CO_LOW_INCOME_NDR",
  "CO_MOD_INCOME_DR",
  "CO_MOD_INCOME_NDR",
  "CO_ABOVE_MOD_INCOME",
];
const FIELDS = [
  "JURIS_NAME",
  "YEAR",
  "APN",
  "STREET_ADDRESS",
  "JURS_TRACKING_ID",
  "ENT_APPROVE_DT1",
  "BP_ISSUE_DT1",
  "CO_ISSUE_DT1",
  "NO_BUILDING_PERMITS",
  ...CO_COLS,
];

type Raw = Record<string, unknown>;

async function fetchAll(): Promise<Raw[]> {
  const out: Raw[] = [];
  const limit = 5000;
  for (let offset = 0; ; offset += limit) {
    const u = new URL("https://data.ca.gov/api/3/action/datastore_search");
    u.searchParams.set("resource_id", APR_TABLE_A2);
    u.searchParams.set("filters", JSON.stringify({ CNTY_NAME: "Orange", UNIT_CAT: "ADU" }));
    u.searchParams.set("fields", FIELDS.join(","));
    u.searchParams.set("limit", String(limit));
    u.searchParams.set("offset", String(offset));
    const res = await fetch(u, { headers: { "User-Agent": "fast-path-check/0.1 (hackathon prototype)" } });
    if (!res.ok) throw new Error(`data.ca.gov ${res.status}`);
    const body = (await res.json()) as { success: boolean; result: { records: Raw[]; total: number } };
    if (!body.success) throw new Error("data.ca.gov returned success=false");
    out.push(...body.result.records);
    process.stderr.write(`  fetched ${out.length}/${body.result.total}\n`);
    if (out.length >= body.result.total || body.result.records.length === 0) break;
  }
  return out;
}

const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);
const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

async function main() {
  const raw = await fetchAll();
  const rows: AprRow[] = raw.map((r) => ({
    JURIS_NAME: String(r.JURIS_NAME),
    YEAR: Number(r.YEAR),
    APN: str(r.APN),
    STREET_ADDRESS: str(r.STREET_ADDRESS),
    JURS_TRACKING_ID: str(r.JURS_TRACKING_ID),
    ENT_APPROVE_DT1: str(r.ENT_APPROVE_DT1),
    BP_ISSUE_DT1: str(r.BP_ISSUE_DT1),
    CO_ISSUE_DT1: str(r.CO_ISSUE_DT1),
    NO_BUILDING_PERMITS: num(r.NO_BUILDING_PERMITS),
    CO_UNITS: CO_COLS.reduce((s, c) => s + num(r[c]), 0),
  }));
  const cities = summarizeAll(rows);
  const out = {
    source: { dataset: APR_DATASET_URL, resource: APR_TABLE_A2, filter: { CNTY_NAME: "Orange", UNIT_CAT: "ADU" } },
    fetchedOn: new Date().toISOString().slice(0, 10),
    method:
      "Rows merged per project (city + tracking id, else APN, else address), keeping the earliest date per milestone. Durations over 10 years or negative are dropped. Units are summed per reporting year as reported.",
    caveats: [
      "As reported by each city; reporting quality varies (e.g. Irvine reports very few ADU rows).",
      "Permit-to-CO time includes construction, so it is not the city's review time.",
      "ADUs are ministerial, so most rows have no entitlement date; entitlement-to-permit stats cover few projects.",
      "No plan-check correction cycles or application-submitted dates are in Table A2.",
    ],
    cities,
  };
  const file = path.join(process.cwd(), "..", "data", "oc-adu-apr.json");
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`wrote ${file}: ${cities.length} jurisdictions, ${rows.length} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
