// A fill session: Fast Track reads the form, asks questions, and fills fields.
// The page only talks to this interface, so swapping the mock for real
// Claude calls (step 5) doesn't change the UI.

import type { FillEvent, FormField, FormSource } from "./types";
import { createMockSession } from "./mock/engine";

export interface FillSession {
  /** Every field on the form, empty at first, so the page can show them. */
  readonly fields: FormField[];
  /** Read the form; yields events until the first question (or done). */
  start(): AsyncGenerator<FillEvent>;
  /** Send the user's answer; yields events until the next question (or done). */
  answer(text: string): AsyncGenerator<FillEvent>;
}

export function createSession(source: FormSource): FillSession {
  return createMockSession(source);
}
