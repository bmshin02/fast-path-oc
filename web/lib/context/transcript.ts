// Keep a long fill conversation from growing every turn's prompt without bound.
//
// The fill route re-sends the whole conversation each turn. That's fine for 10 questions, but
// with corrections, follow-ups and many forms it keeps growing. Here the recent turns stay
// word for word (they carry the context of the current question) and older ones become one
// line each, capped by a character budget. Every answer still reaches the model: the field
// values hold what was learned, and the compact lines keep the gist.

import type { TranscriptLine } from "../fill/protocol";

export const DEFAULT_TRANSCRIPT_BUDGET = 6000; // characters (~1.5k tokens)
export const KEEP_RECENT = 8; // lines kept verbatim

function clip(s: string, n: number): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

/**
 * Render the transcript for the prompt. Short conversations are returned unchanged. Longer
 * ones get "Earlier (condensed)" lines for older turns and verbatim recent turns.
 */
export function compactTranscript(
  lines: TranscriptLine[],
  budget = DEFAULT_TRANSCRIPT_BUDGET,
  keepRecent = KEEP_RECENT,
): { text: string; condensed: number } {
  const fmt = (l: TranscriptLine) => `${l.from === "you" ? "Applicant" : "Fast Track"}: ${l.text}`;
  if (lines.length === 0) return { text: "(nothing yet: this is the start)", condensed: 0 };

  const full = lines.map(fmt).join("\n");
  if (full.length <= budget) return { text: full, condensed: 0 };

  const recent = lines.slice(-keepRecent).map(fmt);
  const older = lines.slice(0, -keepRecent);
  const recentText = recent.join("\n");
  let room = Math.max(0, budget - recentText.length - 60);

  // Pair older questions with their answers into single lines, newest first, until room runs out.
  const pairs: string[] = [];
  for (let i = 0; i < older.length; i++) {
    const l = older[i];
    if (l.from === "fast-track" && older[i + 1]?.from === "you") {
      pairs.push(`Q: ${clip(l.text, 90)} → A: ${clip(older[i + 1].text, 90)}`);
      i++;
    } else {
      pairs.push(`${l.from === "you" ? "A" : "Q"}: ${clip(l.text, 120)}`);
    }
  }
  const kept: string[] = [];
  for (let i = pairs.length - 1; i >= 0; i--) {
    if (pairs[i].length + 1 > room) break;
    kept.unshift(pairs[i]);
    room -= pairs[i].length + 1;
  }
  const dropped = pairs.length - kept.length;
  const header = `Earlier in this form (condensed${dropped ? `; ${dropped} oldest exchange(s) omitted, their answers are in the fields` : ""}):`;
  return {
    text: [header, ...kept.map((p) => `- ${p}`), "", "Most recent:", recentText].join("\n"),
    condensed: older.length,
  };
}
