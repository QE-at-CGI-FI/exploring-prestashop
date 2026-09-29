---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/prestashop/prestashop
    why: Source of the mechanism-level confirmations that let these clusters be drawn from actual shared code paths rather than superficial topic similarity.
  - path: bugs.md
    why: See property-catalog.md.
  - path: closed-bugs-last-year.md
    why: See property-catalog.md.
  - path: tests/regression-bugs.spec.js
    why: See property-catalog.md.
  - path: sessions/session1.md
    why: See property-catalog.md.
  - path: sessions/session2.md
    why: See property-catalog.md.
---

# Property Relationships

Lightweight clustering pass over the 23 properties in `property-catalog.md`. Flags connections
noticed during synthesis — not a deep re-analysis.

## Cluster: "Submit-before-async-resolves" ordering defect family

**Members:** `employee-creation-no-crash-on-race`, `category-redirect-target-resolution-crashes-without-active-parent`, `delivery-option-stale-at-payment-confirm`, `address-form-stale-country-response`

These four were found by three different lenses (Lifecycle Transitions found the first and third;
Protocol Contracts found the second independently; Lifecycle Transitions also found the fourth)
converging on the same architectural pattern: **a typed/legacy boundary trusts that a preceding
async call already completed, and nothing enforces the ordering.**

- `employee-creation-no-crash-on-race` and `category-redirect-target-resolution-crashes-without-active-parent`
  are the *same failure shape* in different subsystems: a non-nullable typed parameter/return
  receives (or would receive) `null` because an upstream value wasn't populated, causing an
  uncaught PHP `TypeError`. Neither dominates the other — they're independent instances of one
  pattern, not duplicates, and both should stay in the catalog as separate properties (different
  code, different trigger).
- `delivery-option-stale-at-payment-confirm` is the same family (an unconfirmed-async-write raced
  against a later action that trusts it), but the failure mode is different — silent stale data
  read, not a crash. This is the "quiet" sibling of the crash-shaped pair above.
- `address-form-stale-country-response` was investigated as a candidate fifth member of this
  family and turned out **not** to be one — the form is explicitly guarded (disabled submit +
  full-replace-on-success) against exactly the crash shape. It's grouped here anyway because it's
  the negative-result sibling: the pattern search that found the other three also ruled this one
  out, and keeping it adjacent documents that the pattern does *not* uniformly repeat across
  PrestaShop's dependent-dropdown forms — useful context for anyone extending this search later.

**Suspected dominance:** None of the four subsumes another — different code paths, different
failure modes (crash vs. stale-data vs. guarded-safe). Resolving the back-office-auth blocker
(catalog-wide open question) unlocks 2 of these 4 (`employee-creation-no-crash-on-race` is
back-office; the other three are storefront-reachable today, modulo funnel depth).

## Cluster: "Reload/back/forward as a free fuzzer"

**Members:** `cart-state-survives-history-navigation`, `checkout-step-state-consistent-after-navigation`, `order-message-lost-on-premature-reload`, `quantity-stepper-double-click-no-race` (partial member — its reload check is one facet of a broader property)

All four ride Bombadil's existing default `reload`/`back`/`forward` action generators with zero
new workload machinery — the shared insight (flagged independently by the Wildcard focus in SUT
discovery and by the Idempotency/Replay property-discovery lens) is that these actions are *already
happening* in every Bombadil run; the only missing piece was a property that actually checks state
across the navigation boundary rather than only within a single page load.

**Suspected dominance:** `cart-state-survives-history-navigation` is the broadest of the four
(general cart/checkout state vs. a fresh re-fetch); `checkout-step-state-consistent-after-navigation`
is a checkout-specific instance of the same principle applied to step/button state rather than
cart values. They likely share a root cause if either fails (both stem from PrestaShop's lack of
explicit bfcache handling on these routes) but check different observable surfaces, so both stay
in the catalog. `order-message-lost-on-premature-reload` is architecturally the same "reload
discards unsaved state" shape but in the back office, not the storefront, and is independently
blocked on the auth question rather than on any technical dependency between the properties.

## Cluster: "Cart total / pricing correctness"

**Members:** `cart-total-matches-displayed-line-items`, `quantity-stepper-double-click-no-race`, `add-to-cart-double-click-no-duplicate-line`, `extreme-quantity-input-does-not-corrupt-cart`, `cart-quantity-can-exceed-stock-via-update-path`, `price-formatting-consistent-across-pages`

The largest cluster, matching the largest closed-bug category (calculation/pricing/tax, 47
issues). `cart-total-matches-displayed-line-items` is the broadest, mechanism-agnostic net
(catches rounding, discount-interaction, and currency issues alike); the other five are narrower,
mechanism-specific checks that each target one way the broad invariant could break (a race
producing a duplicate line, a race producing a wrong per-line subtotal, an out-of-bound quantity,
a confirmed server-side stock-guard bypass, an internal formatting inconsistency independent of
the arithmetic itself).

**Suspected dominance:** `cart-total-matches-displayed-line-items` and
`quantity-stepper-double-click-no-race` overlap partially — both check
`subtotal == unit_price × quantity`-shaped arithmetic — but the former checks the *grand* total
end-to-end (including shipping and discounts) while the latter checks it *per line* specifically
under a double-click race. This is an unresolved triage question already flagged in the catalog
entries for both properties, not resolved here — a future pass should decide whether to merge them
or keep the per-line race check as a targeted sub-case. `cart-quantity-can-exceed-stock-via-update-path`
does not dominate `extreme-quantity-input-does-not-corrupt-cart` despite sharing an input surface:
one is a confirmed defect on the *ordinary* over-limit case, the other targets *adversarial* input
values (negative, huge, non-numeric) that the confirmed defect's fix might not even touch.

## Cluster: "Cart-rule / discount validation gaps"

**Members:** `cart-rule-zero-value-discount-saves-silently`, `voucher-code-resubmit-not-double-applied`

Both target cart-rule validation logic specifically, but at different points: the first is a
back-office *authoring*-time validation gap (a rule with no real effect saves anyway); the second
is a storefront *application*-time gap (a rule might apply twice). No dominance — independent
failure points in the same feature area. Confidence differs sharply: the first is a confirmed,
currently-reproducing defect; the second is an unvalidated hypothesis pending a retried source
lookup (see catalog-wide open questions).

## Cluster: "Session / cookie mechanics"

**Members:** `session-cookie-lifetime-bounded`, `duplicate-session-cookie-single-write`, `session-cookie-secure-flag-matches-transport`

All three examine the same code area (`classes/Cookie.php` and `config/config.inc.php`'s session
setup) from different angles: lifetime arithmetic, write-count consistency, and the `Secure`
attribute's correctness relative to transport. No dominance — three independent mechanisms in
adjacent code, one of them (`session-cookie-lifetime-bounded`) a confirmed unit-mismatch defect,
the other two regression guards against currently-correct (or currently-observed-but-unexplained)
behavior.

## Cluster: "Auth boundary"

**Members:** `admin-surface-rejects-anonymous-access`, `weak-admin-credentials-blocked-on-auth`, `csrf-token-stability-across-identity-change`

Three different facets of the trust boundary between anonymous storefront visitor and
authenticated back office: whether anonymous requests are rejected (confirmed currently correct),
whether the default credentials force a reset (confirmed currently *not* enforced — a real gap),
and whether identity changes mid-session are handled safely (mechanism confirmed, reachability
fully blocked on login). `weak-admin-credentials-blocked-on-auth` is the highest-value member —
it's the only one of the three describing a currently-open gap rather than a regression guard on
already-correct behavior.

## Cluster: "AJAX / HTTP contract fidelity"

**Members:** `cart-ajax-success-flag-decoupled-from-errors`, `malformed-identifier-params-degrade-to-4xx`, `category-redirect-target-resolution-crashes-without-active-parent`

All narrow, mechanism-specific strengthenings of the existing generic `noPhpFatalErrorRendered`
and HTTP-4xx/5xx baseline properties — each gives Antithesis a sharper, self-diagnosing target
than "some fatal error happened somewhere in this run." `category-redirect-target-resolution-crashes-without-active-parent`
is cross-listed in the "submit-before-async-resolves" cluster above (same underlying typed-null
pattern) but is grouped here too because its *observable signature* (a malformed-request-shaped
crash) is protocol-contract-flavored, not ordering-flavored, from the outside.

## Unclustered

`price-formatting-consistent-across-pages` and `extreme-quantity-input-does-not-corrupt-cart` are
cross-listed in the pricing cluster above but originated from the Wildcard pass specifically
because no single assigned lens's "look for" list would have produced them — noted here so a
future re-evaluation doesn't miss that provenance.
