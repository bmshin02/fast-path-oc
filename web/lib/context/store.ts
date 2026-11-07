// Browser-side home for the project memory: sessionStorage, so it lasts across forms and page
// reloads in this tab and disappears when the tab closes. Nothing goes to our server except
// the small memory block sent with each fill turn.

import { factsFromFields, mergeFacts, sanitizeMemory, type Memory } from "./memory";
import type { FormField } from "../fill/types";

const KEY = "fast-track-memory";
let inMemory: Memory = { facts: [] }; // fallback when storage is blocked (private mode, previews)

export function loadMemory(): Memory {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return (inMemory = sanitizeMemory(JSON.parse(raw)));
  } catch {
    // storage blocked or corrupt: fall back to this page's copy
  }
  return inMemory;
}

function save(m: Memory) {
  inMemory = m;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // quota or blocked: keep the in-page copy
  }
}

/** Remember what a form learned. Safe to call after every field event; merges by label. */
export function rememberFields(fields: FormField[], fromForm: string): Memory {
  const next = mergeFacts(loadMemory(), factsFromFields(fields, fromForm));
  save(next);
  return next;
}

/** "Forget my answers": clears the memory for this tab. */
export function clearMemory() {
  inMemory = { facts: [] };
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}
