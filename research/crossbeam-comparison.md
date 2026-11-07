# CrossBeam vs Fast Path Check

CrossBeam is the closest existing project. It was built by Mike Brown, our mentor ([mentor-interview.md](mentor-interview.md)), and won first place in Anthropic's "Built with Opus 4.6" Claude Code hackathon. **Checked 2026-11-07** from Anthropic's winners post and CrossBeam's landing page. We didn't read its code, so it may do more than described here.

- Anthropic winners post: https://claude.com/blog/meet-the-winners-of-our-built-with-opus-4-6-claude-code-hackathon
- CrossBeam site: https://cc-crossbeam.vercel.app

## What CrossBeam does

- **When:** after plan check, once the city has issued a **corrections letter**.
- **Builder side:** upload construction plan PDFs plus the corrections letter. It sorts each correction into auto-fixable, needs contractor input, or needs an engineer, then drafts a response letter with sheet references and code citations.
- **City side (pitched):** batch-review submitted permits and draft correction letters. Anthropic's post says Buena Park, in OC, is *considering* it. No confirmed adoption.
- **Law used:** the HCD ADU Handbook plus its 2026 addendum (Gov 66310–66342), and city codes from online municipal code libraries.
- **Its stats:** 90%+ of first submissions rejected, a six-month average delay, about $30k in cost to homeowners (from Anthropic's post).
- **Coverage:** the site says "480+ cities supported," but also lists that as roadmap work. Unclear.

## How we differ

| | CrossBeam | Fast Path Check |
|---|---|---|
| **When** | After plan check | **Before submittal** |
| **What it checks** | The applicant's **plans**, against city and state code | The city's **own checklist**, against current state law |
| **Main output** | A response letter for each correction | Stale citations, possible overreach, the approval path and legal clock (Gov 66317), package gaps |
| **Questions the city's rules?** | Not described | **Yes, that's the core** |

**One-liner:** *CrossBeam helps you answer the city's corrections. Fast Path Check checks whether the city's own rules are current before you submit.*

## Why the difference matters

- If a city's checklist is out of date (Anaheim's still cites law HCD told it to remove in March 2025; see [hcd-letters.md](hcd-letters.md)), a tool that only responds to corrections may never catch that.
- With 90%+ of first submissions incomplete (our mentor and CrossBeam's own stats), checking completeness before submittal goes straight at the biggest bottleneck. Gov 66317 gives applicants specific rights at that stage: a 15-business-day decision, a full list of missing items, and no new items added on resubmittal.
- The two tools fit together: ours before submittal, CrossBeam's after plan check.
