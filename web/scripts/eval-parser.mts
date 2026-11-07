// Parser accuracy eval: runs the real parser on each case and scores it against ground truth
// hand-checked from the PDFs (2026-11-07). One API call per case (effort low).
//   cd web && npx tsx --env-file=.env.local scripts/eval-parser.mts            # all cases
//   cd web && npx tsx --env-file=.env.local scripts/eval-parser.mts irvine     # one case
// Raw outputs are saved to $TMPDIR/parser-eval/<case>.json for inspection.
// Exit code 1 if any check fails.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runParser } from "../lib/agents/parser";
import type { ParsedDoc, ParsedItem } from "../lib/agents/schemas";

const FIXTURES = path.join(process.cwd(), "..", "evals", "fixtures");
const OUT = path.join(os.tmpdir(), "parser-eval");

type Check = { name: string; pass: boolean; detail?: string };
type Case = { name: string; city: string; pdf: () => Buffer; checks: (d: ParsedDoc) => Check[] };

// ---------- helpers ----------

const allCites = (d: ParsedDoc) => d.items.flatMap((i) => i.citations);
const find = (d: ParsedDoc, re: RegExp) => d.items.filter((i) => re.test(i.text));
const one = (d: ParsedDoc, re: RegExp): ParsedItem | undefined => find(d, re)[0];
const check = (name: string, pass: boolean, detail?: string): Check => ({ name, pass, detail: pass ? undefined : detail });
const hasCite = (d: ParsedDoc, re: RegExp) =>
  check(`cites ${re.source}`, allCites(d).some((c) => re.test(c)), `citations: ${JSON.stringify(allCites(d))}`);
const itemWith = (d: ParsedDoc, re: RegExp, label = re.source) =>
  check(`item: ${label}`, find(d, re).length > 0, "no item text matches");
const ids = (d: ParsedDoc): Check[] => {
  const all = d.items.map((i) => i.id);
  const bad = all.filter((id) => !/^p\d+-\d+(-[a-z])?$/.test(id));
  return [
    check("ids unique", new Set(all).size === all.length, `dupes in ${all.join(",")}`),
    check("ids match p<page>-<n>", bad.length === 0, `bad: ${bad.join(",")}`),
  ];
};
const noGarble = (d: ParsedDoc) => {
  const bad = d.items.filter((i) => /[$%&"'#]{3,}|[A-Za-z0-9]{30,}/.test(i.text.replace(/https?:\S+/g, "")));
  return check("no garbled text", bad.length === 0, bad.map((i) => `${i.id}: ${i.text.slice(0, 60)}`).join(" | "));
};
/** Every citation must only use numbers that appear in the document (no "fixing" 65852.2 → 66314). */
const onlyCitesFrom = (d: ParsedDoc, allowed: string[]) => {
  const extra = allCites(d).filter((c) => {
    const nums = c.match(/\d+(?:[.-]\d+)*/g) ?? [];
    return nums.some((n) => !allowed.includes(n));
  });
  return check("no invented citations", extra.length === 0, `not in doc: ${JSON.stringify(extra)}`);
};

// ---------- tiny PDF writer for the synthetic cases ----------

function makePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (m) => `\\${m}`);
  const stream = ["BT", "/F1 12 Tf", "16 TL", "72 740 Td", ...lines.map((l) => `(${esc(l)}) '`), "ET"].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

// ---------- cases ----------

const cases: Case[] = [
  {
    // Test 1. Ground truth: evals/fixtures/anaheim-adu-checklist-z412-nov-2025.pdf, 1 page.
    name: "anaheim",
    city: "Anaheim",
    pdf: () => fs.readFileSync(path.join(FIXTURES, "anaheim-adu-checklist-z412-nov-2025.pdf")),
    checks: (d) => {
      const cov = one(d, /OWNER OCCUPANCY COVENANT/i);
      const covCites = cov?.citations ?? [];
      return [
        check("isChecklist", d.isChecklist === true),
        check("no personal info (city contacts only)", d.containsPersonalInfo === false),
        check("city", /anaheim/i.test(d.city), d.city),
        check("projectType adu", d.projectType === "adu", d.projectType),
        check("docTitle has form Z412", /accessory dwelling unit/i.test(d.docTitle) && /Z412/.test(d.docTitle), d.docTitle),
        check("docDate NOV 2025", /nov\w*\.?\s*2025|2025-11/i.test(d.docDate ?? ""), String(d.docDate)),
        check("package null", d.package === null),
        check("6-10 items", d.items.length >= 6 && d.items.length <= 10, `${d.items.length} items`),
        check("all on page 1", d.items.every((i) => i.page === 1)),
        ...ids(d),
        // the covenant line carries the stale cites that test 1 hinges on
        check("covenant item exists", !!cov),
        check("covenant kind requirement", cov?.kind === "requirement", cov?.kind),
        check("covenant cites 65852.2", covCites.some((c) => /65852\.2(?![\d])/.test(c)), JSON.stringify(covCites)),
        check("covenant cites 65852.22", covCites.some((c) => /65852\.22/.test(c)), JSON.stringify(covCites)),
        check("covenant cites AMC 18.38.015.110", covCites.some((c) => /18\.38\.015\.110/.test(c)), JSON.stringify(covCites)),
        check(
          "65852.2 and 65852.22 split into separate strings",
          !allCites(d).some((c) => /65852\.2(?!\d)/.test(c) && /65852\.22/.test(c)),
          JSON.stringify(allCites(d)),
        ),
        check("covenant verbatim", /drafted by the City Attorney/i.test(cov?.text ?? "") && /Clerk-Recorder/i.test(cov?.text ?? "")),
        hasCite(d, /18\.38\.015(?!\.)/), // overview paragraph cites AMC 18.38.015
        onlyCitesFrom(d, ["65852.2", "65852.22", "18.38.015", "18.38.015.110"]),
        // timing facts compliance needs for the outside-the-clock steps
        check("sewer keeps 'up to four days'", /up to four\s+days/i.test(one(d, /SEWER/i)?.text ?? ""), one(d, /SEWER/i)?.text),
        check("meter keeps 'two to three business days'", /two to three business days/i.test(one(d, /METER SPOT/i)?.text ?? "")),
        itemWith(d, /NEW ADDRESS REQUEST/i),
        check("title report is a document", one(d, /TITLE REPORT/i)?.kind === "document", one(d, /TITLE REPORT/i)?.kind),
        check("grant deed is a document", one(d, /GRANT DEED/i)?.kind === "document", one(d, /GRANT DEED/i)?.kind),
        check("no page furniture", find(d, /^\s*200 S\. Anaheim Blvd|^\s*NOV 2025\s*$|^\s*Z412\s*$/i).length === 0),
        noGarble(d),
      ];
    },
  },
  {
    // Test 2. Ground truth: evals/fixtures/irvine-adu-application-package-2025.pdf, 10 pages.
    // Page 1's text layer is garbled font codes, so half these lines can only be read from the page image.
    name: "irvine",
    city: "Irvine",
    pdf: () => fs.readFileSync(path.join(FIXTURES, "irvine-adu-application-package-2025.pdf")),
    checks: (d) => {
      const p1 = d.items.filter((i) => i.page === 1);
      const required = [
        /Electronic\/?\s*Digital Signature Disclosure/i,
        /Building Permit Application/i,
        /Residential Take-?\s?Off Sheet/i,
        /Recycling and Diversion/i,
        /OCFA Plan Submittal Criteria/i,
        /Developer Deposit/i,
        /Transportation Corridor Agenc/i,
        /School Facilit/i,
        /ADU VERIFICATION FORM/i,
        /City Standard Title Sheet/i,
      ];
      const fieldLabel = /^\s*(PROJECT ADDRESS|PHONE|EMAIL|DATE|SIGNATURE|TMPL#|RECEIPT #|APPLICANT NAME|ZIP)\s*:?\s*$/i;
      return [
        check("isChecklist", d.isChecklist === true),
        check("no personal info (blank forms)", d.containsPersonalInfo === false),
        check("city", /irvine/i.test(d.city), d.city),
        check("projectType adu", d.projectType === "adu", d.projectType),
        check("docTitle is the e-submittal checklist", /E-?\s?Submittal/i.test(d.docTitle), d.docTitle),
        check("docDate REV 10/24", /10\/24|2024-10/.test(d.docDate ?? ""), String(d.docDate)),
        check("package null", d.package === null),
        ...ids(d),
        check("pages within 1-10", d.items.every((i) => i.page >= 1 && i.page <= 10)),
        // checklist page: every "documents required" line, read through the garbled text layer
        ...required.map((re) => check(`p1 lists ${re.source}`, p1.some((i) => re.test(i.text)), "missing on page 1")),
        check(
          "ADU verification keeps 'signed by City Planning Department Staff'",
          p1.some((i) => /ADU VERIFICATION FORM/i.test(i.text) && /signed by City Planning Department Staff/i.test(i.text)),
        ),
        itemWith(d, /ADU Verification Form.*(planning team|eligible)|eligible.*Accessory Dwelling Unit/i, "additional info #1 (verify eligibility)"),
        itemWith(d, /E-?Plan Submittal Requirements/i),
        itemWith(d, /Construction and Demolition Waste Management Plan/i),
        itemWith(d, /plan review fees/i),
        itemWith(d, /Homeowners? Association/i),
        // law cited on the attached C&D waste form (page 4)
        hasCite(d, /6-7-900/),
        hasCite(d, /4\.408/),
        hasCite(d, /5\.408/),
        hasCite(d, /5\.713\.8/),
        hasCite(d, /AB\s?939/i),
        hasCite(d, /SB\s?1374/i),
        // rule lines on attached forms that compliance needs
        check("school-fee ADU exemption (749 sq ft) on page 6", find(d, /749/).some((i) => i.page === 6)),
        check("OCFA ADU fire-sprinkler question on page 5", find(d, /ADU|Accessory Dwelling/i).some((i) => i.page === 5 && /sprinkler/i.test(i.text))),
        check("no state ADU sections invented", !allCites(d).some((c) => /\b6(58|63)\d\d/.test(c)), JSON.stringify(allCites(d))),
        // noise: blank form fields and fixture tables are not items
        check("<= 60 items", d.items.length <= 60, `${d.items.length} items`),
        check("no bare field labels", find(d, fieldLabel).length === 0, find(d, fieldLabel).map((i) => i.text).join(", ")),
        check("no take-off fixture codes as items", find(d, /^\s*[EMP]\d+(\.\d+)?[AR]?\s/).length <= 2, `${find(d, /^\s*[EMP]\d+(\.\d+)?[AR]?\s/).length}`),
        noGarble(d),
      ];
    },
  },
  {
    // Test 7. A menu is not a checklist: the master should stop and ask.
    name: "menu",
    city: "Anaheim",
    pdf: () =>
      makePdf([
        "Harbor Street Diner - Lunch Menu",
        "Classic cheeseburger with fries ........ $14",
        "Grilled chicken sandwich ............... $13",
        "Garden salad, house vinaigrette ........ $10",
        "Tomato soup (cup / bowl) ............ $5 / $8",
        "Lemonade, iced tea, coffee .............. $3",
        "Open 11am - 3pm daily. Ask about our catering.",
      ]),
    checks: (d) => [check("isChecklist false", d.isChecklist === false), check("no items", d.items.length === 0, `${d.items.length} items`)],
  },
  {
    // Personal info: a filled-in application for a made-up person (555 number, example.com).
    name: "pii",
    city: "Anaheim",
    pdf: () =>
      makePdf([
        "ACCESSORY DWELLING UNIT PERMIT APPLICATION",
        "Applicant name: Jordan Q. Testperson",
        "Home address: 1234 Imaginary Lane, Anaheim, CA 92805",
        "Phone: (714) 555-0142    Email: jordan.testperson@example.com",
        "Property owner: same as applicant",
        "[x] Site plan attached   [x] Floor plan attached",
        "[ ] Sewer verification from Public Works",
        "Applicant signature: Jordan Q. Testperson   Date: 10/02/2026",
      ]),
    checks: (d) => [check("containsPersonalInfo true", d.containsPersonalInfo === true)],
  },
];

// ---------- run ----------

const args = process.argv.slice(2);
const scoreOnly = args.includes("--score"); // re-score saved outputs in OUT, no API calls
const only = args.filter((a) => !a.startsWith("--"));
const selected = only.length ? cases.filter((c) => only.includes(c.name)) : cases;
const OUT_DIR = process.env.PARSER_EVAL_OUT ?? OUT;
fs.mkdirSync(OUT_DIR, { recursive: true });

let failed = 0;
const results = await Promise.all(
  selected.map(async (c) => {
    const t0 = Date.now();
    try {
      const doc: ParsedDoc = scoreOnly
        ? JSON.parse(fs.readFileSync(path.join(OUT_DIR, `${c.name}.json`), "utf8"))
        : await runParser({ pdfBase64: c.pdf().toString("base64"), city: c.city, projectType: "adu" }, () => {});
      if (scoreOnly) return { c, checks: c.checks(doc), secs: 0, items: doc.items.length };
      fs.writeFileSync(path.join(OUT_DIR, `${c.name}.json`), JSON.stringify(doc, null, 2));
      return { c, checks: c.checks(doc), secs: (Date.now() - t0) / 1000, items: doc.items.length };
    } catch (err) {
      return { c, checks: [check("parser ran", false, (err as Error).message)], secs: (Date.now() - t0) / 1000, items: 0 };
    }
  }),
);

for (const { c, checks, secs, items } of results) {
  const bad = checks.filter((k) => !k.pass);
  failed += bad.length;
  console.log(`\n${bad.length ? "FAIL" : "PASS"}  ${c.name}  ${checks.length - bad.length}/${checks.length} checks, ${items} items, ${secs.toFixed(1)}s`);
  for (const k of bad) console.log(`   x ${k.name}${k.detail ? `  -> ${k.detail}` : ""}`);
}
console.log(`\nRaw outputs: ${OUT_DIR}`);
process.exit(failed ? 1 : 0);
