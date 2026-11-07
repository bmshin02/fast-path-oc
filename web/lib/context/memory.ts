// Project memory shared across forms in one /fill visit.
//
// When an applicant works through several forms (Jeffrey's queue takes many uploads), each
// form is its own chat. Without memory, form 2 re-asks the address, lot size and project type
// form 1 already learned. This module turns finished fields into a small list of facts and
// renders them into a size-capped prompt block, so later forms can pre-fill instead of asking.
//
// Shared by browser and server: no SDK, no Node APIs. The browser keeps the memory in
// sessionStorage (this tab only, cleared when it closes); the server never stores it.

import type { FormField } from "../fill/types";

export type Fact = {
  key: string; // normalized label, e.g. "property address"
  label: string; // as the applicant saw it
  value: string;
  source: "user" | "research";
  sourceUrl?: string;
  checkedOn?: string;
  fromForm: string; // which form it came from
  at: number; // when it was learned (ms), for recency
};

export type Memory = { facts: Fact[] };

export const MAX_FACTS = 60;
export const MAX_VALUE_CHARS = 300;
/** Default prompt budget for the memory block, in characters (~1k tokens). */
export const DEFAULT_MEMORY_BUDGET = 4000;

// Never remember these, even if a form collected them. Mirrors the fill prompt's "Never" list.
const SENSITIVE =
  /\b(ssn|social security|driver'?s? licen[cs]e|licen[cs]e (no|number|#)|id (no|number|#)|passport|bank|routing|account (no|number|#)|credit card|card number|tax id|ein|itin|password|pin)\b/i;
const STAFF_ONLY = /\b(office use|staff use|plan check (no|number)|receipt|fee paid|for city use|official use)\b/i;

/** Lowercase, drop punctuation and filler so "Property Address:" and "Address of property" can meet. */
export function normalizeLabel(label: string): string {
  // Keep role words like "applicant" or "owner": dropping them would merge an applicant's
  // phone with an owner's. Only possessives and filler words go.
  const words = label
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["the", "of", "a", "an", "your", "please", "enter"].includes(w));
  return words.join(" ").trim();
}

/** Is this field worth carrying to another form? */
export function isRememberable(f: FormField): boolean {
  if (f.type === "signature" || f.type === "date") return false;
  if (f.value === null || f.value === "") return false;
  if (f.source !== "user" && f.source !== "research") return false; // "document" facts belong to that form
  if (SENSITIVE.test(f.label) || SENSITIVE.test(f.id)) return false;
  if (STAFF_ONLY.test(f.label)) return false;
  if (f.source === "research" && !f.sourceUrl) return false; // unsourced research isn't a fact
  return true;
}

/** Facts learned on one form. */
export function factsFromFields(fields: FormField[], fromForm: string, now = Date.now()): Fact[] {
  return fields.filter(isRememberable).map((f) => ({
    key: normalizeLabel(f.label) || f.id,
    label: f.label.slice(0, 120),
    value: String(f.value).slice(0, MAX_VALUE_CHARS),
    source: f.source as "user" | "research",
    ...(f.sourceUrl ? { sourceUrl: f.sourceUrl } : {}),
    ...(f.checkedOn ? { checkedOn: f.checkedOn } : {}),
    fromForm: fromForm.slice(0, 120),
    at: now,
  }));
}

/**
 * Merge new facts into memory. Same key: the newer value wins (the applicant may have
 * corrected it). Capped at MAX_FACTS, dropping the oldest research facts first.
 */
export function mergeFacts(memory: Memory, incoming: Fact[]): Memory {
  const byKey = new Map(memory.facts.map((f) => [f.key, f]));
  for (const f of incoming) {
    const prev = byKey.get(f.key);
    if (!prev || f.at >= prev.at) byKey.set(f.key, f);
  }
  let facts = [...byKey.values()];
  if (facts.length > MAX_FACTS) {
    facts.sort((a, b) => rank(b) - rank(a));
    facts = facts.slice(0, MAX_FACTS);
  }
  return { facts: facts.sort((a, b) => a.at - b.at) };
}

// User answers matter more than lookups; newer matters more than older.
function rank(f: Fact): number {
  return (f.source === "user" ? 1e15 : 0) + f.at;
}

/** Clean and cap memory that arrived from a browser (never trust its shape or size). */
export function sanitizeMemory(raw: unknown): Memory {
  const list = Array.isArray((raw as Memory | undefined)?.facts) ? (raw as Memory).facts : [];
  const facts: Fact[] = [];
  for (const f of list.slice(0, MAX_FACTS * 2)) {
    if (!f || typeof f !== "object") continue;
    const label = typeof f.label === "string" ? f.label.slice(0, 120) : "";
    const value = typeof f.value === "string" ? f.value.slice(0, MAX_VALUE_CHARS) : "";
    if (!label || !value || SENSITIVE.test(label)) continue;
    const source = f.source === "research" ? "research" : "user";
    facts.push({
      key: normalizeLabel(label) || label.toLowerCase(),
      label,
      value,
      source,
      ...(typeof f.sourceUrl === "string" && /^https?:\/\//.test(f.sourceUrl) ? { sourceUrl: f.sourceUrl.slice(0, 500) } : {}),
      ...(typeof f.checkedOn === "string" ? { checkedOn: f.checkedOn.slice(0, 10) } : {}),
      fromForm: typeof f.fromForm === "string" ? f.fromForm.slice(0, 120) : "an earlier form",
      at: typeof f.at === "number" && Number.isFinite(f.at) ? f.at : 0,
    });
  }
  return mergeFacts({ facts: [] }, facts);
}

/**
 * Render memory as a prompt block within a character budget. User answers first, newest first;
 * whatever doesn't fit is counted, not silently dropped.
 */
export function memoryForPrompt(memory: Memory, budget = DEFAULT_MEMORY_BUDGET): string {
  if (memory.facts.length === 0) return "";
  const ordered = [...memory.facts].sort((a, b) => rank(b) - rank(a));
  const lines: string[] = [];
  let used = 0;
  let omitted = 0;
  for (const f of ordered) {
    const line =
      `- ${f.label}: ${f.value} (${f.source === "user" ? "told by the applicant" : `looked up${f.sourceUrl ? ` at ${f.sourceUrl}` : ""}`}` +
      `${f.checkedOn ? `, ${f.checkedOn}` : ""}; from "${f.fromForm}")`;
    if (used + line.length + 1 > budget) {
      omitted++;
      continue;
    }
    lines.push(line);
    used += line.length + 1;
  }
  if (omitted) lines.push(`- (${omitted} more earlier fact(s) not shown to save space)`);
  return lines.join("\n");
}
