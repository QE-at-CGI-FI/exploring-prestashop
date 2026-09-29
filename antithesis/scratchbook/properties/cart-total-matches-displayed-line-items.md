---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/PrestaShop/PrestaShop/blob/develop/src/Core/Pricing/ARCHITECTURE.md
    why: PrestaShop's own team's spec doc for a pricing-system rewrite, cited here as first-party evidence (not a bug report) that the *currently-running* legacy pricing code is float-based and rounding-error-prone. Fetched via `gh api repos/PrestaShop/PrestaShop/contents/src/Core/Pricing/ARCHITECTURE.md`, develop branch, 2026-09-29.
  - path: closed-bugs-last-year.md
    why: "Calculation / pricing / tax" is the single largest closed-bug category (47) in the last 12 months; several titles describe exactly this failure class (e.g. #39514 "Rounding errors in product prices in the order confirmation email").
---

# cart-total-matches-displayed-line-items

## Lens

Data Integrity — is the displayed cart/order total ever inconsistent with the other numbers
rendered on the same page (line prices × quantities, shipping, discounts)? This is a generic
arithmetic self-consistency check, not tied to one specific bug report, but grounded in
first-party evidence that the mechanism which could violate it genuinely exists in the
currently-deployed code.

## What led to this property

`closed-bugs-last-year.md`'s "Calculation / pricing / tax" category is the largest in the dataset
(47 of 572 actively-closed bugs), and several entries describe exactly this class of problem:
rounding/total mismatches (#39514 "Rounding errors in product prices in the order confirmation
email", #35875 "Order tax is not updated when modifying order in backoffice", #38524 "Order
editing: Carrier change causes price issue"). Rather than validate any single one of these
headlines (most are BO-order-editing-specific and not directly Bombadil-reachable), I looked for
the *general mechanism* that would make a line-items-vs-total mismatch possible at all on the
storefront, per `validating-claims.md`'s discipline of grounding a property in a confirmed
mechanism rather than a title.

## The mechanism, confirmed from source

`src/Core/Pricing/ARCHITECTURE.md` — PrestaShop's own specification document for an in-progress
pricing-system rewrite — states directly, as the *motivation* for that rewrite:

> "PrestaShop's current pricing system suffers from: ... Float-based arithmetic causing rounding
> errors (~50 open bugs in 'Taxes and Prices') ... This spec defines a clean, composable,
> fully-tested pricing architecture ... that **replaces the legacy system behind a feature flag**."

This is first-party, non-bug-report evidence (the maintainers' own architecture doc) that:
1. The legacy pricing code — which is what runs unless the new architecture's feature flag is
   enabled — uses native float arithmetic, a well-known source of cent-level rounding
   discrepancies between a sum-of-parts and a total computed a different way.
2. This is significant enough that the team is rewriting the whole subsystem around it, and
   quantifies it at "~50 open bugs" in that one area.

Separately, `PS_ROUND_TYPE` (found via `gh api search/code` across `classes/Cart.php`,
`classes/PaymentModule.php`, `classes/order/OrderDetail.php`, `classes/Pack.php`, and others) is a
real, currently-relevant configuration option controlling whether rounding happens per-line
("Item") or once on the total ("Total") — the classic mechanism by which "sum of the displayed
line totals" and "the displayed grand total" can legitimately differ by a cent or few depending on
configuration, or illegitimately differ if a code path applies the wrong mode inconsistently
between rendering the lines and rendering the total.

I did not trace a specific code path that currently produces a *wrong* (as opposed to
merely rounding-mode-dependent) total on this project's default configuration — this property is
a **claimed-guarantee test** (the ordinary shopper expectation that the total is what it looks
like it should be, informed by confirmed evidence that the arithmetic substrate is fragile), not a
confirmed defect, per `validating-claims.md`'s distinction between the two.

## What goes wrong if this is violated

- The most directly financially-relevant version of "the cart total shown is what gets charged"
  (the #1 product-context priority in `sut-analysis.md`) — if the sum of what a shopper can see
  itemized doesn't match the total they're asked to pay, that's the sharpest possible instance of
  this guarantee failing, regardless of *which* internal mechanism caused it.
- This property is deliberately mechanism-agnostic on the checking side (pure DOM arithmetic) so
  it can catch rounding-mode bugs, cart-rule-interaction bugs (the existing
  `voucher-code-resubmit-not-double-applied` property's territory), and currency-conversion bugs
  alike, without needing a new property per mechanism.

## Property Catalog Entry

### cart-total-matches-displayed-line-items — The cart/checkout total always reconciles with its own displayed components

| | |
|---|---|
| **Type** | Safety |
| **Property** | On the cart page and checkout summary, the displayed grand total equals the sum of displayed line-item subtotals, shipping cost, and discounts (within a small, explicitly-bounded rounding tolerance, e.g. one currency-minor-unit per line), on every observed render, including after reload/back/forward navigation. |
| **Invariant** | `Always`. Extract all visible cart/order-summary line subtotals, the shipping line (if present), all discount/voucher line amounts (if present, as negative contributions), and the displayed grand total; assert `abs(total - (sum(line_subtotals) + shipping - sum(discounts))) <= tolerance`, where `tolerance` is a small fixed value calibrated to the currency's minor-unit precision times the number of lines (accounting for legitimate per-line vs. total rounding-mode differences, not hiding real mismatches). Evaluate on every cart/checkout-page observation Bombadil reaches, including post-navigation. |
| **Antithesis Angle** | This is a pure extraction-and-arithmetic check with no new action generators needed — it rides entirely on Bombadil's existing default exploration (add/remove products, change quantities, reload, back/forward) and turns every cart/checkout page load into a check instead of relying on a human to notice a wrong-looking total. Antithesis's scheduling exploration (rapid interleaved add/quantity-change/reload sequences) increases the odds of landing on whatever specific interleaving or rounding-mode edge case would otherwise only surface with a specific combination of currency, tax, and cart-rule state. |
| **Why It Matters** | Grounded in the PrestaShop team's own architecture document quantifying "~50 open bugs" in float-based pricing arithmetic as the explicit motivation for an in-progress rewrite — this is first-party confirmation that the mechanism for this class of bug exists in the currently-running (legacy, non-feature-flagged) pricing code, not merely a plausible-sounding hypothesis. `Calculation/pricing/tax` is the single largest closed-bug category (47) in `closed-bugs-last-year.md`. |

**Open Questions:**

- What tolerance correctly distinguishes "legitimate `PS_ROUND_TYPE` per-line rounding" from "a real mismatch"? Set too loose, real bugs are missed; too tight, normal rounding-mode behavior is flagged as a false positive. Needs calibration against a live cart page with a non-round unit price and the default `PS_ROUND_TYPE` setting of this deployment — not done in this pass. `(needs investigation against a live cart with non-round prices)`
- Is the new `src/Core/Pricing` architecture's feature flag enabled in this deployment, or is the legacy float-based system (the one the architecture doc describes as bug-prone) the one actually computing these totals? This determines whether this property is testing the system the architecture doc's own risk assessment applies to, or the newer, presumably-hardened replacement. Not checked against the live instance's feature-flag configuration in this pass. `(needs investigation against the live instance's Shop Parameters / feature flag configuration)`
- Does this overlap enough with the existing `quantity-stepper-double-click-no-race` property (which checks a narrower per-line `subtotal == quantity * unit_price` invariant) to be merged into one property with two assertions, or is the broader whole-total reconciliation distinct enough to keep separate? Left as a triage-time question rather than resolved here, since both properties were derived independently and target different (though related) parts of the same rendering. `(needs human input at triage)`
