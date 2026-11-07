# Test 8 site: publicly listed OC lot

The input for site mode (PLAN.md, test 8). It holds **public listing facts only**: no owner names, and no agent names or phone numbers.

**Checked: 2026-11-07**, by hand in a browser. Listing sites block automated fetches.

## Listing

| Field | Value | Source |
|---|---|---|
| Address | 10471 Magnolia Ave, Lot 19, Anaheim, CA 92804 | Zillow listing |
| Listing URL | https://www.zillow.com/homedetails/10471-Magnolia-Ave-LOT-19-Anaheim-CA-92804/460029285_zpid/ | — |
| MLS # | OC26020728 | MLS listing pages in search results |
| Status | **Under contract** (184 days on Zillow) | Zillow, 2026-11-07 |
| Asking price | $1,950,000 | Zillow |
| Lot size | 0.51 acre (about 22,200 sq ft) | Zillow |
| Property type | Unimproved land, with an existing freestanding 1,821 sq ft building used for storage | Zillow listing description |
| Location | Corner of Magnolia Ave and Cerritos Ave | Zillow listing description |
| Listing's claims | "Signalized high density corner lot," "potential mixed use," "traffic count of 36,000 cars per day" | Zillow listing description. These are marketing claims, not verified |
| Zoning | **CN, Neighborhood Commercial**, per one LoopNet listing (https://loopnet.com/Listing/10471-Magnolia-Ave-Anaheim-CA/33446388). **Not confirmed with the City of Anaheim**, whose site blocks automated fetches | ASSUMPTION until checked on Anaheim's zoning map |

## Why it's a useful test

The lot is probably **commercially zoned, not residential**. That makes it a good judgment test:

- The app shouldn't offer the ADU or SB 9 paths unless it can confirm residential zoning. Both apply to residential zones.
- If CN zoning is confirmed, the paths worth testing are the commercial-zone ones in `pathways.md` (AB 2011 corridor housing, SB 35/423). The app has to check each path's conditions itself, since nothing on this page establishes eligibility.
- Facts the listing doesn't give (zoning, street width, existing tenants, environmental or hazard overlays) must come out as "unknown" or ASSUMPTION, never filled in.

## Caveats

- **Under contract:** the listing could sell or disappear before judging. Keep this snapshot, and have a backup lot ready if possible.
- **Not a typical 4–12 home residential lot.** If the team wants a straightforward residential example, find a second listing in a residential zone (RS / RM).
- Rejected candidates (checked 2026-11-07): 5055 E Short St #5, Anaheim 92807 (off market) and 934 N Citron St, Anaheim 92805 (off market).
