// Gov. Code 66317 "shot clock" for ADU / JADU permit applications.
//
// Hand-checked on leginfo 2026-11-07:
//   (a)(2)(A) The permitting agency must decide whether an application is complete and give
//             written notice within 15 BUSINESS days of receiving it.
//   (a)(2)(B) If incomplete, the notice must list the incomplete items and how to fix them.
//   (a)(2)(D) On resubmittal, the agency can't require an item that wasn't on that list.
//   (a)(2)(E) A resubmittal gets the same 15-business-day timeline.
//   (a)(2)(F) If the agency misses the deadline, the application is deemed complete.
//   (a)(3)    Approve or deny within 60 days of receiving a complete application, if there's an
//             existing single-family or multifamily dwelling on the lot; otherwise deemed approved.
//             If the ADU is submitted with a new primary dwelling, the agency may wait until it
//             decides that dwelling. An applicant-requested delay tolls (pauses) the 60 days.
//
// This is arithmetic on the statute's text, not legal advice. Choices the statute leaves open
// are returned as explicit assumptions so the UI can show them.

export const GOV_66317_URL =
  "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=66317.";

export type IsoDate = string; // YYYY-MM-DD

// ---------- date helpers (UTC, day precision) ----------

const DAY = 86_400_000;

export function parseDate(d: IsoDate): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) throw new Error(`Expected YYYY-MM-DD, got "${d}"`);
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (date.getUTCMonth() !== Number(m[2]) - 1) throw new Error(`Invalid date "${d}"`);
  return date;
}

export function fmt(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function addCalendarDays(d: IsoDate, n: number): IsoDate {
  return fmt(new Date(parseDate(d).getTime() + n * DAY));
}

export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / DAY);
}

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  // n >= 1: nth occurrence; n = -1: last occurrence. month is 0-based, weekday 0 = Sunday.
  if (n > 0) {
    const first = new Date(Date.UTC(year, month, 1));
    const offset = (weekday - first.getUTCDay() + 7) % 7;
    return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7));
  }
  const last = new Date(Date.UTC(year, month + 1, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month + 1, 0 - offset));
}

/** Move a fixed-date holiday that falls on a weekend to its observed weekday. */
function observed(d: Date): Date {
  const day = d.getUTCDay();
  if (day === 6) return new Date(d.getTime() - DAY); // Saturday → Friday
  if (day === 0) return new Date(d.getTime() + DAY); // Sunday → Monday
  return d;
}

/**
 * U.S. federal holidays (observed dates) for a year. Used as the default closure list.
 * ASSUMPTION: cities close on these days. Many OC cities also close on other days (e.g.
 * alternate Fridays, Cesar Chavez Day, the day after Thanksgiving), so pass a city's own
 * closure dates via `extraClosures` when known.
 */
export function federalHolidays(year: number): IsoDate[] {
  const days = [
    observed(new Date(Date.UTC(year, 0, 1))), // New Year's Day
    nthWeekday(year, 0, 1, 3), // Martin Luther King Jr. Day
    nthWeekday(year, 1, 1, 3), // Presidents' Day
    nthWeekday(year, 4, 1, -1), // Memorial Day
    observed(new Date(Date.UTC(year, 5, 19))), // Juneteenth
    observed(new Date(Date.UTC(year, 6, 4))), // Independence Day
    nthWeekday(year, 8, 1, 1), // Labor Day
    nthWeekday(year, 9, 1, 2), // Columbus / Indigenous Peoples' Day
    observed(new Date(Date.UTC(year, 10, 11))), // Veterans Day
    nthWeekday(year, 10, 4, 4), // Thanksgiving
    observed(new Date(Date.UTC(year, 11, 25))), // Christmas
  ];
  return days.map(fmt);
}

export type Calendar = { closures: Set<IsoDate> };

export function makeCalendar(fromYear: number, toYear: number, extraClosures: IsoDate[] = []): Calendar {
  const closures = new Set<IsoDate>(extraClosures);
  for (let y = fromYear; y <= toYear; y++) for (const h of federalHolidays(y)) closures.add(h);
  return { closures };
}

export function isBusinessDay(d: IsoDate, cal: Calendar): boolean {
  const day = parseDate(d).getUTCDay();
  return day !== 0 && day !== 6 && !cal.closures.has(d);
}

/** The date that is n business days after d (the day of receipt itself isn't counted). */
export function addBusinessDays(d: IsoDate, n: number, cal: Calendar): IsoDate {
  let cur = d;
  let left = n;
  while (left > 0) {
    cur = addCalendarDays(cur, 1);
    if (isBusinessDay(cur, cal)) left--;
  }
  return cur;
}

// ---------- the clock ----------

export type Submission = {
  /** Date the agency received this (re)submission. */
  received: IsoDate;
  /** Date of the agency's written completeness notice, if one was sent. */
  noticeDate?: IsoDate | null;
  /** What the notice said, if sent. */
  noticeResult?: "complete" | "incomplete" | null;
  /** Items the notice listed as incomplete (for checking (a)(2)(D) on the next round). */
  listedItems?: string[];
  /** Items the agency asked for on this round that weren't on the previous list. */
  newItemsRequested?: string[];
};

export type ClockInput = {
  submissions: Submission[]; // in order: original, then each resubmittal
  existingDwelling: boolean; // existing single-family or multifamily dwelling on the lot
  submittedWithNewDwelling?: boolean;
  decisionDate?: IsoDate | null;
  tolledDays?: number; // applicant-requested delays, in calendar days
  today: IsoDate;
  extraClosures?: IsoDate[];
};

export type Flag = { severity: "info" | "warning" | "possible_violation"; code: string; message: string; cite: string };

export type RoundResult = {
  round: number;
  received: IsoDate;
  completenessDeadline: IsoDate;
  noticeDate: IsoDate | null;
  noticeOnTime: boolean | null;
  outcome: "complete" | "incomplete" | "deemed_complete" | "pending";
};

export type ClockResult = {
  rounds: RoundResult[];
  completeOn: IsoDate | null; // date the complete application was received (or deemed complete)
  decisionDeadline: IsoDate | null;
  decisionDate: IsoDate | null;
  status:
    | "awaiting_completeness"
    | "incomplete_awaiting_resubmittal"
    | "in_review"
    | "decided"
    | "deemed_approved_possible"
    | "clock_may_wait_for_main_dwelling";
  daysLeft: number | null;
  flags: Flag[];
  assumptions: string[];
  source: string;
};

export function computeClock(input: ClockInput): ClockResult {
  if (input.submissions.length === 0) throw new Error("At least one submission is required");
  const years = [input.submissions[0].received, input.today, input.decisionDate ?? input.today].map((d) =>
    parseDate(d).getUTCFullYear(),
  );
  const cal = makeCalendar(Math.min(...years), Math.max(...years) + 1, input.extraClosures ?? []);

  const flags: Flag[] = [];
  const assumptions = [
    "Business days exclude weekends and U.S. federal holidays. Cities may close on other days too; pass their closure dates for an exact count.",
    "The 15 business days start the day after the agency receives the application.",
    "When an application is deemed complete because the agency missed its deadline, the 60 days are counted from the date that (re)submission was received.",
    "The 60 days are calendar days (the statute says \"days\").",
  ];

  const rounds: RoundResult[] = [];
  let completeOn: IsoDate | null = null;
  let previousList: string[] | null = null;

  input.submissions.forEach((s, i) => {
    const completenessDeadline = addBusinessDays(s.received, 15, cal);
    const noticeDate = s.noticeDate ?? null;
    const noticeOnTime = noticeDate ? diffDays(noticeDate, completenessDeadline) >= 0 : null;
    let outcome: RoundResult["outcome"] = "pending";

    if (noticeDate && noticeOnTime) {
      outcome = s.noticeResult === "complete" ? "complete" : s.noticeResult === "incomplete" ? "incomplete" : "pending";
    } else if (noticeDate && !noticeOnTime) {
      outcome = "deemed_complete";
      flags.push({
        severity: "possible_violation",
        code: "late_completeness_notice",
        message: `Round ${i + 1}: the completeness notice (${noticeDate}) came after the 15-business-day deadline (${completenessDeadline}). Under 66317(a)(2)(F) the application is deemed complete.`,
        cite: "Gov. Code 66317(a)(2)(F)",
      });
    } else if (diffDays(completenessDeadline, input.today) > 0) {
      outcome = "deemed_complete";
      flags.push({
        severity: "possible_violation",
        code: "no_completeness_notice",
        message: `Round ${i + 1}: no completeness notice by ${completenessDeadline} (15 business days). Under 66317(a)(2)(F) the application is deemed complete.`,
        cite: "Gov. Code 66317(a)(2)(F)",
      });
    }

    if (outcome === "incomplete" && (!s.listedItems || s.listedItems.length === 0)) {
      flags.push({
        severity: "warning",
        code: "no_item_list",
        message: `Round ${i + 1}: an incomplete notice must list the incomplete items and how to fix them.`,
        cite: "Gov. Code 66317(a)(2)(B)",
      });
    }
    if (i > 0 && s.newItemsRequested && s.newItemsRequested.length > 0) {
      flags.push({
        severity: "possible_violation",
        code: "new_items_on_resubmittal",
        message: `Round ${i + 1}: the agency asked for items that weren't on the previous incomplete list (${s.newItemsRequested.join(", ")}). On resubmittal it can't require items that weren't listed.`,
        cite: "Gov. Code 66317(a)(2)(D)",
      });
    }
    if (i > 0 && previousList === null) {
      flags.push({
        severity: "info",
        code: "resubmittal_without_list",
        message: `Round ${i + 1} is a resubmittal, but the previous round's incomplete-item list wasn't provided, so (a)(2)(D) can't be checked.`,
        cite: "Gov. Code 66317(a)(2)(D)",
      });
    }
    previousList = s.listedItems ?? null;

    rounds.push({ round: i + 1, received: s.received, completenessDeadline, noticeDate, noticeOnTime, outcome });
    if (!completeOn && (outcome === "complete" || outcome === "deemed_complete")) completeOn = s.received;
  });

  const last = rounds[rounds.length - 1];
  const decisionDate = input.decisionDate ?? null;
  let decisionDeadline: IsoDate | null = null;
  let status: ClockResult["status"];
  let daysLeft: number | null = null;

  if (!completeOn) {
    status = last.outcome === "incomplete" ? "incomplete_awaiting_resubmittal" : "awaiting_completeness";
    if (status === "awaiting_completeness") daysLeft = diffDays(input.today, last.completenessDeadline);
  } else if (!input.existingDwelling && input.submittedWithNewDwelling) {
    status = "clock_may_wait_for_main_dwelling";
    flags.push({
      severity: "info",
      code: "new_dwelling",
      message:
        "The ADU was submitted with a new primary dwelling, so the agency may wait to decide the ADU until it decides the dwelling. The 60-day clock may not apply yet.",
      cite: "Gov. Code 66317(a)(3)",
    });
  } else {
    if (!input.existingDwelling) {
      flags.push({
        severity: "info",
        code: "no_existing_dwelling",
        message: "The 60-day rule in 66317(a)(3) applies when there's an existing dwelling on the lot. Confirm it applies here.",
        cite: "Gov. Code 66317(a)(3)",
      });
    }
    decisionDeadline = addCalendarDays(completeOn, 60 + (input.tolledDays ?? 0));
    if (decisionDate) {
      status = "decided";
      if (diffDays(decisionDate, decisionDeadline) < 0) {
        flags.push({
          severity: "possible_violation",
          code: "late_decision",
          message: `The decision (${decisionDate}) came after the 60-day deadline (${decisionDeadline}).`,
          cite: "Gov. Code 66317(a)(3)",
        });
      }
    } else if (diffDays(decisionDeadline, input.today) > 0) {
      status = "deemed_approved_possible";
      flags.push({
        severity: "possible_violation",
        code: "deemed_approved",
        message: `No decision by ${decisionDeadline} (60 days from a complete application). Under 66317(a)(3) the application may be deemed approved. Confirm with city staff or counsel.`,
        cite: "Gov. Code 66317(a)(3)",
      });
    } else {
      status = "in_review";
      daysLeft = diffDays(input.today, decisionDeadline);
    }
    if (input.tolledDays) {
      assumptions.push(`${input.tolledDays} days of applicant-requested delay were added to the 60 days (66317(a)(3) tolling).`);
    }
  }

  return { rounds, completeOn, decisionDeadline, decisionDate, status, daysLeft, flags, assumptions, source: GOV_66317_URL };
}
