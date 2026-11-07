// Watch the sources the skill depends on, so "doesn't go stale" is something we check rather
// than claim. Each source is fetched once per run; PDFs are compared by SHA-256 against a saved
// baseline, HTML pages by status only (their markup changes constantly), and data.ca.gov by its
// own last-modified metadata.
//
// Pure comparison logic lives here; scripts/check-sources.ts does the fetching.

export type SourceKind = "hash" | "status" | "ckan";

export type Source = {
  id: string;
  url: string;
  kind: SourceKind;
  expect?: number; // expected HTTP status (e.g. 403 for sites known to block automated fetches)
  why: string;
};

export const SOURCES: Source[] = [
  { id: "hcd-adu-handbook", url: "https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/adu-handbook-update.pdf", kind: "hash", why: "ADU rules and 2025 renumbers" },
  { id: "hcd-fact-sheets", url: "https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/housing-law-fact-sheets.pdf", kind: "hash", why: "Housing law fact sheets (Apr 2026)" },
  { id: "hcd-sb9-fact-sheet", url: "https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/sb-9-fact-sheet.pdf", kind: "hash", why: "SB 9 rules" },
  { id: "hcd-sb35-guidelines", url: "https://www.hcd.ca.gov/policy-research/docs/SB-35-Guidelines-Update-Final.pdf", kind: "hash", why: "SB 35 / SB 423 rules" },
  { id: "hcd-ab2011-draft", url: "https://www.hcd.ca.gov/sites/default/files/docs/planning-and-community/draft-ab-2011-guidelines.pdf", kind: "hash", why: "AB 2011 draft guidelines" },
  { id: "hcd-letter-anaheim-2025", url: "https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/anaheim-adu-sb9-findings-032425.pdf", kind: "hash", why: "HCD answer key (Anaheim)" },
  { id: "hcd-letter-irvine-2025", url: "https://www.hcd.ca.gov/sites/default/files/docs/policy-and-research/ordinance-review-letters/irvine-adu-findings-010725.pdf", kind: "hash", why: "HCD answer key (Irvine)" },
  { id: "irvine-adu-application", url: "https://www.cityofirvine.gov/sites/default/files/legacy-documents/civica-34716-adu-application-package_updated-2025.pdf", kind: "hash", why: "Irvine ADU application (fixture)" },
  { id: "irvine-dev-standards", url: "https://www.cityofirvine.gov/sites/default/files/legacy-documents/civica-35890-67-01.pdf", kind: "hash", why: "Irvine Development Standards Checklist" },
  { id: "irvine-hold-harmless", url: "https://www.cityofirvine.gov/sites/default/files/legacy-documents/civica-35928-67-02.pdf", kind: "hash", why: "Irvine Hold Harmless Affidavit" },
  { id: "irvine-adu-page", url: "https://www.cityofirvine.gov/node/69676", kind: "status", why: "Irvine ADU submittal list" },
  { id: "hcd-smap-dashboard", url: "https://www.hcd.ca.gov/planning-and-community-development/streamlined-ministerial-approval-process-dashboard", kind: "status", why: "SB 35 availability by city" },
  { id: "anaheim-adu-checklist", url: "https://www.anaheim.net/DocumentCenter/View/35053/Accessory-Dwelling-Unit-Submittal-Requirements-Checklist", kind: "status", expect: 403, why: "Anaheim blocks automated fetches; a 200 would mean we can fetch it now" },
  { id: "leginfo-66317", url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=66317.", kind: "status", expect: 403, why: "Leginfo blocks automated fetches" },
  { id: "apr-dataset", url: "https://data.ca.gov/api/3/action/package_show?id=housing-element-annual-progress-report-apr-data-by-jurisdiction-and-year", kind: "ckan", why: "APR data refresh date" },
];

export type Observation = { id: string; status: number; sha256?: string; lastModified?: string; error?: string };
export type Baseline = { checkedOn: string; observations: Record<string, Observation> };

export type Change = {
  id: string;
  level: "ok" | "changed" | "new" | "unexpected_status" | "error";
  message: string;
};

export function compare(sources: Source[], current: Observation[], baseline: Baseline | null): Change[] {
  const byId = new Map(current.map((o) => [o.id, o]));
  return sources.map((s) => {
    const now = byId.get(s.id);
    if (!now) return { id: s.id, level: "error", message: "not checked" };
    if (now.error) return { id: s.id, level: "error", message: now.error };
    const expected = s.expect ?? 200;
    if (now.status !== expected) {
      return {
        id: s.id,
        level: "unexpected_status",
        message: `HTTP ${now.status}, expected ${expected}${s.expect === 403 && now.status === 200 ? " (good news: it may be fetchable now)" : ""}`,
      };
    }
    const before = baseline?.observations[s.id];
    if (!before) return { id: s.id, level: "new", message: "no baseline yet" };
    if (s.kind === "hash" && before.sha256 && now.sha256 !== before.sha256) {
      return { id: s.id, level: "changed", message: `content changed since ${baseline!.checkedOn}: re-read it and update reference/ if needed` };
    }
    if (s.kind === "ckan" && before.lastModified && now.lastModified !== before.lastModified) {
      return { id: s.id, level: "changed", message: `dataset updated (${before.lastModified} → ${now.lastModified}): re-run scripts/apr-oc.ts` };
    }
    return { id: s.id, level: "ok", message: "unchanged" };
  });
}
