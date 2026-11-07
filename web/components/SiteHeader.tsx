import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="w-full border-b border-border">
      <div className="mx-auto flex h-14 max-w-5xl items-center px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-md bg-accent text-on-accent"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h10M11 6l6 6-6 6" />
            </svg>
          </span>
          Fast Track
        </Link>
      </div>
    </header>
  );
}
