import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans } from "next/font/google";
import "./globals.css";

// Public Sans is the US government's open typeface, so the interface reads
// like a civic form. Plex Mono is used only for values typed into forms.
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Fast Track",
  description:
    "Upload a city housing form, answer what only you know, and get it back filled in.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // Browser extensions (e.g. Tabbit) add attributes to <html> before
      // React hydrates; this silences that one known mismatch.
      suppressHydrationWarning
      className={`${publicSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
