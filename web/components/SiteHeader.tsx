import Link from "next/link";

// The mark is a ticked form box: the one thing this product does.
export function SiteHeader({ minimal = false }: { minimal?: boolean }) {
  return (
    <header className="w-full bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg text-xl font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="2.5" y="2.5" width="15" height="15" rx="3" />
            <path d="M6.5 10.25l2.5 2.5 4.75-5.5" />
          </svg>
          Fast Track
        </Link>

        {!minimal && (
        <nav className="flex items-center gap-2 sm:gap-6">
          <a
            href="#how-it-works"
            className="hidden rounded-lg px-2 py-2 text-[17px] text-foreground transition-colors duration-150 hover:text-secondary focus-visible:outline-2 focus-visible:outline-foreground sm:block"
          >
            How it works
          </a>
          <a
            href="#forms"
            className="hidden rounded-lg px-2 py-2 text-[17px] text-foreground transition-colors duration-150 hover:text-secondary focus-visible:outline-2 focus-visible:outline-foreground sm:block"
          >
            Forms
          </a>
          <Link
            href="/fill"
            className="inline-flex h-11 items-center rounded-full bg-primary-fill px-5 text-[17px] font-medium text-on-primary transition-colors duration-150 hover:bg-[#2c2f34] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            Get started
          </Link>
        </nav>
        )}
      </div>
    </header>
  );
}
