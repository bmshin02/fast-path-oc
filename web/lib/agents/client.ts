import Anthropic from "@anthropic-ai/sdk";

// Server only. Reads ANTHROPIC_API_KEY from web/.env.local (or the host's env vars).
// Never import this from a client component.
export const client = new Anthropic();

export const MODEL = "claude-opus-5-5";

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
