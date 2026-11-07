// The real fill session: each turn is a POST to /api/fill, which streams back
// FillEvents. The browser keeps the transcript and fields between turns; the
// server keeps nothing.

import { irvineAduFields } from "./mock/irvine-adu";
import { readPdfFields } from "./pdf-fields";
import type { FillRequest, PdfFieldInfo, ServerEvent, TranscriptLine } from "./protocol";
import type { FillSession } from "./session";
import type { FillEvent, FormField, FormSource } from "./types";
import { TOO_LARGE_MESSAGE } from "./upload";
import { loadMemory, rememberFields } from "../context/store";

/** An error whose message is written for the person using the site. */
export class FillError extends Error {}

function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const MODEL_KEY = "fast-track-model";

/**
 * The ?model= choice for /api/fill (sonnet | opus). Page links drop query params, so a
 * choice in the address is remembered for this tab; ?model=default clears it. The server
 * checks the value; a wrong one comes back as a plain error message.
 */
function modelQuery(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("model");
    if (fromUrl === "default") sessionStorage.removeItem(MODEL_KEY);
    else if (fromUrl) sessionStorage.setItem(MODEL_KEY, fromUrl);
    const choice = fromUrl && fromUrl !== "default" ? fromUrl : sessionStorage.getItem(MODEL_KEY);
    return choice ? `?model=${encodeURIComponent(choice)}` : "";
  } catch {
    return ""; // storage blocked: just use the server's default
  }
}

export function createRealSession(source: FormSource): FillSession {
  const curated = source.kind === "sample" && source.form.id === "irvine-adu-application";
  let fields: FormField[] = curated ? irvineAduFields() : [];
  const transcript: TranscriptLine[] = [];

  let prepared: Promise<{ form: FillRequest["form"]; pdfFields?: PdfFieldInfo[] }> | null = null;
  async function prepare() {
    if (source.kind === "sample") {
      const form = { kind: "sample" as const, id: source.form.id };
      if (curated || !source.form.fillable) return { form };
      const bytes = await (await fetch(`/forms/${source.form.id}.pdf`)).arrayBuffer();
      return { form, pdfFields: await readPdfFields(bytes) };
    }
    const bytes = await source.file.arrayBuffer();
    const form = { kind: "upload" as const, name: source.file.name, fileKind: source.fileKind, data: toBase64(bytes) };
    return { form, pdfFields: source.fileKind === "pdf" ? await readPdfFields(bytes) : undefined };
  }

  const formName = source.kind === "upload" ? source.file.name : source.form.title;

  async function* turn(): AsyncGenerator<FillEvent> {
    const { form, pdfFields } = await (prepared ??= prepare());
    // Facts from earlier forms in this visit, so Claude pre-fills instead of re-asking.
    const request: FillRequest = { form, pdfFields, fields, transcript, memory: loadMemory() };

    let res: Response;
    try {
      res = await fetch(`/api/fill${modelQuery()}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
    } catch {
      throw new FillError("Couldn't reach Fast Track. Check your internet connection and try again.");
    }
    // Vercel's own 413 page isn't JSON, so name the problem here.
    if (res.status === 413) throw new FillError(TOO_LARGE_MESSAGE);
    if (!res.ok || !res.body) {
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new FillError(data?.message ?? "Something went wrong on our side. Please try again.");
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buffer += value;
      const lines = buffer.split("\n");
      buffer = done ? "" : (lines.pop() ?? "");
      for (const line of lines) {
        if (!line.trim()) continue;
        const ev = JSON.parse(line) as ServerEvent;
        switch (ev.type) {
          case "error":
            throw new FillError(ev.message);
          case "field": {
            const i = fields.findIndex((f) => f.id === ev.field.id);
            fields = i >= 0 ? fields.map((f, j) => (j === i ? ev.field : f)) : [...fields, ev.field];
            break;
          }
          case "message":
          case "question":
            transcript.push({ from: "fast-track", text: ev.text });
            break;
          case "done":
            fields = ev.fields;
            break;
        }
        yield ev;
      }
      if (done) break;
    }
    // Remember after every turn (not only at the end), so an abandoned form still helps the next.
    rememberFields(fields, formName);
  }

  return {
    get fields() {
      return fields;
    },
    start: turn,
    answer(text) {
      transcript.push({ from: "you", text });
      return turn();
    },
    retry: turn,
  };
}
