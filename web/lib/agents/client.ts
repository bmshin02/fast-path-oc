import Anthropic from "@anthropic-ai/sdk";

// Server only. Reads ANTHROPIC_API_KEY from web/.env.local (or the host's env vars).
// Never import this from a client component.
export const client = new Anthropic();

/**
 * One model per agent, matched to the job. Opus 5.5 only where the reasoning is hard and
 * mistakes are costly; Sonnet 5.5 (half the price, faster) everywhere else. All of these
 * support structured outputs, PDF input, web search/fetch and `fallbacks: "default"`.
 * Prompt caches are per model, so each agent keeps its own cache.
 */
export const MODELS = {
  /** Picks which subagent runs next and when to re-run one: routing, not legal judgment. */
  coordinator: "claude-sonnet-5-5",
  /** Transcribes checklist lines and citations from the PDF (incl. garbled text layers). */
  parser: "claude-sonnet-5-5",
  /** Checks every line against current law with web search/fetch. Never guess a statute. */
  compliance: "claude-opus-5-5",
  /** Writes the path note and two-city comparison from data it's given. */
  producer: "claude-sonnet-5-5",
} as const;

/** YYYY-MM-DD in Pacific time: the "date checked" on every claim. */
export function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

/** Log token usage per call so we know what a demo run costs. */
export function logUsage(agent: string, usage: Anthropic.Messages.Usage | Anthropic.Beta.BetaUsage) {
  console.log(
    `[usage] ${agent}: in=${usage.input_tokens} out=${usage.output_tokens} ` +
      `cache_read=${usage.cache_read_input_tokens ?? 0} cache_write=${usage.cache_creation_input_tokens ?? 0}`,
  );
}
