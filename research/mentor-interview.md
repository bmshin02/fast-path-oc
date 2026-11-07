# Mentor interview: ADU permitting

**Who:** Mike Brown, who now works with cities on ADU permitting. He built Crossbeam Permits, which won Anthropic's first global hackathon. He gave his name for attribution.
**When:** 2026-11-07, about 5 minutes at the event. Asked by Person B.
**Method:** short scripted questions. The notes below summarize a rough speech-to-text transcript. Quotes are paraphrased unless marked.

Everything here is **one practitioner's experience and estimates**, not measured data. It's labeled that way wherever we use it.

## What he said

### 1. Completeness is the real bottleneck, before any legal review
- Every city has a checklist an application must meet before it's even "complete" enough for plan check.
- **Laguna Beach: over 90% of first-time applications are incomplete.** He says the same is true everywhere: "you give them a list, but it is complicated and they never get it right."
- **Common misses:** a soils report, a grading plan, a fire plan (or a wrong one). It's not usually a legal dispute, just "most people just miss something."
- **Cities fight applicants on completeness.** Once an application is deemed complete, the city's clock runs, so cities often call it incomplete instead of issuing corrections.

### 2. Correction rounds and the shot clock
- **A typical ADU goes through 3–4 correction rounds.** (His estimate.)
- He pointed us to California's permit **"shot clock" laws**: deadlines after which a permit is deemed approved. The ADU clock is **60 days from a complete application**, and cities often take until about day 59.

### 3. Checklists are often out of date, and pushing back is a choice
- City checklists are **often out of compliance with state law**. Telling a city so can start a fight, so applicants pick their battles.
- There are **two separate layers:**
  - **Building codes** (is it safe?): California updates them every 3 years. In January the state moved from the 2022 to the 2025 code cycle, so every city has to update its building requirements.
  - **Planning/zoning** (can I build this here?): SB 9, SB 1122/1123 and similar laws. This is where state–city fights happen.
- **HCD's letters** are the record of those fights. He estimates **about 1,600 letters** stating HCD's positions.

### 4. Delay cost: our $85k figure is probably too low
- He said it's "gonna be more than that."
- His framework: delay costs **mortgage interest while you hold the property**. Example: a $1M flip with 20% down (an $800k loan at about 7.3%) and a target profit of about $300k. Every month of waiting comes out of that profit.

## What we checked

| Claim | Check | Result |
|---|---|---|
| ADU 60-day "shot clock" | Gov **66317**, read in a browser on leginfo 2026-11-07 | **Confirmed, and stronger than described.** 66317(a)(2): the city must decide completeness **within 15 business days**, give a **list of incomplete items** with how to fix them, and **can't add new items** when the applicant resubmits. If it misses the deadline, the application is **deemed complete**. 66317(a)(3): approve or deny within **60 days** of a complete application, or it's **deemed approved**. 66317(b): a denial must come with a full list of deficiencies |
| Building code moved from 2022 to 2025 cycle | Irvine's site has a "2025 California Building Standards Code Adoption" page (seen in search results) | Consistent. We didn't check the effective date further |
| Do our fixture forms cite old code years? | Searched the text of the Anaheim Z412 and Irvine ADU application PDFs | Neither cites a building code year |
| ~1,600 HCD letters | Not checked | His estimate. The plan already notes the HCD letter dashboard is hard to read automatically |
| 90% incomplete (Laguna Beach), 3–4 rounds | Not checkable from public data | His experience, labeled as such |

## Delay-cost math (from his framework)

Interest-only carrying cost, which is the part that's actually lost. Principal payments build equity, so they aren't counted. Taxes, insurance and the opportunity cost of the down payment are left out too, so these numbers are **low**.

| Scenario | Loan | Interest per month | 12 months | 48 months |
|---|---|---|---|---|
| His example: $1M flip, 20% down, 7.3% | $800,000 | ~$4,867 | ~$58,400 | ~$233,600 |
| Our baseline home: $535k, 20% down, 7.3% | $428,000 | ~$2,604 | ~$31,200 | ~$125,000 |

- **ASSUMPTION:** the 7.3% rate and 20% down are his figures, not a sourced current rate.
- On his example, each month of delay costs about **1.6% of a $300k profit target**, so about 5 years of delay wipes out the profit entirely.
- For the same 4 years, interest alone on our $535k baseline is about **$125k**, already above the $85k `timeline.json` figure. That supports his point that $85k is low. It's still a rough model, not a measurement.

## What this means for the product

1. **Package gaps matter more than we thought.** If over 90% of first submissions are incomplete, "what's missing from your package" may be the most valuable section of the report, alongside stale citations.
2. **Cite 66317 for the clock**, not just the 66314–66331 range. Show both deadlines: 15 business days for completeness, then 60 days to decide. Point out that the city can't add new completeness items on resubmittal. That's practical leverage for applicants, stated as what the statute says, not legal advice.
3. **Worth checking for soils reports, grading plans and fire plans** when the city requires them. They're common misses, but the app should only flag them when the city's checklist or code actually asks for them.
4. **Building-code staleness is a possible later feature:** flagging checklists that still reference the 2022 code cycle. It's a separate layer from the planning law we audit now, so it's out of scope for today.
5. **Delay-cost framing for the pitch:** "each month of delay is about $2,600–4,900 in interest alone." Label it ASSUMPTION with these inputs.
