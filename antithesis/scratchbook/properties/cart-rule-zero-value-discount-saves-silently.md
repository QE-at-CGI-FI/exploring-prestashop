---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/PrestaShop/PrestaShop/issues/38072
    why: "Cart rules register without discounts apply" — the confirmed-reproducing bug this property generalizes (per `sut-analysis.md` and `tests/regression-bugs.spec.js`, which reproduces it against this project's vendored image using the LEGACY admin cart-rule form).
  - path: https://github.com/PrestaShop/PrestaShop/blob/develop/controllers/admin/AdminCartRulesController.php
    why: The actual, currently-exercised (per `regression-bugs.spec.js`'s field-ID selectors) admin validation code for classic cart rules. Fetched via `gh api repos/PrestaShop/PrestaShop/contents/controllers/admin/AdminCartRulesController.php`, develop branch, 2026-09-29.
  - path: https://github.com/PrestaShop/PrestaShop/blob/develop/src/Adapter/Discount/Validate/DiscountValidator.php
    why: The newer, feature-flagged "Discount" domain's equivalent validator, checked for the same class of gap. Fetched the same way.
---

# cart-rule-zero-value-discount-saves-silently

## Lens

Data Integrity — constraint enforcement on stored state: can a cart rule/voucher be saved and
later applied to a shopper's cart in a way that claims to give a discount but doesn't, or does the
"discount applied" state ever diverge from an actual price change?

## What led to this property

`sut-analysis.md` already treats `#38072` as a confirmed, currently-reproducing defect (validated
in that document by reading `Product`/form-handling source, and independently confirmed again here
by reading the admin form's own validation code). The task brief for this pass specifically asks:
given this confirmed defect, "could a similar but slightly different condition bypass the fix" —
per `references/property-catalog.md`'s "Cross-Reference Closed Issues as Regression Targets".
There is no fix yet (the issue is open/reproducing, not closed), so I instead looked for **the
same validation gap recurring elsewhere in the codebase**, which is the same spirit of question.

## The mechanism, confirmed from source

`tests/regression-bugs.spec.js`'s `#38072` test drives the **legacy** admin cart-rule form
(selectors `#apply_discount_percent`, `#apply_discount_to_cheapest`, `#reduction_percent`), i.e.
`controllers/admin/AdminCartRulesController.php`, not the newer Symfony "Discount" domain. Its
`postProcess()` validation (lines ~138–253) contains exactly one check that could catch a no-op
discount:

```php
if (Tools::getValue('apply_discount') == 'off' && !Tools::getValue('free_shipping') && !Tools::getValue('free_gift')) {
    $this->errors[] = $this->trans('An action is required for this cart rule.', ...);
}
```

This only fires when `apply_discount` (the "Apply a discount" toggle) is `'off'` entirely. It does
**not** fire when `apply_discount` is turned on (`'percent'` or `'amount'`) but the actual
reduction value is left at its default of `0`. The two adjacent numeric-range checks don't catch
it either, because `0` is a valid value for both:

```php
if ((float) Tools::getValue('reduction_percent') < 0 || (float) Tools::getValue('reduction_percent') > 100) { ... }
if ((int) Tools::getValue('reduction_amount') < 0) { ... }
```

`0` satisfies `0 >= 0 && 0 <= 100` and `0 >= 0` respectively — no error. This is the precise,
file:line mechanism behind `#38072`, confirmed against the exact controller the project's own
regression test exercises (not the description in the GitHub issue, and not a different,
newer subsystem). The same gap applies identically to `apply_discount == 'amount'` left at
`reduction_amount = 0` — the originally-reported case only exercised the percent variant, but the
amount variant has the identical hole, which is the "similar but slightly different condition"
the task asked to look for.

**Secondary finding (lower confidence, different subsystem):** PrestaShop also has a newer,
feature-flagged "Discount" domain (`src/Adapter/Discount/Validate/DiscountValidator.php`,
`DiscountValidator::validateDiscountPropertiesForType()`) that still operates on the same
underlying `CartRule` object model. Its `PRODUCT_LEVEL` case explicitly requires a value:

```php
if (!$hasReductionAmount && !$hasReductionPercent) {
    throw new DiscountConstraintException('Product discount must have a discount value (amount or percent).', ...);
}
```

but its `CART_LEVEL` and `ORDER_LEVEL` cases have no equivalent check — only "not both amount and
percent" and "not negative/over-100 if present." So even in the newer system, a cart-level or
order-level discount with everything left at zero passes validation. This is an unforced
inconsistency within a single validator (one discount type enforces "must have a value", two
adjacent ones don't) rather than a confirmed exercised path in this deployment — see Open
Questions.

## What goes wrong if this is violated

- A merchant creates what they believe is an active promotional code (e.g. copy-pastes a
  cart-rule form, forgets to fill in the percent/amount field) and it saves with no server-side
  warning.
- A shopper who has that code applied to their cart sees "voucher applied" / a discount line item
  in the cart summary, but the actual charged total is unchanged — a direct violation of the
  product-context guarantee in `sut-analysis.md` ("the cart total / price shown is what gets
  charged") in the opposite direction from a double-discount bug: the *absence* of an expected
  discount is silently presented as its presence.

## Property Catalog Entry

### cart-rule-zero-value-discount-saves-silently — Saving a cart rule with a discount type selected but no discount value is rejected, not silently accepted

| | |
|---|---|
| **Type** | Safety |
| **Property** | The back office never persists a cart rule/discount whose selected discount type (percent or amount) has an actual magnitude of zero, without surfacing a validation error to the admin user. |
| **Invariant** | `Always`. On submitting the admin cart-rule creation/edit form with a discount type selected (not "off") and its corresponding value field left at/set to `0`, assert the response shows a validation error (e.g. text matching "action is required" / a discount-specific error) and does *not* show the success confirmation ("successful creation"/"successfully created" — the same text `tests/regression-bugs.spec.js`'s `#38072` test currently asserts *is* shown, which is the bug). |
| **Antithesis Angle** | This is a narrow, deterministic input-validation gap rather than a timing/interleaving one — Antithesis's value here is less about fault injection and more about being a permanent, continuously-checked regression guard once the Bombadil (or an admin-focused) workload can drive this form, catching both the originally-reported percent variant and the untested amount variant from the same assertion. |
| **Why It Matters** | Directly extends the confirmed, currently-reproducing `#38072` defect already recorded in `sut-analysis.md`, generalizing it from "percent left at 0" to the structurally identical "amount left at 0" case, and locates the exact two-line validation gap (`AdminCartRulesController.php`'s `postProcess()`) rather than relying on the issue's own description. `cart_rules/discounts` is a small raw closed-bug category (7) but `sut-analysis.md` already weights it higher because of this confirmed, currently-reproducing defect. |

**Open Questions:**

- This property requires the authenticated back office (`/admin-dev/`), which the current Bombadil configuration never drives (it operates as an anonymous storefront visitor only). This is the same catalog-wide gap `sut-analysis.md` already flags for `employee-creation-no-crash-on-race` — whether to extend the workload to log in and drive `/admin-dev/`, or keep this catalogued as aspirational until that decision is made. `(needs human input)`
- Is the newer, feature-flagged "Discount" domain (`DiscountValidator`) actually enabled in this deployment's default configuration, or is the legacy `AdminCartRulesController` form (confirmed exercised by `regression-bugs.spec.js`) the only one reachable today? If the new system is/becomes the active one, the `CART_LEVEL`/`ORDER_LEVEL` gap found in `DiscountValidator::validateDiscountPropertiesForType()` is the more relevant mechanism to assert against, and the property's antithesis angle should target that form instead/in addition. Not checked against the running instance's active feature flags in this pass. `(needs investigation against the live instance's Shop Parameters / feature flag configuration)`
- Does the storefront ever actually render a "voucher applied" state for a zero-value cart rule in a way Bombadil could observe without back-office access (e.g., if such a cart rule already exists in seed/fixture data with a known code)? If so, a second, storefront-only property ("applying voucher code X never changes the displayed total, and the UI never claims otherwise") could be written without needing the admin workload extension. Not checked against this project's fixture data in this pass. `(needs investigation against the vendored image's demo cart rules)`
