// Scripted stand-in for Claude (steps 3-4). Each script is a list of
// questions; each answer is parsed, may trigger a follow-up question, and
// fills fields. Replaced by real Claude calls in step 5.

import type { FillSession } from "../session";
import type { FillEvent, FormField, FormSource } from "../types";
import { fieldState } from "../types";
import { genericScript } from "./generic";
import { irvineAduScript } from "./irvine-adu";

export type Fill = {
  id: string;
  value: string | boolean;
  source?: FormField["source"];
  note?: string;
};

export type StepResult = {
  /** Ask this instead of moving on (the answer was unclear). */
  followUp?: string;
  status?: string[];
  fill?: Fill[];
  message?: string;
};

export type Ctx = {
  get: (id: string) => FormField["value"];
  answers: Record<string, string>;
};

export type Step = {
  id: string;
  fieldIds: string[];
  ask: (ctx: Ctx) => string;
  /** `earlier` holds this step's previous answers when a follow-up was asked. */
  handle: (answer: string, ctx: Ctx, earlier: string[]) => StepResult;
  skip?: (ctx: Ctx) => boolean;
};

export type Script = {
  intro: string;
  fields: FormField[];
  steps: Step[];
  finish?: (ctx: Ctx) => StepResult;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createMockSession(source: FormSource): FillSession {
  const script =
    source.kind === "sample" && source.form.id === "irvine-adu-application"
      ? irvineAduScript()
      : genericScript(source);

  const fields = new Map(script.fields.map((f) => [f.id, { ...f }]));
  const ctx: Ctx = {
    get: (id) => fields.get(id)?.value ?? null,
    answers: {},
  };
  let index = 0;
  let earlier: string[] = []; // answers to the current step before a follow-up

  function apply(fill: Fill): FormField {
    const f = fields.get(fill.id);
    if (!f) throw new Error(`Mock script fills unknown field "${fill.id}"`);
    f.value = fill.value;
    f.source = fill.source ?? "user";
    if (fill.note) f.note = fill.note;
    if (f.source === "research") f.checkedOn = new Date().toISOString().slice(0, 10);
    return { ...f };
  }

  async function* run(result: StepResult): AsyncGenerator<FillEvent> {
    for (const text of result.status ?? []) {
      yield { type: "status", text };
      await sleep(700);
    }
    for (const fill of result.fill ?? []) {
      yield { type: "field", field: apply(fill) };
      await sleep(120);
    }
    if (result.message) yield { type: "message", text: result.message };
  }

  async function* next(): AsyncGenerator<FillEvent> {
    while (index < script.steps.length && script.steps[index].skip?.(ctx)) index++;
    const step = script.steps[index];
    if (step) {
      await sleep(400);
      yield { type: "question", text: step.ask(ctx), fieldIds: step.fieldIds };
      return;
    }

    if (script.finish) yield* run(script.finish(ctx));
    const all = [...fields.values()].map((f) => ({ ...f }));
    const filled = all.filter((f) => fieldState(f) === "filled").length;
    const needsYou = all.filter((f) => fieldState(f) === "needs-you");
    const empty = all.filter((f) => fieldState(f) === "empty");
    const emptyText = empty.length
      ? ` I left ${empty.length === 1 ? "one box" : `${empty.length} boxes`} empty: ${empty
          .map((f) => f.label.toLowerCase())
          .join(", ")}.`
      : "";
    const needText = needsYou.length
      ? ` ${needsYou.length === 1 ? "One needs" : `${needsYou.length} need`} you: ${needsYou
          .map((f) => f.label.toLowerCase())
          .join(" and ")}.`
      : "";
    yield {
      type: "done",
      summary: `Done, I filled ${filled} of ${all.length} fields.${needText}${emptyText} Please check the preview below, then download your form.`,
      fields: all,
    };
  }

  return {
    get fields() {
      return [...fields.values()].map((f) => ({ ...f }));
    },
    async *start() {
      yield { type: "status", text: "Reading your form…" };
      await sleep(1200);
      yield { type: "message", text: script.intro };
      yield* next();
    },
    async *answer(text) {
      const step = script.steps[index];
      if (!step) return;
      const answer = text.trim();
      const result = step.handle(answer, ctx, earlier);
      if (result.followUp) {
        earlier.push(answer);
        await sleep(500);
        yield { type: "question", text: result.followUp, fieldIds: step.fieldIds };
        return;
      }
      ctx.answers[step.id] = answer;
      earlier = [];
      yield* run(result);
      index++;
      yield* next();
    },
  };
}

// Small parsers shared by the scripts.

export function yesNo(answer: string): boolean | null {
  const a = answer.toLowerCase();
  if (/^(y|yes|yeah|yep|sure|correct|i am|i do)\b/.test(a)) return true;
  if (/^(n|no|nope|not)\b/.test(a)) return false;
  return null;
}

export function firstNumber(answer: string): number | null {
  const m = answer.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function phoneDigits(answer: string): string | null {
  const d = answer.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : null;
}

/** If a follow-up answer is just the ZIP, add it to the earlier address. */
export function withZip(answer: string, earlier: string[]): string {
  const prev = earlier.at(-1);
  return prev && /^\d{5}(-\d{4})?$/.test(answer.trim()) ? `${prev}, ${answer.trim()}` : answer;
}

/** "14 Sample Court, Irvine, CA 92618" → parts. City and ZIP are optional. */
export function splitAddress(answer: string) {
  const zip = answer.match(/\b(\d{5})(?:-\d{4})?\b\s*$/)?.[1] ?? null;
  const parts = answer
    .replace(/\b\d{5}(?:-\d{4})?\b\s*$/, "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^(ca|california)$/i.test(p));
  const street = parts[0] ?? answer.trim();
  const city = parts[1]?.replace(/\s+(ca|california)$/i, "") ?? null;
  return { street, city, zip };
}
