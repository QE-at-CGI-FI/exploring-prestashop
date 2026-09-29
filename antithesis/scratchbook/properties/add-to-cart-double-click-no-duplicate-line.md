---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
---

# add-to-cart-double-click-no-duplicate-line

## Lens

Idempotency and Replay — double-click / rapid-repeat race on a state-changing control.

## What led to this property

`sut-analysis.md`'s "Concurrency Model" section is explicit that the only concurrency surface
Bombadil can exercise in this single-PHP-process deployment is **client-side races**:
"double-clicking add-to-cart / quantity +/- before the AJAX response lands." It even names the
employee-creation crash (`AbstractEmployeeHandler::assertHomepageIsAccessible`) as "a concrete
instance of exactly this pattern turning into a server-side crash" — i.e. the pattern (submit
before a dependent async call/response resolves) is already confirmed to cause real defects in
this codebase, just in a different form (back-office 500) than what's proposed here
(storefront cart-line duplication or a lost/lost-update quantity).

Add-to-cart in PrestaShop's storefront theme is normally an AJAX call from the product page or a
"quick view" that appends/merges into the existing cart. The server-side handler has to do
something equivalent to: read the current cart, find (or create) the line for this
product+combination, set/increment its quantity, save. That read-modify-write is exactly the
shape of an update that is *not* obviously atomic from the outside — if two near-simultaneous
add-to-cart requests (from a double-click) are each handled by a separate PHP-FPM/mod_php worker
process, whether the cart table update is guarded by a DB-level lock or transaction, or is a
plain SELECT-then-UPDATE, determines whether you get "quantity correctly incremented twice" or
"a lost update" or "two separate line rows for the same product" (a duplicate-line bug, a
well-known class of e-commerce cart bug independent of PrestaShop specifically).

I did not confirm the exact PrestaShop handler (`CartController::ajaxProcessAddProduct` or
equivalent, depending on version/theme) against source in this pass — GitHub's search API hit a
shared rate limit during this session (see Investigation Log). This property is therefore framed
as a **claimed guarantee to test** (a shopper's cart should never show two rows for one product
after clicking "add" twice), not a confirmed code-level race, which is the honest framing per
`validating-claims.md` when the mechanism isn't independently verified against source.

## What goes wrong if this is violated

- Two line items for the same product+combination in the cart/checkout UI: confusing at minimum,
  and if each line calculates its own subtotal/tax/shipping-eligibility independently, it can
  produce a wrong displayed total (this project's #1 shopper-impact priority per
  `sut-analysis.md`'s Product Context section).
- A lost update (net quantity ends up lower than the number of successful clicks) is a
  customer-visible "I clicked add twice and only got one" complaint — annoying but not a safety
  violation in the same way duplication is; this property focuses on the *duplicate-line* case
  because it's cleanly checkable from the DOM without needing to know how many clicks actually
  landed or reason about exact expected counts.

## Files / functions likely involved (unconfirmed against source this pass)

- Storefront product page add-to-cart form/button, cart mini-cart/modal (`#blockcart-modal`,
  already read by the existing `cartModalReportedCount` extractor in `bombadil/specification.ts`).
- Cart summary page (`/cart?action=show` or similar) — where line items are rendered and where a
  duplicate-line bug would be most visible.

## Property Catalog Entry

### add-to-cart-double-click-no-duplicate-line — No duplicate cart line from rapid add-to-cart clicks

| | |
|---|---|
| **Type** | Safety |
| **Property** | Rapid/repeated add-to-cart clicks for the same product and combination never result in more than one line item for that product appearing in the cart. |
| **Invariant** | `Always`. Extract, from the cart page/mini-cart DOM, a map from product identifier (product link href or a stable data attribute on the cart-line row) to the count of distinct row elements for that identifier; assert every count is exactly 1 (never more). `Always` fits because this is a correctness invariant that should hold on every observation of cart state, not a rare state to reach once — a single observed duplicate row is itself the bug. |
| **Antithesis Angle** | Bombadil's default click generator already fires repeated clicks on the same element as part of normal exploration (per `bombadil/specification.ts`'s comment referencing "hammer the +/- buttons"); no new action generator is needed. Antithesis's scheduling/timing exploration increases the odds that two add-to-cart requests are in flight concurrently, landing in whatever window (if any) the server-side read-modify-write is unguarded. |
| **Why It Matters** | Duplicate cart lines are a classic correctness bug with direct pricing/checkout impact — this project's own priority ordering (`sut-analysis.md` Product Context) ranks "the cart total is what gets charged" as the top shopper-impact property. `stock/quantity` (23 closed issues) and `calculation/pricing/tax` (47, largest category) in `closed-bugs-last-year.md` are the adjacent bug-density clusters this would sit in if found. |

**Open Questions:**

- Is the add-to-cart handler's cart-line read-modify-write guarded by a DB transaction/lock, or is it a plain SELECT-then-UPDATE that's theoretically racy across two PHP worker processes? Not confirmed against source — GitHub search API was rate-limited during this session. `(needs investigation once rate limit resets)`
- Does the current theme's add-to-cart button already client-side-debounce (disable-on-click) rapid repeat clicks, which would make the server-side race unreachable through the UI regardless of server behavior? Not checked live against the running instance in this pass. `(needs investigation — requires browser inspection of the add-to-cart button's JS)`

### Investigation Log

#### Is the add-to-cart handler's read-modify-write racy?

- Examined: attempted `gh api search/code` against `PrestaShop/PrestaShop` for `addDiscount`/`CartController` (related query, same session) — both calls returned `403 API rate limit exceeded` (a shared secondary rate limit per the tool's own error message: "shared across all tools and agents"). `gh api rate_limit` itself reported `search: remaining 30/30` immediately before the failing calls, suggesting the limiting is enforced upstream of the per-account quota shown.
- Found: nothing — no source read achieved this pass.
- Not found: the actual `CartController`/`Cart` class add-to-cart method, its locking behavior, and whether the theme's JS disables the button on click.
- Conclusion: left as an open question, not resolved. Not tagged `(needs human input)` because it's plausibly resolvable by re-attempting the `gh api search/code` call once the shared rate limit resets (a mechanical retry, not a question only a human can answer) — a future pass should retry before escalating.
