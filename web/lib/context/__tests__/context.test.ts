// Tests for cross-form memory, transcript compaction, batch digests/aggregation, the worker
// pool, city context and the fill prompt wiring. Offline, no API key.
//   cd web && npx tsx --test lib/context/__tests__/*.test.ts lib/features/__tests__/*.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  factsFromFields,
  isRememberable,
  MAX_FACTS,
  memoryForPrompt,
  mergeFacts,
  normalizeLabel,
  sanitizeMemory,
} from "../memory";
import { compactTranscript } from "../transcript";
import { turnText } from "../../fill/server/prompt";
import type { FormField } from "../../fill/types";
import type { TranscriptLine } from "../../fill/protocol";
import { digestDoc, approxTokens } from "../../batch/digest";
import { aggregate } from "../../batch/aggregate";
import { runPool } from "../../batch/pool";
import { cityKey, cityNote } from "../../batch/city-context";
import { guessCity } from "../../batch/cities";
import anaheimParsed from "../../agents/fixtures/anaheim-parsed.sample.json";
import anaheimCompliance from "../../agents/fixtures/anaheim-compliance.sample.json";
import irvineParsed from "../../agents/fixtures/irvine-parsed.sample.json";
import irvineCompliance from "../../agents/fixtures/irvine-compliance.sample.json";
import type { ComplianceResult, ParsedDoc } from "../../agents/schemas";

const field = (o: Partial<FormField>): FormField => ({ id: "x", label: "X", type: "text", value: null, ...o });

// ---------- memory ----------

test("only user answers and sourced lookups are remembered; never signatures, dates, IDs or staff boxes", () => {
  assert.equal(isRememberable(field({ label: "Property address", value: "123 Demo St", source: "user" })), true);
  assert.equal(isRememberable(field({ label: "School district", value: "AUHSD", source: "research", sourceUrl: "https://x.gov" })), true);
  assert.equal(isRememberable(field({ label: "School district", value: "AUHSD", source: "research" })), false); // no source
  assert.equal(isRememberable(field({ label: "Form number", value: "Z412", source: "document" })), false);
  assert.equal(isRememberable(field({ label: "Owner signature", type: "signature", value: "x", source: "user" })), false);
  assert.equal(isRememberable(field({ label: "Date", type: "date", value: "2026-11-07", source: "user" })), false);
  assert.equal(isRememberable(field({ label: "Social Security Number", value: "000", source: "user" })), false);
  assert.equal(isRememberable(field({ label: "Driver's license number", value: "D1", source: "user" })), false);
  assert.equal(isRememberable(field({ label: "Plan check number (office use only)", value: "1", source: "user" })), false);
  assert.equal(isRememberable(field({ label: "Address", value: "", source: "user" })), false);
});

test("labels from different forms meet after normalizing", () => {
  assert.equal(normalizeLabel("Property Address:"), normalizeLabel("property address"));
  assert.equal(normalizeLabel("The Applicant's Phone"), "applicant phone");
  assert.notEqual(normalizeLabel("Applicant name"), normalizeLabel("Owner name")); // roles stay distinct
});

test("merge: newer answer wins, capped, user answers kept over old lookups", () => {
  const a = factsFromFields([field({ label: "Lot size", value: "6,000 sq ft", source: "user" })], "Form A", 1);
  const b = factsFromFields([field({ label: "Lot Size", value: "6,500 sq ft", source: "user" })], "Form B", 2);
  const m = mergeFacts(mergeFacts({ facts: [] }, a), b);
  assert.equal(m.facts.length, 1);
  assert.equal(m.facts[0].value, "6,500 sq ft");
  assert.equal(m.facts[0].fromForm, "Form B");

  const many = Array.from({ length: MAX_FACTS + 20 }, (_, i) =>
    factsFromFields([field({ label: `Lookup ${i}`, value: "v", source: "research", sourceUrl: "https://x.gov" })], "F", i)[0],
  );
  const keepUser = factsFromFields([field({ label: "Owner name", value: "Demo Person", source: "user" })], "F", 0);
  const capped = mergeFacts({ facts: [] }, [...many, ...keepUser]);
  assert.equal(capped.facts.length, MAX_FACTS);
  assert.ok(capped.facts.some((f) => f.label === "Owner name")); // oldest, but a user answer
});

test("prompt block respects its budget and says what it left out", () => {
  const facts = factsFromFields(
    Array.from({ length: 40 }, (_, i) => field({ label: `Answer number ${i}`, value: "x".repeat(200), source: "user" })),
    "Irvine ADU application",
  );
  const text = memoryForPrompt({ facts }, 1500);
  assert.ok(text.length <= 1600, `block was ${text.length} chars`);
  assert.match(text, /more earlier fact\(s\) not shown/);
  assert.equal(memoryForPrompt({ facts: [] }), "");
});

test("sanitizeMemory drops junk, sensitive labels and oversize values from the browser", () => {
  const m = sanitizeMemory({
    facts: [
      { label: "Property address", value: "123 Demo St", source: "user", fromForm: "A", at: 1 },
      { label: "SSN", value: "000-00-0000", source: "user" },
      { label: "Notes", value: "y".repeat(5000), source: "research", sourceUrl: "javascript:alert(1)" },
      null,
      "garbage",
      { label: 5, value: "x" },
    ],
  });
  assert.equal(m.facts.length, 2);
  const notes = m.facts.find((f) => f.label === "Notes")!;
  assert.equal(notes.value.length, 300);
  assert.equal(notes.sourceUrl, undefined); // non-http URL removed
  assert.deepEqual(sanitizeMemory(undefined), { facts: [] });
  assert.deepEqual(sanitizeMemory({ facts: "nope" }), { facts: [] });
});

// ---------- transcript ----------

const convo = (n: number): TranscriptLine[] =>
  Array.from({ length: n }, (_, i) => ({ from: i % 2 ? "you" : "fast-track", text: `${i % 2 ? "Answer" : "Question"} ${i} ${"words ".repeat(30)}` }));

test("short conversations pass through unchanged", () => {
  const t = convo(4);
  const r = compactTranscript(t);
  assert.equal(r.condensed, 0);
  assert.match(r.text, /^Fast Track: Question 0/);
});

test("long conversations stay within budget, keep recent turns verbatim, condense older ones", () => {
  const t = convo(80);
  const full = t.map((l) => l.text).join("\n").length;
  const r = compactTranscript(t, 6000, 8);
  assert.ok(full > 6000);
  assert.ok(r.text.length <= 6200, `compacted to ${r.text.length}`);
  assert.equal(r.condensed, 72);
  assert.match(r.text, /Most recent:/);
  assert.ok(r.text.includes("Answer 79")); // last line verbatim
  assert.match(r.text, /Q: Question \d+ .* → A: Answer \d+/); // paired older lines
});

// ---------- fill prompt wiring ----------

test("turnText includes earlier-form facts and a compacted conversation", () => {
  const memory = {
    facts: factsFromFields([field({ label: "Property address", value: "123 Demo St, Irvine, CA 92618", source: "user" })], "Irvine ADU application"),
  };
  const text = turnText({ form: { kind: "sample", id: "x" }, fields: [], transcript: convo(80), memory }, "Hold Harmless Affidavit", false);
  assert.match(text, /<known_from_earlier_forms>\n- Property address: 123 Demo St/);
  assert.match(text, /from "Irvine ADU application"/);
  assert.match(text, /Earlier in this form \(condensed/);
  const none = turnText({ form: { kind: "sample", id: "x" }, fields: [], transcript: [] }, "Form", false);
  assert.match(none, /\(none: this is the first form\)/);
});

// ---------- batch digest / aggregate ----------

const ana = { parsed: anaheimParsed as unknown as ParsedDoc, compliance: anaheimCompliance as unknown as ComplianceResult };
const irv = { parsed: irvineParsed as unknown as ParsedDoc, compliance: irvineCompliance as unknown as ComplianceResult };

test("a digest is small and keeps what matters", () => {
  const d = digestDoc({ key: "k1", filename: "anaheim.pdf", ...ana });
  assert.equal(d.city, ana.parsed.city);
  assert.equal(d.itemCount, ana.parsed.items.length);
  assert.ok(d.staleCitations >= 2, "Anaheim has two stale citations");
  assert.ok(d.staleMappings.some((m) => m.includes("65852.2")));
  assert.ok(d.issues.length <= 8);
  assert.equal(d.needsUser, null);
  const full = approxTokens(ana);
  const small = approxTokens(d);
  assert.ok(small < full, `digest ${small} tokens vs full ${full}`);
  assert.ok(small < 1500, `digest is ${small} tokens`);
});

test("not-a-checklist and personal-info uploads are flagged instead of audited", () => {
  const notChecklist = digestDoc({ key: "k", filename: "menu.pdf", parsed: { ...ana.parsed, isChecklist: false }, compliance: null });
  assert.match(notChecklist.needsUser!, /doesn't look like/);
  const pii = digestDoc({ key: "k", filename: "x.pdf", parsed: { ...ana.parsed, containsPersonalInfo: true }, compliance: null });
  assert.match(pii.needsUser!, /private person/);
});

test("20 documents aggregate into one summary without growing past a small budget", () => {
  const digests = Array.from({ length: 20 }, (_, i) =>
    digestDoc({ key: `k${i}`, filename: `${i % 3 ? "anaheim" : "irvine"}-${i}.pdf`, ...(i % 3 ? ana : irv) }),
  );
  digests.push(digestDoc({ key: "bad", filename: "menu.pdf", parsed: { ...ana.parsed, isChecklist: false }, compliance: null }));
  const s = aggregate(digests);
  assert.equal(s.documents, 21);
  assert.equal(s.needsUser.length, 1);
  assert.equal(s.byCity.reduce((n, c) => n + c.documents, 0), 20);
  assert.ok(s.recurringStale[0].documents >= 13, "the Anaheim stale mapping recurs across files");
  assert.ok(s.attention.length > 0 && s.attention.length <= 10);
  assert.ok(approxTokens(digests) < 25_000, `20 digests = ${approxTokens(digests)} tokens`);
});

// ---------- pool ----------

test("pool limits concurrency, keeps order, retries once, and stops on permanent errors", async () => {
  let live = 0;
  let peak = 0;
  const tries = new Map<number, number>();
  const results = await runPool(
    Array.from({ length: 10 }, (_, i) => i),
    3,
    async (i) => {
      live++;
      peak = Math.max(peak, live);
      tries.set(i, (tries.get(i) ?? 0) + 1);
      await new Promise((r) => setTimeout(r, 5));
      live--;
      if (i === 4 && tries.get(i) === 1) throw new Error("flaky");
      if (i === 7) throw Object.assign(new Error("too large"), { permanent: true });
      return i * 2;
    },
    { retries: 1 },
  );
  assert.equal(peak, 3);
  assert.deepEqual(results[4], { ok: true, value: 8 });
  assert.equal(tries.get(4), 2);
  assert.deepEqual(results[7], { ok: false, error: "too large" });
  assert.equal(tries.get(7), 1);
  assert.deepEqual(results[9], { ok: true, value: 18 });
});

// ---------- city context ----------

test("city names normalize and known facts come back capped", () => {
  assert.equal(cityKey("City of Anaheim, CA"), "ANAHEIM");
  assert.equal(guessCity("anaheim-adu-checklist-z412.pdf"), "Anaheim");
  assert.equal(guessCity("orange_county_adu.pdf"), "Orange County");
  assert.equal(guessCity("ORANGE adu form.pdf"), "Orange");
  assert.equal(guessCity("random.pdf"), null);
  const note = cityNote("Anaheim");
  assert.match(note, /anaheim-adu-sb9-findings-032425\.pdf/);
  assert.match(note, /APR Table A2/);
  assert.ok(note.length <= 2500);
  assert.equal(cityNote("Gotham"), "");
});
