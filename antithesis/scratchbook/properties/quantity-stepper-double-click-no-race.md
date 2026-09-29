---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
---

# quantity-stepper-double-click-no-race

## Lens

Idempotency and Replay — double-click / rapid-repeat race on a state-changing control (the cart
line quantity +/- stepper, distinct from the add-to-cart button covered by
`add-to-cart-double-click-no-duplicate-line.md`).

## What led to this property

Same root observation as the add-to-cart double-click property (`sut-analysis.md`'s Concurrency
Model section names "double-clicking add-to-cart / quantity +/- buttons" together as the client-
side race surface), but the quantity stepper is a different code path from add-to-cart: it
*mutates* an existing cart line's quantity via AJAX (typically a PATCH/POST to update the
line quantity) rather than creating/merging a line. The failure mode is different too — not a
duplicate row, but a **quantity/price desync**: the displayed line subtotal no longer equals
`unit price × displayed quantity`, or the quantity field shows a value the server never actually
committed (a client-side optimistic update that "stuck" locally without a matching server write).

This is also where the existing Bombadil property `cartBadgeCountIsNonNegative` is closest but
narrowest: it only checks the header badge parses to a non-negative integer. It does not check:
(a) per-line quantity vs. per-line subtotal consistency, or (b) whether the value survives a
reload (a purely client-side/optimistic value that reload wipes back to the true server value
would itself reveal the race, which the existing property can't see because it only samples the
badge, once, whenever Bombadil happens to look).

## What goes wrong if this is violated

- Line subtotal disagrees with quantity × unit price: a shopper sees a total that isn't what they
  will actually be charged — this project's own #1 product-context priority
  ("the cart total / price shown is what gets charged").
- Quantity reverts unexpectedly on reload after appearing to update: a "silent" data-loss variant
  of the same underlying race — the UI briefly lies about cart state.
- Quantity goes negative or NaN from an interleaved decrement race (e.g. two rapid "-" clicks each
  reading the pre-decrement value and independently computing "n-1", landing on the same result
  instead of "n-2", or in a differently-buggy implementation, underflowing past zero).

## Property Catalog Entry

### quantity-stepper-double-click-no-race — Cart line quantity and subtotal stay consistent under rapid stepper clicks

| | |
|---|---|
| **Type** | Safety |
| **Property** | After any sequence of rapid clicks on a cart line's quantity +/- control, the line's displayed quantity is a non-negative integer and the line's displayed subtotal equals unit price × displayed quantity, both immediately after the interaction and after a subsequent reload. |
| **Invariant** | `Always`. Extract, per cart line row, `(quantity, unit_price, subtotal)` and assert `subtotal == quantity * unit_price` (within a small rounding tolerance for currency formatting) and `quantity >= 0`; evaluate this on every cart-page observation, including immediately after a reload. Checking post-reload as well as post-interaction is what distinguishes this from the existing `cartBadgeCountIsNonNegative`/`cartModalAgreesWithHeaderBadge` properties, which only sample state Bombadil happens to observe once and never explicitly re-check across a reload boundary. |
| **Antithesis Angle** | Bombadil's default click generator already produces rapid repeated clicks on the same element (the stepper) as ordinary exploration; the default reload action generator provides the post-interaction settle-check for free, per `sut-analysis.md`'s "Wildcard" note that reload/back/forward is "an accidental fuzzer" already running without new workload authorship. Antithesis's scheduling perturbation increases the odds two stepper-click AJAX calls are in flight together, exercising whatever ordering assumption the client-side optimistic-update JS makes. |
| **Why It Matters** | `stock/quantity` is a 23-issue closed-bug category and `calculation/pricing/tax` is the single largest category (47) in `closed-bugs-last-year.md`; a quantity/price desync sits at the intersection of both and is a direct financial-correctness bug, not a cosmetic one. |

**Open Questions:**

- Is the quantity stepper's client-side update optimistic (updates the DOM immediately, reconciles with the server response afterward) or does it wait for the AJAX response before updating the DOM at all? This determines whether a "stuck" pre-reload value is even possible through the UI, or whether the race can only be seen post-reload. Not inspected live against the running instance in this pass. `(needs investigation — requires reading the theme's cart JS or observing network timing live)`
- What rounding/tax behavior applies to `subtotal` (tax-included vs. tax-excluded display, per-line rounding vs. rounding only at the cart-total level)? Needed to set a correct tolerance for the equality check rather than guessing a tolerance that's either too loose (misses real bugs) or too tight (flags normal rounding as a violation). `(needs investigation against a live cart page with a non-round unit price)`

### Investigation Log

_No investigation attempted yet beyond the analysis above — this property was derived from the SUT-analysis and existing-assertions documents plus general e-commerce cart architecture reasoning, not from a specific bug report or source read, so per `validating-claims.md` it is recorded as a claimed guarantee to test, not a verified defect. The open questions above are the concrete next steps, not yet pursued._
