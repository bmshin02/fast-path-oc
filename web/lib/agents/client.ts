import { AsyncLocalStorage } from "node:async_hooks";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL_CHOICES, type ModelChoice } from "../models";

// Server only. Reads ANTHROPIC_API_KEY from web/.env.local (or the host's env vars).
// Never import this from a client component.
export const client = new Anthropic();

export type AgentRole = "coordinator" | "parser" | "compliance" | "producer";

/**
 * One model per agent, matched to the job. Opus 5.5 only where the reasoning is hard and
 * mistakes are costly; Sonnet 5.5 (half the price, faster) everywhere else. All of these
 * support structured outputs, PDF input, web search/fetch and `fallbacks: "default"`.
 * Prompt caches are per model, so each agent keeps its own cache.
 */
export const DEFAULT_MODELS: Record<AgentRole, string> = {
  /** Picks which subagent runs next and when to re-run one: routing, not legal judgment. */
  coordinator: "claude-sonnet-5-5",
  /** Transcribes checklist lines and citations from the PDF (incl. garbled text layers). */
  parser: "claude-sonnet-5-5",
  /** Checks every line against current law with web search/fetch. Never guess a statute. */
  compliance: "claude-opus-5-5",
  /** Writes the path note and two-city comparison from data it's given. */
  producer: "claude-sonnet-5-5",
};

// A per-run override (?model= on /api/check) applies to every agent in that run. It's
// carried with the async call chain, so concurrent runs never see each other's choice.
const runOverride = new AsyncLocalStorage<ModelChoice>();

/** Run `fn` with every agent on the chosen model; `undefined` keeps the defaults. */
export function withModel<T>(choice: ModelChoice | undefined, fn: () => Promise<T>): Promise<T> {
  return choice ? runOverride.run(choice, fn) : fn();
}

/** The model an agent uses right now: the run's override if there is one, else its default. */
export function modelFor(role: AgentRole): string {
  const choice = runOverride.getStore();
  return choice ? MODEL_CHOICES[choice] : DEFAULT_MODELS[role];
}

/** Each agent reads its model here at call time, so a run's override applies. */
export const MODELS: Readonly<Record<AgentRole, string>> = {
  get coordinator() {
    return modelFor("coordinator");
  },
  get parser() {
    return modelFor("parser");
  },
  get compliance() {
    return modelFor("compliance");
  },
  get producer() {
    return modelFor("producer");
  },
};

/** YYYY-MM-DD in Pacific time: the "date checked" on every claim. */
export function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

const ROLE_FOR_LOG: Record<string, AgentRole> = { master: "coordinator" };

/** Log token usage per call so we know what a demo run costs, and on which model. */
export function logUsage(agent: string, usage: Anthropic.Messages.Usage | Anthropic.Beta.BetaUsage) {
  const role = ROLE_FOR_LOG[agent] ?? (agent as AgentRole);
  const model = role in DEFAULT_MODELS ? ` model=${modelFor(role)}` : "";
  console.log(
    `[usage] ${agent}:${model} in=${usage.input_tokens} out=${usage.output_tokens} ` +
      `cache_read=${usage.cache_read_input_tokens ?? 0} cache_write=${usage.cache_creation_input_tokens ?? 0}`,
  );
}
