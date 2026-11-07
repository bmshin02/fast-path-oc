import Link from "next/link";

// The mark is a ticked form box: the one thing this product does.
export function SiteHeader() {
  return (
    <header className="w-full border-b border-border">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md text-[17px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-5 w-5 text-accent"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="2.5" y="2.5" width="15" height="15" rx="2.5" />
            <path d="M6.5 10.25l2.5 2.5 4.75-5.5" />
          </svg>
          Fast Track
        </Link>
      </div>
    </header>
  );
}
