---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
---

# cart-state-survives-history-navigation

## Lens

Idempotency and Replay — browser-native replay/navigation actions (reload, back, forward) hitting
state that was just changed by a state-changing operation.

## What led to this property

This property is close to a direct transcription of `sut-analysis.md`'s "Wildcard" section:

> **Reload/back/forward as an accidental fuzzer.** Bombadil's *default* action generators already
> include reload and browser back/forward — these are exactly the actions most likely to catch
> cart/session desync (a stale bfcache page showing an old cart badge next to a live add action)
> without any new property authorship, just by running longer. Property discovery should make
> sure at least one property explicitly targets *post-navigation* consistency (state after
> back/forward/reload), not just single-page-load consistency.

and the "Unproven Assumptions" section's explicit callout: "The storefront assumes the two
cart-count render paths (badge vs. modal) stay in sync by construction; nothing found so far
enforces this beyond 'both queries currently agree.'" — note "currently agree" is exactly the
single-observation weakness this property is meant to close, by re-checking agreement across a
navigation boundary instead of only within one page load.

It also directly covers the task brief's two concrete history-navigation scenarios:

1. Reloading a page that was the result of a POST (e.g. right after add-to-cart, right after
   applying a voucher) — does a stale bfcache render or a resubmit produce a wrong count?
2. Back/forward navigation through checkout combined with a state-changing action (e.g. go back
   after reaching a later step, change quantity in cart, go forward again) — does a previously
   computed total silently persist somewhere it shouldn't (client-side bfcache, a cached partial
   render, a stale hidden form field carried forward)?

Unlike the two double-click properties (`add-to-cart-double-click-no-duplicate-line.md`,
`quantity-stepper-double-click-no-race.md`), which are about a *server-side* race between two
concurrent requests, this property is about a *client-side* staleness risk: the browser's
back-forward cache (bfcache) can restore a fully-rendered page from before a state change without
re-running its JS or re-fetching data, so the badge/modal/line-quantity values a user sees after
pressing "back" may reflect the cart as it was *before* whatever action they took on the page they
back-navigated from — visible to Bombadil purely as a DOM state that disagrees with a page it can
independently re-fetch via reload.

## What goes wrong if this is violated

- User adds an item, checks out partway, hits back, and the cart page shown from bfcache still
  says "0 items" (or the pre-add count) even though the badge on a genuinely fresh load would say
  otherwise — confusing, and if the user trusts the stale number and proceeds, could affect what
  they believe they're paying.
- The inverse: forward-navigating back into a later checkout step re-displays a total computed
  before a cart change, and the step doesn't refresh it before the user can confirm/pay — this is
  the more serious variant (from the task brief: "does the previously computed total silently
  persist somewhere it shouldn't").

## Property Catalog Entry

### cart-state-survives-history-navigation — Cart state is never stale after reload, back, or forward

| | |
|---|---|
| **Type** | Safety |
| **Property** | After a cart-state-changing action (add-to-cart, quantity change, voucher application), the cart badge count, cart modal count, and cart-page line quantities/total shown after a reload, browser-back, or browser-forward always agree with what an explicit fresh reload of the current page shows — no navigation path displays a value from before the most recent state change. |
| **Invariant** | `Always`. Extend the existing `extract()`-based badge/modal comparison (`cartBadgeCount`, `cartModalReportedCount` in `bombadil/specification.ts`) with a third comparison point: the value observed immediately after a `back`/`forward`/`reload` action generator fires, compared against the value from a same-page explicit re-fetch taken right after. Assert they're equal. `Always` fits because this must hold at every navigation event Bombadil produces, not just once. |
| **Antithesis Angle** | Zero new workload machinery: `back`, `forward`, and `reload` are already default Bombadil action generators (`bombadil/specification.ts:20`, re-exported from `@antithesishq/bombadil/browser/defaults`) and already fire continuously during ordinary exploration. Antithesis's fault/timing exploration increases the chance a navigation action lands in the exact window between a state-changing AJAX call being fired and its response updating the DOM/cache, which is precisely when a bfcache snapshot would freeze a stale value. This is the highest-leverage property in this lens per the task framing: the check rides on exploration that is already happening. |
| **Why It Matters** | Directly named as a coverage gap in `sut-analysis.md`'s Wildcard and Unproven Assumptions sections — the two existing cart-count properties only check "both queries currently agree" within a single page load, never across a navigation boundary. Checkout-total staleness is explicitly the task's most severe named scenario ("does the previously computed total silently persist somewhere it shouldn't") and lines up with this project's own top product-context priority (the cart/checkout total is what gets charged). |

**Open Questions:**

- Is PrestaShop's storefront theme built to defeat bfcache on cart-relevant pages (e.g. `Cache-Control: no-store` on the cart/checkout routes, or an `unload`/`pageshow` handler that forces a refetch), or does it rely on bfcache being disabled/absent in the test browser? If bfcache is already defeated for these routes, this property would only ever exercise the plain-reload path, not the back/forward-restores-a-frozen-DOM path, and the catalog entry should say so explicitly rather than implying both paths are equally live. Not checked against the live instance or source in this pass. `(needs investigation — inspect response headers on /cart and checkout routes, and behavior of back-navigation in the browser Bombadil drives)`
- How far into checkout can the *current*, anonymous-only Bombadil workload actually get? PrestaShop typically supports guest checkout, but reaching a step with a "previously computed total" (order summary / payment step) may require filling an address form correctly enough for the default fill-action generator to pass validation. If the workload can't reliably reach that far, the checkout-total variant of this property is aspirational for now and only the cart-page variant (badge/modal/line quantities) is actionable today. `(needs investigation — observe a live Bombadil run's reached-page distribution)`

### Investigation Log

_Not yet investigated — both open questions require either a live run against the instance or a source/header check not attempted in this pass (time was spent on the `gh api` searches for the voucher and add-to-cart properties, which hit a shared rate limit; see those evidence files)._
