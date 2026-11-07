"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, FileText, LoaderCircle } from "lucide-react";
import { FillError } from "@/lib/fill/real";
import { createSession, type FillSession } from "@/lib/fill/session";
import type { FillEvent, FormField, FormSource } from "@/lib/fill/types";
import { fieldState } from "@/lib/fill/types";
import { FieldList } from "./FieldList";
import { ResultPanel } from "./ResultPanel";

type Message = { id: number; from: "fast-track" | "you"; text: string };

function formName(source: FormSource) {
  return source.kind === "sample" ? `${source.form.city}: ${source.form.title}` : source.file.name;
}

// The questions page. While Fast Track is asking, the screen is one workspace:
// the conversation (answer box always at the bottom) and, on wide screens,
// the form filling in beside it. On phones the form folds into a button at
// the top of the chat. When done, the result takes over the screen.
export function FillSessionView({ source, mock = false }: { source: FormSource; mock?: boolean }) {
  const [session] = useState<FillSession>(() => createSession(source, { mock }));
  const [fields, setFields] = useState<FormField[]>(() => session.fields);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [recentId, setRecentId] = useState<string | null>(null);
  const [done, setDone] = useState<{ summary: string; fields: FormField[] } | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [choices, setChoices] = useState<string[] | null>(null);

  const started = useRef(false);
  const nextId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const say = (from: Message["from"], text: string) =>
    setMessages((m) => [...m, { id: nextId.current++, from, text }]);

  function handle(ev: FillEvent) {
    switch (ev.type) {
      case "status":
        setStatus(ev.text);
        break;
      case "message":
        setStatus(null);
        say("fast-track", ev.text);
        break;
      case "question":
        setStatus(null);
        say("fast-track", ev.text);
        setChoices(ev.choices?.length === 2 ? ev.choices : null);
        setAsking(true);
        break;
      case "field":
        setFields((fs) =>
          fs.some((f) => f.id === ev.field.id)
            ? fs.map((f) => (f.id === ev.field.id ? ev.field : f))
            : [...fs, ev.field],
        );
        setRecentId(ev.field.id);
        break;
      case "done":
        setStatus(null);
        setRecentId(null);
        setFields(ev.fields);
        say("fast-track", ev.summary);
        setDone({ summary: ev.summary, fields: ev.fields });
        break;
    }
  }

  async function consume(events: AsyncGenerator<FillEvent>) {
    setAsking(false);
    setError(null);
    try {
      for await (const ev of events) handle(ev);
    } catch (err) {
      console.error(err);
      setStatus(null);
      setError(err instanceof FillError ? err.message : "Something went wrong on our side. Please try again.");
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void consume(session.start());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Keep the newest message in view inside the chat (without moving the page).
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, [messages, status, error]);

  const choicesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!asking) return;
    if (choices) choicesRef.current?.querySelector("button")?.focus({ preventScroll: true });
    else inputRef.current?.focus({ preventScroll: true });
  }, [asking, choices]);

  useEffect(() => {
    if (done) window.scrollTo({ top: 0 });
  }, [done]);

  function answer(text: string) {
    if (!text || !asking) return;
    setDraft("");
    setChoices(null);
    say("you", text);
    void consume(session.answer(text));
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    answer(draft.trim());
  }

  const filled = fields.filter((f) => fieldState(f) === "filled").length;
  const progress = (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-mist" aria-hidden>
      <div
        className="h-full rounded-full bg-sienna transition-[width] duration-500"
        style={{ width: `${(filled / Math.max(1, fields.length)) * 100}%` }}
      />
    </div>
  );

  const conversation = (
    <>
      {messages.map((m) =>
        m.from === "you" ? (
          <p
            key={m.id}
            className="ml-auto max-w-[85%] rounded-3xl rounded-br-lg bg-primary-fill px-5 py-3 text-lg leading-7 text-on-primary"
          >
            <span className="sr-only">You said: </span>
            {m.text}
          </p>
        ) : (
          <p key={m.id} className="max-w-[92%] rounded-3xl rounded-bl-lg bg-mist px-5 py-3 text-lg leading-7 text-foreground">
            <span className="sr-only">Fast Track: </span>
            {m.text}
          </p>
        ),
      )}
    </>
  );

  // Finished: the result is the whole screen; the chat folds away.
  if (done) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
        <ResultPanel source={source} fields={done.fields} summary={done.summary} mock={mock} />
        <details className="group mt-8 rounded-[24px] bg-background ring-1 ring-border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[24px] px-5 py-4 text-lg font-medium focus-visible:outline-2 focus-visible:outline-foreground">
            See the conversation
            <ChevronDown className="h-5 w-5 transition-transform duration-150 group-open:rotate-180" aria-hidden />
          </summary>
          <div className="relative flex flex-col gap-4 border-t border-border p-5 sm:p-7">{conversation}</div>
        </details>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-80px)] w-full max-w-[1200px] flex-col px-3 py-3 sm:px-6 sm:py-5">
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Conversation */}
        <section
          aria-label="Conversation with Fast Track"
          className="flex min-h-0 flex-col overflow-hidden rounded-[24px] bg-background ring-1 ring-border"
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
            <FileText className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
            <p className="min-w-0 flex-1 truncate text-base font-medium">{formName(source)}</p>
            {mock && (
              <span className="shrink-0 rounded-full bg-mist px-3 py-1 text-sm text-secondary">Demo</span>
            )}
          </div>

          {/* Phones: the form folds into one button above the chat. */}
          <div className="border-b border-border lg:hidden">
            <button
              type="button"
              onClick={() => setFormOpen((o) => !o)}
              aria-expanded={formOpen}
              className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
            >
              <span className="flex-1">
                <span className="block text-base font-medium">
                  Your form: {filled} of {fields.length} filled
                </span>
                {progress}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-base text-secondary">
                {formOpen ? "Hide" : "Show"}
                <ChevronDown className={`h-5 w-5 transition-transform duration-150 ${formOpen ? "rotate-180" : ""}`} aria-hidden />
              </span>
            </button>
            {formOpen && (
              <div className="max-h-[45dvh] overflow-y-auto border-t border-border">
                <FieldList fields={fields} recentId={recentId} />
              </div>
            )}
          </div>

          <div ref={logRef} role="log" aria-live="polite" className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
            {conversation}
            {error && (
              <div role="alert" className="rounded-2xl bg-peach px-5 py-4 text-sienna">
                <p className="text-lg leading-7">{error}</p>
                <button
                  type="button"
                  onClick={() => void consume(session.retry())}
                  className="mt-3 inline-flex h-12 items-center rounded-full bg-sienna px-6 text-lg font-medium text-peach transition-colors duration-150 hover:bg-[#4a2114] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sienna"
                >
                  Try again
                </button>
              </div>
            )}
            {status && (
              <p className="flex items-center gap-3 px-1 text-lg text-secondary">
                <LoaderCircle className="h-5 w-5 shrink-0 motion-safe:animate-spin" strokeWidth={2} aria-hidden />
                {status}
              </p>
            )}
          </div>

          <form onSubmit={send} className="border-t border-border bg-fog px-3 pt-3 pb-2 sm:px-5 sm:pt-4">
            <label htmlFor="answer" className="sr-only">
              Your answer
            </label>
            {choices && asking ? (
              <div ref={choicesRef} role="group" aria-label="Choose an answer" className="grid grid-cols-2 gap-2 sm:gap-3">
                {choices.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => answer(c)}
                    className="h-14 rounded-2xl bg-background px-4 text-lg font-medium text-foreground ring-1 ring-border-strong transition-colors duration-150 hover:bg-primary-fill hover:text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground active:scale-[0.98]"
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                id="answer"
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={!asking}
                autoComplete="off"
                enterKeyHint="send"
                placeholder={asking ? "Type your answer" : "Fast Track is working…"}
                className="h-14 min-w-0 flex-1 rounded-2xl bg-background px-4 text-lg text-foreground ring-1 ring-border-strong placeholder:text-muted focus:ring-2 focus:ring-foreground focus:outline-none disabled:bg-mist sm:px-5"
              />
              <button
                type="submit"
                disabled={!asking || !draft.trim()}
                className="inline-flex h-14 shrink-0 items-center gap-2 rounded-full bg-primary-fill px-5 text-lg font-medium text-on-primary transition-colors duration-150 hover:bg-[#2c2f34] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground disabled:opacity-40 sm:px-6"
              >
                <ArrowUp className="h-5 w-5" strokeWidth={2} aria-hidden />
                Send
              </button>
            </div>
            )}
            <p className="mt-2 text-center text-sm leading-5 text-muted">
              {mock
                ? "Demo: these questions are scripted. Nothing is really read or looked up."
                : "Fast Track can make mistakes. Check every answer before you sign. Not legal advice."}
            </p>
          </form>
        </section>

        {/* Wide screens: the form filling in beside the chat. */}
        <aside
          aria-label="Your form"
          className="hidden min-h-0 flex-col overflow-hidden rounded-[24px] bg-background ring-1 ring-border lg:flex"
        >
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-xl font-medium">Your form</h2>
            <p className="text-base text-secondary" aria-live="polite">
              {filled} of {fields.length} filled
            </p>
            {progress}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <FieldList fields={fields} recentId={recentId} />
          </div>
        </aside>
      </div>
    </div>
  );
}
