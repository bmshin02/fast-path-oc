// MOCK=1: a batch document "processed" from the hand-written fixtures, with realistic delays and
// progress lines, so the batch UI and the 20-file flow can be tested without an API key.
// Irvine-named cities get the Irvine fixture; everything else gets Anaheim's, relabeled.

import anaheimParsed from "../agents/fixtures/anaheim-parsed.sample.json";
import anaheimCompliance from "../agents/fixtures/anaheim-compliance.sample.json";
import irvineParsed from "../agents/fixtures/irvine-parsed.sample.json";
import irvineCompliance from "../agents/fixtures/irvine-compliance.sample.json";
import type { ComplianceResult, Emit, ParsedDoc } from "../agents/schemas";
import type { DocInput } from "./process";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function withNewFields(c: ComplianceResult): ComplianceResult {
  return {
    ...c,
    items: c.items.map((i) => ({
      ...i,
      topic: i.topic ?? (i.status === "stale" ? "Statute Citations" : i.status === "possible_conflict" ? "Possible Conflict" : "Checklist Item"),
      stateRule: i.stateRule ?? null,
      suggestedFix: i.suggestedFix ?? null,
    })),
  };
}

export async function mockDoc(input: DocInput, emit: Emit): Promise<{ parsed: ParsedDoc; compliance: ComplianceResult | null }> {
  const irvine = /irvine/i.test(input.city) || /irvine/i.test(input.filename);
  const parsed = structuredClone((irvine ? irvineParsed : anaheimParsed) as unknown as ParsedDoc);
  // The sample fixtures predate the topic/stateRule/suggestedFix fields; fill them so the shape is current.
  const compliance = withNewFields(structuredClone((irvine ? irvineCompliance : anaheimCompliance) as unknown as ComplianceResult));
  if (!irvine) parsed.city = input.city || parsed.city;
  // A file named like "menu.pdf" exercises the "not a checklist" path.
  if (/menu|not-a-checklist/i.test(input.filename)) {
    parsed.isChecklist = false;
    emit({ type: "progress", agent: "parser", message: `Reading ${input.filename}` });
    await sleep(300);
    return { parsed, compliance: null };
  }
  emit({ type: "progress", agent: "parser", message: `Reading the ${parsed.city} checklist` });
  await sleep(500 + Math.random() * 700);
  emit({ type: "progress", agent: "compliance", message: `Checking ${parsed.items.length} lines for ${parsed.city}` });
  await sleep(700 + Math.random() * 1200);
  return { parsed, compliance };
}
