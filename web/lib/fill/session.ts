// A fill session: Fast Track reads the form, asks questions, and fills fields.
// The page only talks to this interface, so the real version (Claude through
// /api/fill) and the scripted demo are interchangeable.

import { createMockSession } from "./mock/engine";
import { createRealSession } from "./real";
import type { FillEvent, FormField, FormSource } from "./types";

export interface FillSession {
  /** Every field on the form so far (empty at first unless we know the form). */
  readonly fields: FormField[];
  /** Read the form; yields events until the first question (or done). */
  start(): AsyncGenerator<FillEvent>;
  /** Send the user's answer; yields events until the next question (or done). */
  answer(text: string): AsyncGenerator<FillEvent>;
  /** Run the last step again after an error, without repeating the answer. */
  retry(): AsyncGenerator<FillEvent>;
}

/** `mock: true` runs the scripted demo: no API key, no cost, same screens. */
export function createSession(source: FormSource, { mock = false } = {}): FillSession {
  return mock ? createMockSession(source) : createRealSession(source);
}
