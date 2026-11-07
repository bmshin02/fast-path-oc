// Which Claude models a request may ask for with ?model=. Shared by the browser and the
// server, so no SDK import here. Both routes are public and run on the team's key, so
// only these two are allowed: the most a request can cost is Opus 5.5.

export const MODEL_CHOICES = {
  sonnet: "claude-sonnet-5-5",
  opus: "claude-opus-5-5",
} as const;

export type ModelChoice = keyof typeof MODEL_CHOICES;

export class ModelChoiceError extends Error {}

/**
 * Reads a ?model= value. Missing, empty or "default" means "use each route's defaults"
 * (undefined). Accepts the short name or the full model id. Anything else throws a
 * ModelChoiceError whose message lists the allowed values.
 */
export function parseModelChoice(raw: string | null | undefined): ModelChoice | undefined {
  const value = raw?.trim().toLowerCase();
  if (!value || value === "default") return undefined;
  for (const [name, id] of Object.entries(MODEL_CHOICES) as [ModelChoice, string][]) {
    if (value === name || value === id) return name;
  }
  throw new ModelChoiceError(
    `Unknown model "${raw}". Use ?model=${Object.keys(MODEL_CHOICES).join(", ?model=")}, or ?model=default.`,
  );
}
