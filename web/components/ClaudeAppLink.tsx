"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy } from "lucide-react";

// A ready-made message for the Claude app with a button to copy it. Only the
// words are shown; the copied text ends with the /llms.txt address (of
// whichever site this is, live or a preview) so Claude can read the
// instructions. The words also tell Claude to start helping, rather than just
// summarize the link.
const LIVE_SITE = "https://fast-path-oc.vercel.app";
const noop = () => () => {};

export function ClaudeAppLink() {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => LIVE_SITE);
  const words = "Help me fill in my housing form, following the Fast Track instructions.";
  const message = `${words} ${origin}/llms.txt`;
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p
          className="relative min-w-0 flex-1 rounded-2xl bg-background px-5 py-4 text-lg leading-7 text-foreground ring-1 ring-border-strong"
          id="claude-app-link"
        >
          &ldquo;{words}&rdquo;
          <span className="sr-only"> The copied message also includes the Fast Track link.</span>
        </p>
        <button
          type="button"
          onClick={copy}
          aria-describedby="claude-app-link"
          className="inline-flex h-14 shrink-0 items-center justify-center gap-3 rounded-full bg-primary-fill px-8 text-lg font-medium text-on-primary transition-colors duration-150 hover:bg-[#2c2f34] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground active:scale-[0.98]"
        >
          {copied ? (
            <Check className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          ) : (
            <Copy className="h-5 w-5" strokeWidth={2} aria-hidden />
          )}
          {copied ? "Copied" : "Copy message"}
        </button>
      </div>
      <p className="mt-3 min-h-7 text-lg leading-7 text-secondary" aria-live="polite">
        {copied
          ? "Copied, with the Fast Track link. Now paste it into a new chat in the Claude app."
          : failed
            ? `Your browser didn't let us copy it. Type this into Claude instead: ${message}`
            : "The copied message includes the Fast Track link, so Claude can read how to help."}
      </p>
    </div>
  );
}
