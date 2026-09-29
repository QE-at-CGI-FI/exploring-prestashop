---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/prestashop/prestashop
    why: Source used to build the catalog being evaluated; consulted here only to spot-check specific claims when needed.
---

# Evaluation — Lens 2: Coverage Balance

## Scope and method

Read `sut-analysis.md` section by section (Focus 1-12) and mapped each risk area, especially
`closed-bugs-last-year.md`'s bug-density table in Focus 6, against `property-catalog.md`'s 23
properties and 4 categories. Cross-checked against `property-relationships.md`'s clustering and
`deployment-topology.md`'s scope notes. Grepped the catalog for terms named in `sut-analysis.md`'s
Wildcard section to verify follow-through. This lens evaluates the set as a portfolio, not
individual properties.

## Finding 1 (catalog-wide): zero `Sometimes`, zero `Reachable` — the catalog is entirely safety
properties

Every one of the 23 properties is typed `Safety` with invariant `Always` or `AlwaysOrUnreachable`.
There is no `Sometimes` (liveness) and no plain `Reachable` property anywhere in the catalog. This
is precisely the gap pattern the lens description names explicitly as common and worth checking
directly. Two concrete consequences, not just a type-system observation:

1. **A named liveness guarantee was never operationalized.** `sut-analysis.md` Focus 5 (Liveness
   Guarantees) states: "after an add-to-cart or checkout-step action, the UI *eventually* reflects
   the new state without requiring a manual reload — Bombadil's `reload` action generator can help
   confirm this isn't silently relying on stale client-side state." This is a specific,
   already-identified liveness property (state eventually converges without a forced reload) that
   never appears in `property-catalog.md` in any form — not even as an `AlwaysOrUnreachable` safety
   restatement. It sits directly adjacent to the already-catalogued `cart-state-survives-history-navigation`
   (which checks state *after* an explicit reload matches a fresh fetch, not whether the UI updates
   *without* one) — a related but distinct check that was dropped between SUT analysis and the
   catalog.
2. **Reachable properties are missing where they'd validate an `Always`'s precondition.**
   `cart-quantity-can-exceed-stock-via-update-path`'s own evidence file raises, and never resolves,
   whether its guard-error state is ever actually reached without a deliberately seeded low-stock
   product — meaning the property as written can pass vacuously for an entire run. A paired
   `Reachable` property (the availability-limit error state is hit at least once, given seed data)
   would close this. The same gap applies to `extreme-quantity-input-does-not-corrupt-cart` (needs
   the adversarial-fill workload extension to fire at all) and to `voucher-code-resubmit-not-double-applied`
   (needs a seeded cart rule — its `AlwaysOrUnreachable` typing already acknowledges the workload
   may never reach the checked state, but nothing confirms whether it ever does).

**Suggested action:** Add at least one `Sometimes`/liveness property (state converges without a
forced reload, directly per Focus 5) and pair each seed-data-dependent `Always`/`AlwaysOrUnreachable`
property with a `Reachable` property confirming its trigger condition is actually hit once the
relevant seed data exists.

## Finding 2 (catalog-wide): three SUT-analysis-named candidate properties never made it into the
catalog

`sut-analysis.md`'s Wildcard section (Focus 12) names three specific candidates — the GDPR
consent-checkbox visibility bug, the cart-rule-stacking-plus-free-gift interaction, and
currency-symbol staleness after currency deletion — and states outright: "flagged as candidate
properties below, each validated against upstream source before being catalogued." I grepped
`property-catalog.md`, `property-relationships.md`, and every file in `properties/` for "GDPR",
"consent", "free-gift"/"free gift", and "currency...delet[ion]" — zero matches anywhere. None of the
three candidates appear in the catalog in any form, under any name. This is a direct, mechanically
checkable discrepancy between what the SUT analysis document says was going to happen and what
actually happened; either the candidates were dropped silently during synthesis or rejected without
a recorded reason, and the "validated against upstream source" claim for them is unaccounted for.

**Suggested action:** Either add the three candidates (each still requires the "slightly richer
initial-state workload" `sut-analysis.md` already scoped — a second currency, an active cart rule)
or record explicitly why each was dropped, so the discrepancy between the two documents doesn't
read as an unintentional loss.

## Finding 3 (catalog-wide): carriers/shipping (24 closed bugs, comparable to stock/quantity's 23)
has no dedicated property

`sut-analysis.md` Focus 6 lists carriers/shipping at 24 closed issues — almost identical in size to
stock/quantity (23), which received two dedicated, well-developed properties
(`cart-quantity-can-exceed-stock-via-update-path`, `extreme-quantity-input-does-not-corrupt-cart`).
Carriers/shipping receives none. The nearest adjacent property,
`delivery-option-stale-at-payment-confirm`, tests staleness of *which* delivery option was most
recently selected before confirm — a race on selection persistence, not carrier logic itself
(rate/weight calculation, carrier-tax interaction, free-shipping thresholds, carrier availability
by zone/cart weight). The catalog's own "Coverage gaps acknowledged" footer names only multistore,
webservice/import-export, and translation/locale as deliberately out-of-scope categories;
carriers/shipping isn't on that list, so its absence reads as an oversight rather than a reasoned
exclusion — unlike those three, which are explicitly reasoned about relative to this deployment's
actual configuration.

**Suggested action:** A targeted discovery pass on carrier/rate calculation logic, scoped the same
way the pricing/tax discovery pass was scoped (read the actual `Carrier`/shipping-cost calculation
source, don't just cite the bug count).

## Finding 4 (catalog-wide): combinations/variants (8 closed bugs) has no property, despite the
catalog having already surfaced a directly relevant example

Combinations/variants (8 issues) is comparable in size to cart-rules/discounts (7 issues, which got
two properties: `cart-rule-zero-value-discount-saves-silently`, `voucher-code-resubmit-not-double-applied`).
It gets zero. This is notable specifically because
`properties/cart-quantity-can-exceed-stock-via-update-path.md` cites, as motivating context for its
own discovery, "#27871 Combinations quantity in Pack are not verified at the last step of the
checkout" — a combination-specific instance of exactly the stock-guard-bypass pattern the catalog
did generalize for simple products, sitting right next to the evidence that motivated the property
that got written. PrestaShop tracks stock per-combination (size/color variants), not just per
product, so `cart-quantity-can-exceed-stock-via-update-path`'s mechanism (the `update` mode's
disabled guard) plausibly applies identically or differently to combination-scoped cart lines, and
this was never checked.

**Suggested action:** Extend `cart-quantity-can-exceed-stock-via-update-path`'s investigation (or
spin off a sibling property) to confirm whether the same `skipAvailabilityCheckOutOfStock: true`
call site handles combination-scoped `id_product_attribute` the same way as simple products.

## Finding 5 (catalog-wide): display/UI (36, second-largest category) is addressed by exactly one
narrowly-scoped property

`price-formatting-consistent-across-pages` is the only property touching display/UI, and it's
scoped specifically to price-string formatting consistency, not display/UI defects broadly (layout
breakage, image/gallery rendering, responsive behavior). It's plausible that a black-box,
DOM-diffing Bombadil workload is structurally ill-suited to most of what "display/UI" bugs actually
are (visual regressions need pixel/visual diffing, not property assertions) — but the catalog never
states this reasoning the way it does for multistore/webservice/translation. The silence makes it
impossible to tell whether this is a considered exclusion or a miss.

**Suggested action:** At minimum, add a line to the catalog's gap-acknowledgment footer stating
why display/UI wasn't pursued (if the reasoning is "Bombadil can't visually diff, so this category
is out of reach by construction," say so explicitly).

## Finding 6 (catalog-wide): the two-carts-same-stock MySQL race is named twice as real, but never
even stubbed into the catalog

`sut-analysis.md`'s Concurrency Model (Focus 3) states plainly: "MySQL-level races (e.g. two carts
decrementing the same stock row) are real in principle but not observable to a
single-browser-session Bombadil workload... flagged as a gap for `deployment-topology.md` / future
workload design rather than a property to add now." `deployment-topology.md` repeats this under "Out
of scope," explicitly noting a second `bombadil-client` replica would be needed. Both documents
treat this consistently as a known, real, and significant gap (overselling stock is a direct
inventory/financial-integrity failure — arguably higher real-world stakes than several properties
that did get catalogued). Yet unlike `voucher-code-resubmit-not-double-applied` or
`extreme-quantity-input-does-not-corrupt-cart` — both catalogued despite needing a workload
extension, with a 🔧 tag and open questions tracking the gap — the two-cart stock race never gets
even a stub entry in `property-catalog.md`. The catalog's reachability-tag convention (✅/🔧/🔒) has
no tag for "blocked on a second workload replica," so this gap is invisible to anyone reading only
the catalog, not the SUT analysis or topology doc.

**Suggested action:** Add a stub property (e.g. `concurrent-carts-cannot-jointly-oversell-stock`)
with an explicit reachability tag distinguishing it from the existing three (needs 2-replica
topology, not just workload/seed-data extension), so this gap is visible from the catalog itself
and the topology decision it depends on is tracked in the same place as the back-office-auth
decision.

## Finding 7 (catalog-wide, cross-cutting concern): cart continuity across login/logout is untested

The lens description names "authentication + session management" verbatim as a classic
cross-cutting concern that falls between discovery lenses. Concretely here: nothing in the catalog
checks whether a guest cart survives, merges, or is silently dropped/duplicated when a shopper logs
in mid-session — a standard PrestaShop behavior (merging the anonymous cart into the customer's
account on login) that sits exactly between the "Cart & Pricing Integrity" category (which already
has `add-to-cart-double-click-no-duplicate-line`, i.e., duplicate-line-item concerns are already a
recognized failure mode) and the "Session & Auth Boundaries" category (which already establishes,
via `csrf-token-stability-across-identity-change`, that login/logout identity transitions are
in-scope and storefront-reachable in principle). Both halves of this concern are independently
catalogued; their intersection is not.

**Suggested action:** A targeted discovery pass scoped specifically to "what happens to
cart/session state across a login or logout transition," reading the actual guest-cart-merge
mechanism before catalog ing.

## Finding 8 (lighter, catalog-wide): session/auth properties may be over-indexed relative to raw
bug density, though the catalog's own rationale is reasonable

Session & Auth Boundaries is the second-largest category by property count (6 of 23) against a
mid-low bug-density figure (permissions/auth: 17, well below pricing's 47 or display/UI's 36).
Cart & Pricing gets roughly 1 property per 5 bugs in its category (9/47); Session & Auth gets
roughly 1 property per 3 bugs (6/17) if measured the same way. This is not flagged as a strong
finding because the catalog's stated rationale — three of the six are confirmed first-hand findings
from `bugs.md` on this exact deployment, which is stronger evidence than density alone — is
explicit and reasonable, and security-boundary defects generally warrant more coverage per
incident than a cosmetic bug regardless of raw count. Recorded here so the synthesis step can weigh
it if it disagrees with that rationale.

## Finding 9 (lighter, catalog-wide): crash/fatal (33, third-largest category) coverage is thin
relative to size but has a stated design rationale

Only two properties (`malformed-identifier-params-degrade-to-4xx`,
`category-redirect-target-resolution-crashes-without-active-parent`) narrow the existing generic
`noPhpFatalErrorRendered`/`noHttpErrorCodes` baseline for this 33-issue category. `sut-analysis.md`
Focus 8 explicitly reasons about this: the generic baseline already catches *any* fatal error
anywhere, and narrow variants exist mainly to *localize* which action caused it, not to catch
strictly more failures. This is a stated, reasonable design choice rather than a silent gap — flagged
as lighter/informational because, unlike Findings 3-5, the catalog shows its work here.

## Passes

- Cart & Pricing Integrity (the largest bug-density category, 47) gets proportionate coverage: 9 of
  23 properties, matching the largest closed-bug category with the largest property cluster.
- Stock/quantity (23) is proportionately covered by two properties targeting a confirmed defect and
  its adversarial-input sibling.
- Multistore (22), webservice/import-export (21), and translation/locale (14) are explicitly and
  correctly scoped out with reasoning tied to this deployment's actual configuration (single-shop,
  no webservice, single language) rather than silently dropped — this is exactly the kind of
  explicit reasoning Findings 3 and 5 are asking for elsewhere.
- `property-relationships.md` already surfaces one legitimate overlap/triage question proactively
  (`cart-total-matches-displayed-line-items` vs. `quantity-stepper-double-click-no-race`) rather than
  requiring this evaluation to find it fresh — good self-awareness already baked into the catalog.
- No component blind spot at the topology level: all 23 properties are correctly observable from
  the `bombadil-client` → `prestashop` HTTP boundary, appropriate for a black-box browser workload;
  none wrongly assume `db`-level observability.

## Uncertainties

- Whether install/upgrade (34) and module-specific (27) — both large, both entirely absent from the
  catalog *and* from its gap-acknowledgment footer — are genuinely unreachable by a
  Bombadil-storefront-only workload (plausible: install/upgrade is a one-time setup-phase concern;
  modules are absent on a fresh install) or a genuine miss. Not independently verified against the
  running container in this pass.
- Whether display/UI's near-total absence (Finding 5) reflects Bombadil's structural inability to
  do visual diffing (a reasonable exclusion) or was simply not considered — the catalog doesn't say,
  so I can't distinguish the two without asking whoever ran discovery.
- Whether email (10, Focus 9 names it explicitly as out of reach for unauthenticated browsing) should
  also appear in the catalog's own gap-acknowledgment footer for consistency with how multistore/
  webservice/translation are handled there — likely a minor documentation inconsistency rather than
  a real gap, since Focus 9's reasoning is sound, but not something this pass can rule out entirely
  without knowing why the footer's list was curated the way it was.
