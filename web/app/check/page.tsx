import type { Metadata } from "next";
import { CheckTester } from "@/components/check/CheckTester";

// Test page for the agent pipeline (/api/check). Not linked from the main site.
export const metadata: Metadata = {
  title: "Agent check (test) · Fast Track",
  robots: { index: false },
};

export default function CheckPage() {
  return (
    <main className="flex-1 bg-fog px-4 py-8 sm:px-6 sm:py-10">
      <CheckTester />
    </main>
  );
}
