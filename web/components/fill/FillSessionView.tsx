"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, LoaderCircle } from "lucide-react";
import { createSession, type FillSession } from "@/lib/fill/session";
import type { FillEvent, FormField, FormSource } from "@/lib/fill/types";
import { fieldState } from "@/lib/fill/types";
import { FieldList } from "./FieldList";
import { ResultPanel } from "./ResultPanel";

type Message = { id: number; from: "fast-track" | "you"; text: string };

// The questions page: a conversation on the left, the form filling in on the
// right. When the session is done, the result (summary, preview, download)
// appears below.
export function FillSessionView({ source }: { source: FormSource }) {
  const [session] = useState<FillSession>(() => createSession(source));
  const [fields, setFields] = useState<FormField[]>(() => session.fields);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [recentId, setRecentId] = useState<string | null>(null);
  const [done, setDone] = useState<{ summary: string; fields: FormField[] } | null>(null);
  const [draft, setDraft] = useState("");

  const started = useRef(false);
  const nextId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

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
        setAsking(true);
        break;
      case "field":
        setFields((fs) => fs.map((f) => (f.id === ev.field.id ? ev.field : f)));
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
    try {
      for await (const ev of events) handle(ev);
    } catch (err) {
      console.error(err);
      setStatus(null);
      say("fast-track", "Sorry, something went wrong on my side. Please try your answer again.");
      setAsking(true);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void consume(session.start());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, status]);

  const shownInput = useRef(false);
  useEffect(() => {
    if (!asking) return;
    const input = inputRef.current;
    input?.focus({ preventScroll: true });
    if (input && !shownInput.current) {
      shownInput.current = true;
      if (input.getBoundingClientRect().bottom > window.innerHeight) {
        input.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }
  }, [asking]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !asking) return;
    setDraft("");
    say("you", text);
    void consume(session.answer(text));
  }

  const filled = fields.filter((f) => fieldState(f) === "filled").length;

  return (
    <div>
      <p className="mb-4 rounded-2xl bg-mist px-5 py-2.5 text-base leading-7 text-secondary">
        Demo version: the questions are scripted for now. Soon Fast Track will
        read your actual form and look things up for real.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Conversation */}
        <section
          aria-label="Conversation with Fast Track"
          className="flex flex-col rounded-[24px] bg-background ring-1 ring-border lg:h-[calc(100vh-360px)] lg:max-h-[760px] lg:min-h-[480px]"
        >
          <div role="log" aria-live="polite" className="flex min-h-[320px] flex-1 flex-col gap-4 overflow-y-auto p-5 sm:p-7">
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
                <p
                  key={m.id}
                  className="max-w-[92%] rounded-3xl rounded-bl-lg bg-mist px-5 py-3 text-lg leading-7 text-foreground"
                >
                  <span className="sr-only">Fast Track: </span>
                  {m.text}
                </p>
              ),
            )}
            {status && (
              <p className="flex items-center gap-3 px-1 text-lg text-secondary">
                <LoaderCircle className="h-5 w-5 shrink-0 motion-safe:animate-spin" strokeWidth={2} aria-hidden />
                {status}
              </p>
            )}
            <div ref={endRef} />
          </div>

          {!done && (
            <form onSubmit={send} className="sticky bottom-0 rounded-b-[24px] border-t border-border bg-fog p-4 sm:p-5 lg:static">
              <label htmlFor="answer" className="sr-only">
                Your answer
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="answer"
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={!asking}
                  autoComplete="off"
                  placeholder={asking ? "Type your answer here" : "Fast Track is working…"}
                  className="h-14 min-w-0 flex-1 rounded-2xl bg-background px-5 text-lg text-foreground ring-1 ring-border-strong placeholder:text-muted focus:ring-2 focus:ring-foreground focus:outline-none disabled:bg-mist"
                />
                <button
                  type="submit"
                  disabled={!asking || !draft.trim()}
                  className="inline-flex h-14 shrink-0 items-center gap-2 rounded-full bg-primary-fill px-6 text-lg font-medium text-on-primary transition-colors duration-150 hover:bg-[#2c2f34] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground disabled:opacity-40"
                >
                  <ArrowUp className="h-5 w-5" strokeWidth={2} aria-hidden />
                  Send
                </button>
              </div>
            </form>
          )}
        </section>

        {/* The form filling in */}
        <aside
          aria-label="Your form"
          className="self-start overflow-hidden rounded-[24px] bg-background ring-1 ring-border lg:sticky lg:top-6"
        >
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-xl font-medium">Your form</h2>
            <p className="text-base text-secondary" aria-live="polite">
              {filled} of {fields.length} filled
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-mist" aria-hidden>
              <div
                className="h-full rounded-full bg-sienna transition-[width] duration-500"
                style={{ width: `${(filled / Math.max(1, fields.length)) * 100}%` }}
              />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            <FieldList fields={fields} recentId={recentId} finished={Boolean(done)} />
          </div>
        </aside>
      </div>

      {done && <ResultPanel source={source} fields={done.fields} summary={done.summary} />}
    </div>
  );
}
