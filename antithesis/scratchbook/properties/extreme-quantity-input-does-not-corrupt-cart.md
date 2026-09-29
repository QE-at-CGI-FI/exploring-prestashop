# extreme-quantity-input-does-not-corrupt-cart

## Lens

Wildcard (Focus 11, property discovery). None of the 5 assigned lenses (Data Integrity, Protocol
Contracts, Security Boundaries, Lifecycle Transitions, Idempotency and Replay) map cleanly onto
"Resource Boundaries" (one of `property-discovery.md`'s 11 named focuses, not separately assigned
this pass — noted as a coverage gap in `sut-analysis.md`/this catalog rather than silently
dropped). This property fills that specific gap with the one Resource-Boundaries-shaped scenario
that's cheaply checkable by a browser-only, no-auth workload: extreme numeric input into the one
freely-typeable quantity field on the storefront.

## What led to this property

Not a bug report — a reasoned hypothesis from the input-boundary pattern, per
`property-catalog.md`'s "claimed guarantees" framing: the system implicitly claims that a
shopper-entered quantity is validated before it affects the cart total or is persisted, but nothing
in this project's evidence (bug lists, source reads by other lenses) has yet confirmed *what*
happens at the boundary (e.g. quantity = `999999999999`, a negative number typed directly into the
field bypassing the +/- stepper, a decimal, or a non-numeric string). The Data Integrity lens's
`cart-quantity-can-exceed-stock-via-update-path` finding (confirmed server-side stock-guard bypass
on the update path) makes this more than idle speculation: if the ordinary "increase past stock
limit" case already has a confirmed server-side gap, an extreme/adversarial value on the same input
path deserves its own explicit check rather than assuming it's covered by that property's more
specific stock-limit framing.

## Property Catalog Entry

### extreme-quantity-input-does-not-corrupt-cart — Extreme quantity input degrades safely

| | |
|---|---|
| **Type** | Safety |
| **Property** | Typing an extreme value into the cart quantity field (very large integer, negative number, decimal, or non-numeric string) and submitting it never produces a negative or nonsensical (e.g. integer-overflow-wrapped) cart quantity or total, and never triggers a rendered fatal error — it either clamps/rejects with a visible validation message or is silently ignored, leaving the prior valid quantity in place. |
| **Invariant** | `Always` — after any quantity-field submission, assert the resulting quantity is a non-negative integer within a sane bound (e.g. matching the product's actual stock or a fixed sanity ceiling, whichever is smaller) and that `subtotal == unit_price × quantity` still holds (reusing the extraction the Data Integrity lens's `quantity-stepper-double-click-no-race` property already needs). |
| **Antithesis Angle** | This is a pure input-space exploration property, not a timing property — its value is in the *values* explored, not interleaving. Requires extending Bombadil's default `fill` action generator (or adding a small custom one) to occasionally type extreme/adversarial values into numeric quantity fields specifically, rather than relying on organic fill-generator output, which is likely to produce "normal-looking" numbers. Flagged as needing a workload extension, not just checkable via the existing default generators as-is. |
| **Why It Matters** | Directly follows from a confirmed sibling defect (`cart-quantity-can-exceed-stock-via-update-path`) in the same input surface; integer-overflow / unvalidated-numeric-input bugs are a classic source of negative-price or negative-total display bugs, which would be a severe instance of the "cart total is never wrong" guarantee failing. |

**Open Questions:**

- Does the quantity `<input>` have an HTML-level `type="number"`/`max` constraint that already blocks some of these values client-side (in which case the property needs a workload action that bypasses the HTML input constraint, e.g. direct form submission, to be meaningful), or is it a plain text input relying entirely on server-side validation? Not confirmed against source this pass. `(needs investigation)`
- What is the actual server-side validation path for the quantity parameter (same `CartController::processChangeProductInCart()` the Data Integrity lens already read for the stock-guard bypass, or a separate validator earlier in the request)? Confirming this would let this property cite the same file:line evidence rather than starting from a hypothesis. `(needs investigation)`
