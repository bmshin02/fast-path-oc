import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lib/agents/prompts.ts reads ../fast-path-check at request time. Trace from the repo
  // root and include those files so they ship with the /api/check function on Vercel.
  outputFileTracingRoot: path.join(__dirname, ".."),
  outputFileTracingIncludes: {
    "/api/check": ["../fast-path-check/SKILL.md", "../fast-path-check/reference/**/*.md"],
    // /api/tools/oc reads the Orange County scorecard and HCD letter data at request time.
    "/api/tools/oc": ["../data/oc-adu-scorecard.json", "../data/oc-hcd-letters.json"],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
