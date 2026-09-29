# price-formatting-consistent-across-pages

## Lens

Wildcard (Focus 11, property discovery) — run after the other 5 lenses (Data Integrity, Protocol
Contracts, Security Boundaries, Lifecycle Transitions, Idempotency and Replay) completed. This
property doesn't fit any of their fixed lenses: it's not about a race, a crash, an auth boundary,
or a replay — it's about a locale/data-consistency guarantee nobody explicitly claims but every
shopper relies on.

## What led to this property

`bugs.md` finding #14 (first-hand exploratory finding on this exact running instance, not a
third-party bug report, so no `validating-claims.md` validation gap applies — this is primary
evidence by construction): *"Store country is set to United Kingdom but the storefront currency
defaults to EUR, not GBP — locale mismatch."* That's a one-off configuration observation. The
generalizable, checkable property behind it isn't "the currency should be GBP" (that's a config
opinion, not a correctness invariant) — it's that **whatever currency is active, every price on
every page must be formatted the same way**: same symbol, same symbol position, same decimal and
thousands separators. A shop that's internally inconsistent about its own currency formatting
(e.g. `€19.99` on the product listing and `19,99 EUR` on the cart page) is a worse, more confusing
bug than simply defaulting to the "wrong" currency for the configured country.

## Property Catalog Entry

### price-formatting-consistent-across-pages — Price formatting is internally consistent

| | |
|---|---|
| **Type** | Safety |
| **Property** | Across all storefront pages (homepage, listing, product, cart, checkout), every rendered price string uses the same currency symbol, symbol position (prefix/suffix), decimal separator, and thousands separator as every other rendered price string, for the currency active during that session. |
| **Invariant** | `Always` — extract every price-shaped string from the rendered DOM on each page visited; parse out (symbol, position, decimal separator) for each; assert all extracted tuples are identical across every page seen in the run so far. A single outlier (different symbol, different separator convention) fails the assertion immediately. |
| **Antithesis Angle** | Not a timing property — a state/rendering consistency property. Antithesis's value here is almost entirely from the breadth of *pages* the exploration reaches (default navigation already visits home/listing/product/cart), and from cart-rule/discount code paths that might format a reduction differently than a base price (a discount amount rendered via a different code path than list prices is a plausible place for this to drift). |
| **Why It Matters** | Confirmed, first-hand locale inconsistency already observed on this exact deployment (`bugs.md` #14). A shopper who sees inconsistent price formatting has direct grounds to distrust the total at checkout — this sits squarely in the "displayed price is the price that will be charged" guarantee named in `sut-analysis.md`'s Safety Guarantees section. |

**Open Questions:**

- What is the *correct* single formatting convention to assert against — is it read from `Configuration::get()`/the active `Currency` object's format fields (in which case the property could assert against that authoritative value rather than just "internally consistent with itself"), or should the property stay self-referential (all prices agree with each other, regardless of what the "correct" format is)? A self-referential invariant is weaker but requires no additional source-reading to implement; an authoritative-value comparison is stronger but needs confirming where PrestaShop exposes that formatting config to a black-box workload (it doesn't render it directly in the DOM anywhere obvious). Not investigated this pass.
- Does the existing `bugs.md` #14 country/currency mismatch itself get fixed by demo-data changes over time (it's a fresh-install default), which would remove the original motivating observation but not the general property's value? Doesn't affect the property's validity either way.
