// Draft a short, polite letter asserting an applicant's rights under Gov. Code 66317,
// built from the shot-clock result. Draft only: never sent by the app, not legal advice.
//
// It uses placeholders in [BRACKETS] for anything personal (names, addresses, permit
// numbers), so the app never needs or stores personal information.

import { computeClock, GOV_66317_URL, type ClockInput, type ClockResult, type Flag } from "./shot-clock";

export type LetterInput = ClockInput & {
  city: string; // e.g. "Anaheim"
  projectLabel?: string; // e.g. "detached ADU"; defaults to "accessory dwelling unit"
};

export type Letter = {
  applies: boolean; // false when nothing in the clock result supports a letter
  subject: string;
  body: string; // Markdown
  basis: Flag[]; // the flags the letter relies on
  clock: ClockResult;
};

/** Drop the "Round N: " prefix the clock adds and capitalize what's left. */
function clean(message: string): string {
  const m = message.replace(/^Round \d+: /, "");
  return m.charAt(0).toUpperCase() + m.slice(1);
}

const PARAGRAPH: Record<string, (f: Flag, c: ClockResult) => string> = {
  late_completeness_notice: (f) =>
    `**Completeness.** ${clean(f.message)} Gov. Code section 66317(a)(2)(F) provides that if a permitting agency does not make a timely completeness determination, "the application or resubmitted application shall be deemed to be complete."`,
  no_completeness_notice: (f) =>
    `**Completeness.** ${clean(f.message)} Gov. Code section 66317(a)(2)(A) requires written notice within 15 business days, and section 66317(a)(2)(F) provides that the application is deemed complete if that determination isn't made in time.`,
  new_items_on_resubmittal: (f) =>
    `**Items not on the original list.** ${clean(f.message)} Gov. Code section 66317(a)(2)(D) provides that, in reviewing a resubmitted application, the agency "shall not require the application to include an item that was not included in the list" it provided.`,
  no_item_list: () =>
    `**List of incomplete items.** Gov. Code section 66317(a)(2)(B) requires an incomplete determination to include a list of the incomplete items and a description of how the application can be made complete. We'd appreciate that list so we can respond promptly.`,
  deemed_approved: (f) =>
    `**Decision deadline.** ${f.message.replace(" Confirm with city staff or counsel.", "")} Gov. Code section 66317(a)(3) requires the agency to approve or deny within 60 days of receiving a completed application and provides that, if it has not, "the application shall be deemed approved."`,
  late_decision: (f) =>
    `**Decision timing.** ${f.message} Gov. Code section 66317(a)(3) sets a 60-day limit from receipt of a completed application.`,
};

const ACTIONABLE = new Set(Object.keys(PARAGRAPH));

export function draftCompletenessLetter(input: LetterInput): Letter {
  const clock = computeClock(input);
  const basis = clock.flags.filter((f) => ACTIONABLE.has(f.code));
  const project = input.projectLabel ?? "accessory dwelling unit";
  const subject = `${project[0].toUpperCase()}${project.slice(1)} application [PERMIT NUMBER]: timelines under Gov. Code 66317`;

  if (basis.length === 0) {
    return {
      applies: false,
      subject,
      body: `Nothing in the dates provided suggests a 66317 issue. Status: ${clock.status.replace(/_/g, " ")}${
        clock.decisionDeadline ? `; decision due by ${clock.decisionDeadline}` : ""
      }.`,
      basis,
      clock,
    };
  }

  const [first, ...resubs] = clock.rounds;
  const received =
    `on ${first.received}` + (resubs.length
      ? `, with ${resubs.length === 1 ? "a resubmittal" : "resubmittals"} on ${resubs.map((r) => r.received).join(" and ")}`
      : "");
  const paras = basis.map((f) => PARAGRAPH[f.code](f, clock));
  const asks: string[] = [];
  if (basis.some((f) => f.code === "late_completeness_notice" || f.code === "no_completeness_notice"))
    asks.push("confirm that the application is complete and that the 60-day review period has started");
  if (basis.some((f) => f.code === "new_items_on_resubmittal"))
    asks.push("limit the completeness review to the items on the original list");
  if (basis.some((f) => f.code === "no_item_list")) asks.push("send the list of incomplete items and how to address them");
  if (basis.some((f) => f.code === "deemed_approved" || f.code === "late_decision"))
    asks.push("confirm the status of the application and the next steps toward permit issuance");

  const body = [
    `[DATE]`,
    ``,
    `City of ${input.city}`,
    `[DEPARTMENT / PLANNER NAME]`,
    ``,
    `**Re: ${subject}**`,
    ``,
    `Dear [PLANNER NAME],`,
    ``,
    `Thank you for your work on our ${project} application for [PROPERTY ADDRESS]. The City received it ${received}. We'd like to note the following under State ADU Law:`,
    ``,
    ...paras.flatMap((p) => [p, ``]),
    `We'd be grateful if the City could ${asks.length > 1 ? `${asks.slice(0, -1).join(", ")}, and ${asks[asks.length - 1]}` : asks[0]}. We're happy to provide anything that helps and would like to keep this moving cooperatively.`,
    ``,
    `Sincerely,`,
    `[APPLICANT NAME]`,
    ``,
    `---`,
    `*Draft prepared with Fast Path Check (prototype). Not legal advice; review before sending. Statute: ${GOV_66317_URL} (checked 2026-11-07). Assumptions: ${clock.assumptions.join(" ")}*`,
  ].join("\n");

  return { applies: true, subject, body, basis, clock };
}
