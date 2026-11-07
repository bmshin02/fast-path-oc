"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy } from "lucide-react";

// The /llms.txt address with a button to copy it, for pasting into the Claude
// app. The address uses whichever site this is (live or a preview).
const LIVE_SITE = "https://fast-path-oc.vercel.app";
const noop = () => () => {};

export function ClaudeAppLink() {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => LIVE_SITE);
  const url = `${origin}/llms.txt`;
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
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
          className="min-w-0 flex-1 rounded-2xl bg-background px-5 py-4 font-mono text-lg break-all text-foreground ring-1 ring-border-strong select-all"
          id="claude-app-link"
        >
          {url}
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
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <p className="mt-3 min-h-7 text-lg leading-7 text-secondary" aria-live="polite">
        {copied
          ? "The link is copied. Now paste it into a new chat in the Claude app."
          : failed
            ? "Your browser didn't let us copy it. Select the link above and copy it yourself."
            : ""}
      </p>
    </div>
  );
}
