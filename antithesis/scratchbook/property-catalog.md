---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/prestashop/prestashop
    why: No local copy of the PrestaShop source exists in this repo; every property below that claims a specific mechanism was validated by reading the actual `develop`-branch source (via `gh api`) before being catalogued, per references/validating-claims.md. Version-drift caveat applies — see sut-analysis.md.
  - path: bugs.md
    why: First-pass manual exploratory testing findings on a fresh install; primary evidence for several properties (cookie/session findings, default-credential finding).
  - path: closed-bugs-last-year.md
    why: Bug-density map used to prioritize discovery toward calculation/pricing/tax (47), stock/quantity (23), and cart rules/discounts (7).
  - path: tests/regression-bugs.spec.js
    why: Confirms #38072 (cart rule 0% discount) currently reproduces on this install; source for the confirmed employee-creation crash and the order-message regression lead.
  - path: sessions/session1.md
    why: Exploratory testing session notes.
  - path: sessions/session2.md
    why: Exploratory testing session notes; proposed this exact exercise.
---

# Property Catalog — PrestaShop storefront (Bombadil)

23 properties across 4 categories. All validated per `references/validating-claims.md` — every
property built on a bug report or GitHub issue cites the primary evidence that confirms it's a
real system defect, not just the report's headline; every claimed guarantee is stated as a claim
to test, not a verified fact.

**Reachability key**, used throughout because this is a black-box browser workload with a specific
current configuration (Bombadil drives only the anonymous storefront — see `sut-analysis.md`):

- ✅ **Checkable today** — the current `bombadil/specification.ts` default action generators can
  reach the scenario as-is, or with only a straightforward addition to the property's own
  `extract()`/`always()` logic.
- 🔧 **Needs workload extension** — reachable without authentication, but needs new action
  generators or seed data (e.g. a URL frontier entry, a pre-seeded cart rule, adversarial fill
  values) beyond the current defaults.
- 🔒 **Blocked on back-office auth** — not reachable at all until Bombadil is extended to log in
  and drive `/admin-dev/`. This is a single open decision (see Open Questions, catalog-wide,
  below) that blocks 5 of the 23 properties identically — resolving it once unblocks all five.

## Category: Cart & Pricing Integrity

The largest category, weighted toward `closed-bugs-last-year.md`'s largest bug class
(calculation/pricing/tax, 47 issues) and its cart-rules/discounts class (7 issues, structurally
overlapping). Covers whether the cart total shown is ever wrong, stale, or inconsistent with
itself across renderings, navigation, or repeated actions.

### cart-quantity-can-exceed-stock-via-update-path — Cart quantity update path bypasses the stock guard

| | |
|---|---|
| **Type** | Safety |
| **Property** | Whenever the storefront displays an availability-limit error ("You can only buy N '\<product\>'"), that product's actual in-cart quantity never exceeds N, immediately or after reload. |
| **Invariant** | `Always` — extract (error's parsed N, product's displayed cart-line quantity) pairs; assert quantity ≤ N whenever the error is visible. |
| **Antithesis Angle** | Rides Bombadil's existing click+reload generators on the cart page's quantity control — no new action generators needed. |
| **Why It Matters** | **Confirmed source-level defect**, not a bug-report guess: `CartController::processChangeProductInCart()` only runs its pre-write stock guard (`shouldAvailabilityErrorBeRaised`) for `add` mode. For `update` mode (adjusting an already-in-cart line's quantity) it calls `Cart::updateQty(..., skipAvailabilityCheckOutOfStock: true)` — explicitly disabling the internal guard — then only *afterward* shows an error, without reverting the already-committed DB write. Directly contradicts the "can't order past stock" guarantee named in `sut-analysis.md`. |

**Priority:** High. **Reachability:** ✅ Checkable today.

**Open Questions:**

- Does a later checkout-step re-check reliably block payment on the resulting over-stock state? `(partial: confirmed areProductsAvailable() exists and runs post-update; not confirmed it's on every path to payment)`
- Which exact DOM control sends `update=1` on the cart page? `(needs investigation — inferred from server logic, not confirmed against theme JS/templates)`

Evidence: `properties/cart-quantity-can-exceed-stock-via-update-path.md`

---

### cart-rule-zero-value-discount-saves-silently — Cart rule with a zero-value discount saves without validation

| | |
|---|---|
| **Type** | Safety |
| **Property** | The back office never persists a cart rule with a discount type selected but a zero-magnitude value, without a validation error. |
| **Invariant** | `Always` — submitting the admin cart-rule form with discount type ≠ "off" and value = 0 must show a validation error, not the success message. |
| **Antithesis Angle** | A configuration/validation-gap property, not a timing race — Antithesis's value is in reliably constructing and submitting the specific "type selected, value 0" form state across the admin cart-rule form's several variants (percent, fixed amount, Discount v2). |
| **Why It Matters** | **Confirmed, currently-reproducing** on this install (`tests/regression-bugs.spec.js` #38072). Generalizes it: the exact two-line gap in `AdminCartRulesController.php::postProcess()` — the "action is required" check only fires when `apply_discount == 'off'`, never when a type is selected but its value is 0 — applies identically to the untested `reduction_amount` (fixed-amount) variant, not just the originally-reported percent variant. A secondary, lower-confidence finding: the newer "Discount v2" domain (`DiscountValidator.php`) has an analogous asymmetry (`PRODUCT_LEVEL` requires a value, `CART_LEVEL`/`ORDER_LEVEL` don't). |

**Priority:** High (confirmed defect; already has a partial regression test). **Reachability:** 🔒 Blocked on back-office auth.

**Open Questions:**

- Whether Discount v2 is the active system in this deployment is unconfirmed. `(needs investigation)`
- Whether a storefront-only variant could be checked if a zero-value cart rule already exists in seed data, avoiding the back-office-auth block entirely. `(needs investigation)`

Evidence: `properties/cart-rule-zero-value-discount-saves-silently.md`

---

### cart-total-matches-displayed-line-items — Cart/checkout total always equals the sum of its parts

| | |
|---|---|
| **Type** | Safety |
| **Property** | On cart/checkout pages, displayed grand total = sum(line subtotals) + shipping − discounts, within a small rounding tolerance, on every render including post-navigation. |
| **Invariant** | `Always` — pure DOM extraction and arithmetic, no login or special setup needed. |
| **Antithesis Angle** | A mechanism-agnostic net: catches rounding, cart-rule-interaction, and currency-conversion total mismatches alike, without needing a separate property per mechanism. |
| **Why It Matters** | PrestaShop's own `src/Core/Pricing/ARCHITECTURE.md` states its legacy pricing system has "float-based arithmetic causing rounding errors (~50 open bugs in 'Taxes and Prices')" — the maintainers' own admission, not a bug-report guess, and the direct motivation for their in-progress rewrite. Calculation/pricing/tax is the largest closed-bug category (47). |

**Priority:** High. **Reachability:** ✅ Checkable today.

**Open Questions:**

- Correct rounding tolerance needs calibration against a live run. `(needs investigation)`
- Whether the new Pricing architecture's feature flag is active in this deployment. `(needs investigation)`
- Possible overlap with `quantity-stepper-double-click-no-race` — flagged as a triage question, not yet resolved.

Evidence: `properties/cart-total-matches-displayed-line-items.md`

---

### add-to-cart-double-click-no-duplicate-line — Double-clicking add-to-cart never duplicates a line item

| | |
|---|---|
| **Type** | Safety |
| **Property** | Rapid/repeated add-to-cart clicks for the same product+combination never produce more than one line item for that product in the cart. |
| **Invariant** | `Always` — map product-id → count of distinct cart-row DOM elements; every count must be 1. |
| **Antithesis Angle** | Bombadil's default click generator already fires repeat clicks; Antithesis timing exploration increases the odds of two concurrent add-to-cart AJAX requests racing on the server-side read-modify-write. |
| **Why It Matters** | A duplicate line is a direct pricing/checkout correctness bug; sits at the intersection of the stock/quantity (23) and pricing (47) closed-bug clusters. |

**Priority:** Medium. **Reachability:** ✅ Checkable today.

**Open Questions:**

- Whether the server-side cart-line read-modify-write is atomic is unconfirmed (GitHub source read for this specific mechanism was blocked by a shared API rate limit during discovery — mechanically resolvable on retry, not a human-judgment question). `(needs investigation)`

Evidence: `properties/add-to-cart-double-click-no-duplicate-line.md`

---

### quantity-stepper-double-click-no-race — Cart quantity stepper stays arithmetically consistent under rapid clicks

| | |
|---|---|
| **Type** | Safety |
| **Property** | After rapid clicks on a cart line's +/- stepper, displayed quantity is non-negative and subtotal == unit_price × quantity, both immediately after and after reload. |
| **Invariant** | `Always` — per-line extract of (quantity, unit_price, subtotal); check arithmetic and non-negativity on every observation, including post-reload. |
| **Antithesis Angle** | Default click + reload generators already produce this pattern; extends the existing `cartBadgeCountIsNonNegative` property to per-line price consistency, explicitly across a reload boundary the existing property never checks. |
| **Why It Matters** | Intersection of stock/quantity (23) and pricing/tax (47) closed-bug categories — financial correctness, not cosmetic. |

**Priority:** Medium. **Reachability:** ✅ Checkable today.

**Open Questions:**

- Rounding/tax tolerance for the equality check is unresolved. `(needs investigation)`
- Whether the client-side update is optimistic-before-server-confirm is unconfirmed (determines whether pre-reload staleness is even observable). `(needs investigation)`

Evidence: `properties/quantity-stepper-double-click-no-race.md`

---

### cart-state-survives-history-navigation — Cart state agrees with a fresh re-fetch after any navigation

| | |
|---|---|
| **Type** | Safety |
| **Property** | After any cart-state-changing action, values shown after reload/back/forward always agree with a fresh explicit re-fetch of the same page — no navigation path shows pre-change state. |
| **Invariant** | `Always` — extend the existing badge/modal extractors with a third comparison point captured right after a back/forward/reload action, vs. an explicit same-page re-fetch. |
| **Antithesis Angle** | Zero new workload machinery — reload/back/forward are already default Bombadil generators; this is the highest-leverage property in the whole catalog by that measure. |
| **Why It Matters** | Directly named as a gap in `sut-analysis.md`'s Wildcard and Unproven Assumptions sections — "both queries currently agree" (badge vs. modal) is never checked across a navigation boundary. Covers both "reload after POST" and "back/forward through checkout" in one property. |

**Priority:** High (best cost/value ratio in the catalog). **Reachability:** ✅ Checkable today.

**Open Questions:**

- Whether PrestaShop already defeats bfcache on cart/checkout routes (would narrow which sub-scenario is actually live). `(needs investigation)`
- How far anonymous/guest checkout can currently be driven by the default fill/click generators. `(needs investigation)`

Evidence: `properties/cart-state-survives-history-navigation.md`

---

### voucher-code-resubmit-not-double-applied — Resubmitting a voucher code never doubles the discount

| | |
|---|---|
| **Type** | Safety |
| **Property** | Resubmitting the same voucher/cart-rule code in immediate succession never doubles the applied discount or lists the rule twice. |
| **Invariant** | `AlwaysOrUnreachable` — voucher application is workload-dependent (no seeded cart rule currently); whenever a discount is present, assert no rule name appears twice and the reduction never exceeds one application's worth. |
| **Antithesis Angle** | Exercises cart-rule (re-)validation logic under rapid double-submit / back-forward resubmission — timing Bombadil already produces. |
| **Why It Matters** | `closed-bugs-last-year.md`'s cart-rules category includes issues whose titles describe validity-checking logic bugs (#19393, #40116, #36982) — **cited as a bug-density signal only; titles were not read further, not validated mechanisms.** The sibling Data Integrity lens separately read `CartRule::checkValidity()`/`autoRemoveFromCart()` in full for a related question (`#36982` specifically) and found that mechanism correctly engineered — so this property's premise (a *different* validity check, on resubmission specifically) remains unvalidated, not refuted. |

**Priority:** Low-medium — explicitly flagged as unvalidated (GitHub search blocked by a shared rate limit) and requires a workload change (seed an active cart rule) to become reachable at all. **Reachability:** 🔧 Needs workload extension (seed a cart rule).

**Open Questions:**

- The core premise is unvalidated against source — retry the `gh api search/code` lookup before trusting this property. `(needs investigation)`
- Needs a seeded active cart rule in the workload setup. `(needs human input — workload/fixture decision)`

Evidence: `properties/voucher-code-resubmit-not-double-applied.md`

---

### price-formatting-consistent-across-pages — Price formatting is internally consistent

| | |
|---|---|
| **Type** | Safety |
| **Property** | Across all storefront pages, every rendered price string uses the same currency symbol, symbol position, decimal separator, and thousands separator as every other price string, for the currency active during that session. |
| **Invariant** | `Always` — extract every price-shaped string from the rendered DOM on each page; parse (symbol, position, decimal separator); assert identical tuples across all pages seen so far. |
| **Antithesis Angle** | A rendering-consistency property, not a timing property. Value comes from page/code-path breadth — a discount amount rendered via a different code path than list prices is a plausible drift point. |
| **Why It Matters** | Confirmed, first-hand locale inconsistency already observed on this exact deployment (`bugs.md` #14: UK country, EUR currency). Ties directly to the "displayed price is the charged price" guarantee. |

**Priority:** Medium. **Reachability:** ✅ Checkable today.

**Open Questions:**

- Should the invariant compare against PrestaShop's own authoritative `Currency` format config, or stay purely self-referential (all prices agree with each other)? The latter is weaker but needs no further source work. `(needs human input — design choice)`

Evidence: `properties/price-formatting-consistent-across-pages.md`

---

### extreme-quantity-input-does-not-corrupt-cart — Extreme quantity input degrades safely

| | |
|---|---|
| **Type** | Safety |
| **Property** | Typing an extreme value into the cart quantity field (very large integer, negative number, decimal, or non-numeric string) and submitting it never produces a negative or nonsensical cart quantity/total, and never renders a fatal error. |
| **Invariant** | `Always` — after any quantity-field submission, assert the result is a non-negative integer within a sane bound and `subtotal == unit_price × quantity` still holds. |
| **Antithesis Angle** | Input-space exploration, not timing. Needs a small extension to Bombadil's `fill` generator to occasionally emit adversarial numeric values — organic fill output likely stays "normal-looking." |
| **Why It Matters** | Direct sibling of the confirmed `cart-quantity-can-exceed-stock-via-update-path` defect on the same input surface; unvalidated numeric input is a classic source of negative/overflowed totals. |

**Priority:** Medium. **Reachability:** 🔧 Needs workload extension (adversarial fill values).

**Open Questions:**

- Does the quantity `<input>` have an HTML-level `type="number"`/`max` constraint that already blocks some values client-side? `(needs investigation)`
- Confirm the actual server-side validation path (likely the same `CartController::processChangeProductInCart()` already read for the sibling defect). `(needs investigation)`

Evidence: `properties/extreme-quantity-input-does-not-corrupt-cart.md`

## Category: HTTP/AJAX Contract Correctness

Whether the storefront's HTTP-level and AJAX-response contracts hold under edge-case input —
narrower, more actionable variants of the existing generic `noPhpFatalErrorRendered` catch-all.

### cart-ajax-success-flag-decoupled-from-errors — Cart AJAX can report success while carrying an error

| | |
|---|---|
| **Type** | Safety |
| **Property** | The cart-controller AJAX responses never report `success: true` while also carrying a non-empty error message the client would otherwise show. |
| **Invariant** | `Always` — parse every JSON body from `controller=cart` AJAX actions; assert `!(success===true && errors is non-empty)` and `!(success===true && productUrl===false)`. |
| **Antithesis Angle** | No new action generator needed — Bombadil's existing qty +/- fuzzing already lands on `qty=0`; value is in exhausting the ways to land in the silently-dropped error path. |
| **Why It Matters** | **Confirmed, source-level defect on both sides.** `CartController.php::processChangeProductInCart()` appends errors to `updateOperationError` (not `errors`) in update mode with no early return after the `qty==0` check; `displayAjaxUpdate()` branches success/error purely on `$this->errors`, so `success:true` ships alongside a populated (but differently-named) error string. Confirmed on the consuming side too: `themes/_core/js/cart.js` only checks `resp.hasError` (never set on this path) — the error is silently dropped, not just mislabeled. A second, lower-confidence instance of the same anti-pattern exists in the `@deprecated` `displayAjaxProductRefresh()`. |

**Priority:** High. **Reachability:** ✅ Checkable today.

**Open Questions:**

- Reachability of the deprecated `displayAjaxProductRefresh()` path via current routing is unconfirmed. `(needs investigation)`

Evidence: `properties/cart-ajax-success-flag-decoupled-from-errors.md`

---

### malformed-identifier-params-degrade-to-4xx — Malformed product/category IDs always degrade gracefully

| | |
|---|---|
| **Type** | Safety (regression guard) |
| **Property** | Requesting a product/category page with a malformed/edge-case numeric ID always yields a well-formed 4xx (or configured redirect), never a 500, and a 200 never renders a mismatched entity. |
| **Invariant** | `Always` — on every product/category navigation, assert status ∈ {200-with-matching-id, 301, 302, 404, 410}, never 5xx. |
| **Antithesis Angle** | Needs a URL-parameter mutator layered on navigation (array-notation injection, scientific/hex notation, out-of-range ints) — real DOM links never contain malformed IDs, so organic exploration won't reach this without a workload extension. |
| **Why It Matters** | The historical instance (`#33306`, product id=0 → 500) is **confirmed already fixed** (`ProductController::init()` now casts-then-gates before construction) — this property exists because that fix pattern isn't applied uniformly. `CategoryController` uses construct-then-check instead, and the confirmed employee-creation crash shows this inconsistency is a recurring, real defect source in this codebase. |

**Priority:** Medium (simple cases already confirmed safe; value is in the untested edge classes and as a standing regression guard). **Reachability:** ✅ Checkable today for simple cases (id=0/negative/non-numeric); 🔧 needs a URL mutator for array-injection/out-of-range edge classes.

**Open Questions:**

- Array-notation injection and out-of-range-int classes were reasoned about from PHP casting semantics, not probed against a live instance. `(needs investigation)`

Evidence: `properties/malformed-identifier-params-degrade-to-4xx.md`

---

### category-redirect-target-resolution-crashes-without-active-parent — Disabled-category redirect can crash with no active parent

| | |
|---|---|
| **Type** | Safety |
| **Property** | Visiting a disabled category configured for permanent/temporary auto-redirect never crashes with an uncaught `TypeError` when no active ancestor exists to redirect to. |
| **Invariant** | `Always`, worded narrowly and distinctly from the generic fatal-error catch-all so Antithesis attributes failures specifically to category-redirect resolution. |
| **Antithesis Angle** | Not timing-dependent — a state/config-dependent bug. Value is in confirming reproduction against the actually-running container and acting as an ongoing regression guard. |
| **Why It Matters** | A genuinely **new bug found by this pass**, not from any bug report: `CategoryController::getCategoryToRedirectTo(): int` (`controllers/front/listing/CategoryController.php:369-386`) returns `null` when no active, non-self parent exists — true for a parentless/root category — and returning `null` from a non-nullable `int`-typed method is an uncaught `TypeError` in PHP 8. Structurally the same defect shape as the confirmed employee-creation crash (typed boundary meets an uncovered null case), independently discovered in a different subsystem — a real recurring pattern, not a coincidence. |

**Priority:** Medium-high (high-confidence mechanism; needs a specific admin-configured state to trigger). **Reachability:** 🔧 Needs workload extension (seed a disabled, parentless category configured for redirect).

**Open Questions:**

- Not live-tested against the running container — mechanism confirmed from source only. `(needs investigation)`

Evidence: `properties/category-redirect-target-resolution-crashes-without-active-parent.md`

## Category: Checkout & Form Lifecycle Ordering

Forms and flows with an implicit dependency-ordering assumption: submission assumes a
preceding async call (a dropdown repopulation, an address/delivery recompute) has already
finished. The confirmed employee-creation crash is the seed instance of this pattern; this
category is that pattern generalized and searched for elsewhere.

### employee-creation-no-crash-on-race — Employee creation never crashes on a form/AJAX race

| | |
|---|---|
| **Type** | Safety |
| **Property** | Submitting the add-employee form never produces an uncaught server error; a missing/stale `default_page` value surfaces as a validation error instead. |
| **Invariant** | `Always` — never HTTP 5xx / fatal-error text on any add-employee submission. |
| **Antithesis Angle** | Network-fault injection on `GET /employees/tabs` (the profile-scoped AJAX call) widens the submit-before-AJAX-resolves window that triggers this today by luck/speed alone. |
| **Why It Matters** | **Fully confirmed, root-cause-traced defect** (see `sut-analysis.md`): `AddEmployeeCommand::__construct()` takes `$defaultPageId` with no type hint and no cast — unlike the *edit* path (`EmployeeFormDataHandler`), which explicitly casts `(int) $data['default_page']`. A stale/empty AJAX-populated dropdown flows uncast into `AbstractEmployeeHandler::assertHomepageIsAccessible(int $tabId, ...)`, a non-nullable parameter — producing an uncaught `TypeError` (HTTP 500) instead of a validation error. Found incidentally while building this project's own Playwright regression suite; not filed upstream. The confirmed root-cause note also checked the AJAX endpoint itself (`EmployeeController::getAccessibleTabsAction`) and found it already hardened — the defect is specifically in the command's missing cast, not the endpoint. |

**Priority:** High. **Reachability:** 🔒 Blocked on back-office auth.

**Open Questions:** None outstanding on the mechanism — fully validated. Reachability is the only blocker, tracked catalog-wide below.

Evidence: `properties/employee-creation-no-crash-on-race.md`

---

### address-form-stale-country-response — Address form never renders a stale country's fields

| | |
|---|---|
| **Type** | Safety |
| **Property** | The address form's rendered country-specific fields always match the currently-selected country — never a stale field set from a slower, earlier country-change request. |
| **Invariant** | `Always` — rendered form's country marker equals the `<select>`'s current value after any settling period. |
| **Antithesis Angle** | An out-of-order-response race between two concurrent `$.post` calls; Antithesis's asymmetric-latency/reorder fault injection is the natural tool to widen this window. |
| **Why It Matters** | Silent wrong-country field semantics (e.g. a bad state/ZIP pairing) could be saved without any visible error. **Notable negative finding from the same investigation:** this form is actually well-guarded against the *exact* employee-bug shape (submit button disabled + whole-form replace-on-success) — the race found here is a genuinely different mechanism (no request-sequencing/abort-on-superseded-request), not a repeat of the seed bug. This is useful evidence that the "submit-before-AJAX-resolves" pattern does **not** uniformly repeat across PrestaShop's dependent-dropdown forms — it repeats selectively, and this is a different failure shape found by looking rather than assumed. |

**Priority:** Medium. **Reachability:** ✅ Checkable today in principle (guest checkout is enabled by default) but several actions deep into the funnel — a scaffolding/depth question for the workload, not an auth block.

**Open Questions:** None outstanding on the mechanism.

Evidence: `properties/address-form-stale-country-response.md`

---

### delivery-option-stale-at-payment-confirm — Confirmed order can reflect a stale delivery option

| | |
|---|---|
| **Type** | Safety |
| **Property** | The delivery option reflected in a confirmed order always matches the one most recently selected before confirming payment — never one whose persist-to-session request hadn't landed yet. |
| **Invariant** | `Always` — confirmation page's carrier/total matches the delivery radio checked at confirm-click time. |
| **Antithesis Angle** | Delaying/dropping the delivery-update POST while letting the payment-confirm POST through is a direct asymmetric-latency fault scenario. |
| **Why It Matters** | The storefront analogue of the seed bug's shape, but on money/shipping instead of an admin form — hits the "displayed price is the charged price" guarantee directly. Mechanism grounded in source: `CheckoutDeliveryStep::handleRequest` persists on every `change` event (not gated on explicit confirm), and `Payment.confirm()` never checks delivery-freshness before proceeding. |

**Priority:** Medium-high (grounded mechanism, real financial-consistency risk). **Reachability:** ✅ Checkable today in principle (guest checkout) with the same funnel-depth caveat as the address-form property.

**Open Questions:**

- Whether PHP session-file locking might naturally serialize the delivery-update and payment-confirm requests, closing the window — not verified. Treat as "mechanism exists, exploitability under this deployment's session handling unconfirmed" rather than a proven repro. `(needs investigation)`

Evidence: `properties/delivery-option-stale-at-payment-confirm.md`

---

### checkout-step-state-consistent-after-navigation — Checkout step state survives back/forward/reload

| | |
|---|---|
| **Type** | Safety |
| **Property** | After browser back/forward/reload during checkout, the "current" step and any continue/place-order button's enabled state always match what the server would compute live — never a stale bfcache-restored view. |
| **Invariant** | `Always` — DOM step/button state after such navigation matches a fresh render of the same URL. |
| **Antithesis Angle** | Rides Bombadil's existing default back/forward/reload actions for free; the real value is in timing them against the in-flight delivery/address AJAX calls from the two properties above. |
| **Why It Matters** | Directly matches `sut-analysis.md`'s Wildcard-focus ask. Server-side step-reachability computation was confirmed robust to fresh renders, but no bfcache defense (`pageshow`/`event.persisted` handling) was found in any reviewed checkout JS file — an absence-of-defense finding, not a confirmed live defect. |

**Priority:** Medium (source-grounded gap, not a proven repro). **Reachability:** ✅ Checkable today.

**Open Questions:** None beyond the honest confidence caveat already stated above.

Evidence: `properties/checkout-step-state-consistent-after-navigation.md`

---

### order-message-lost-on-premature-reload — Order message survives (or warns before) a premature reload

| | |
|---|---|
| **Type** | Safety |
| **Property** | An order message typed into the "Order message" field during back-office order creation is not silently discarded by a page reload, a shared/re-opened order-creation link, or emailing the cart to the customer before "Create order" is clicked — it either persists across that operation or the admin is warned it won't. |
| **Invariant** | `AlwaysOrUnreachable` — on the workload path that opens BO order creation, types an order message, then reloads/navigates away and back before submitting: the message must still be present afterward, or the field must have been visibly cleared with the admin warned. |
| **Antithesis Angle** | A pure ordering/lifecycle gap, not a timing race — the write that would make the field durable across reload was never implemented for the current AJAX-driven flow (a prior, pre-9.x version autosaved it). Once back-office driving exists, the default `reload` action provides the trigger for free. Independently surfaced by both the Lifecycle Transitions lens (which fully validated the mechanism) and the Idempotency/Replay lens (which framed it as a durability regression) — two-lens convergence is a confidence signal. |
| **Why It Matters** | **Maintainer-reproduced and root-cause-confirmed** (GitHub #39389, labels `Bug`/`Regression`/`Ready`/`Verified`, 6 comments): a PrestaShop maintainer explicitly reproduced it; a second reporter confirmed it on PS 9; a third commenter identified the exact root cause by reading `GetCartForOrderCreationHandler.php`/`summary-renderer.ts` — the read side is correctly wired, but nothing on the write path ever persists a message to the cart before final submit. Real workflow impact: admins pre-fill an order message before sharing a payment link by phone, and the message silently vanishes. |

**Priority:** High. **Reachability:** 🔒 Blocked on back-office auth.

**Open Questions:**

- Not confirmed against this project's exact vendored tag specifically (issue confirmations are against PS 8.2.x/9 generically). `(partial: confirmed open/reproducing on PS 9 generically as of 2026-08-06; not confirmed on this project's exact floating tag)`
- Whether a fix has landed since the last issue comment (2026-08-06) is unknown — re-check before treating as an active regression target. `(needs investigation)`

Evidence: `properties/order-message-lost-on-premature-reload.md`

## Category: Session & Auth Boundaries

Cookie/session correctness and the authentication boundary between the anonymous storefront and
the back office / API. Grounded heavily in `bugs.md`'s first-hand security findings, each traced
to a specific source-level mechanism rather than left as an observation.

### session-cookie-lifetime-bounded — Session cookie lifetime is never unboundedly long

| | |
|---|---|
| **Type** | Safety |
| **Property** | No session-identifying cookie (`PHPSESSID`, `PrestaShop-<hash>`) is issued with an unbounded or implausibly long lifetime. |
| **Invariant** | `Always` — parse each session cookie's Max-Age/expires; assert it stays within a defined sane ceiling. |
| **Antithesis Angle** | Not a race — a standing regression guard against reintroducing the same unit-mismatch bug class in a future refactor. |
| **Why It Matters** | **The single strongest finding in this catalog** — a confirmed source-level unit-mismatch bug, not a config choice. `config/config.inc.php` builds `$cookie_lifetime` as an *absolute future Unix timestamp* (correct for `Cookie::__construct()`'s `$expire` param), then reuses that same value unconverted as `SessionHandler`'s `$lifetime` constructor argument — which PHP's `session_set_cookie_params()` treats as a *relative* seconds-from-now duration. The arithmetic (absolute timestamp treated as a duration, added to "now" again) lands almost exactly on the observed "18 July 2083" expiry from `bugs.md` #13. |

**Priority:** High. **Reachability:** ✅ Checkable today.

**Open Questions:**

- Whether this is already fixed upstream past the `develop` read used here. `(needs investigation)`
- The DB-level `PS_COOKIE_LIFETIME_FO` value only refines the sane ceiling, doesn't change whether the defect is real.

Evidence: `properties/session-cookie-lifetime-bounded.md`

---

### duplicate-session-cookie-single-write — No response sets the same cookie twice with different values

| | |
|---|---|
| **Type** | Safety |
| **Property** | A single HTTP response from the storefront never carries two `Set-Cookie` headers for the same cookie name with two different values. |
| **Invariant** | `Always` — group each response's `Set-Cookie` headers by name; assert no name maps to more than one distinct value. |
| **Antithesis Angle** | Latency/CPU fault injection on the single `prestashop` container could widen/narrow the window between an explicit mid-render cookie write and a later `__destruct()`-triggered write, surfacing whether the two values ever diverge in more than encryption-IV noise. |
| **Why It Matters** | Session/cart correctness relies on unspecified "last Set-Cookie wins" client behavior (RFC 6265) that PrestaShop never states as a requirement; a client that doesn't apply it keeps a stale session cookie silently. Reproduced live 3× on home/category/product pages; absent on pure redirects and admin 401s (page-render-dependent, not universal). |

**Priority:** Medium. **Reachability:** ✅ Checkable today.

**Open Questions:**

- Exact second-write trigger (same `Cookie` object mutated mid-request vs. a second instance) not pinned down — `Cookie.php`'s checksum guard rules out "same unchanged value flushed twice." `(partial: ruled out one cause, exact trigger still open)`

Evidence: `properties/duplicate-session-cookie-single-write.md`

---

### session-cookie-secure-flag-matches-transport — Cookies never claim Secure over plain HTTP

| | |
|---|---|
| **Type** | Safety |
| **Property** | On every response served over the plain-HTTP origin Bombadil drives, no cookie is ever issued with the `Secure` attribute. |
| **Invariant** | `Always` — if the page loaded via `http://`, assert every `Set-Cookie` lacks `Secure`. |
| **Antithesis Angle** | Not a race — a fast localizer: if `Secure` ever appears unexpectedly (e.g. a proxy-header-trust bug), this fails immediately instead of surfacing only as a downstream cart-desync symptom several actions later. |
| **Why It Matters** | Confirms `bugs.md` #6's real-world impact (credentials/session travel in cleartext on this deployment) without overclaiming PrestaShop "should" force HTTPS by default — traced to `Configuration::get('PS_SSL_ENABLED')`, a deployment choice, not a code defect. Value is as a regression guard, not a bug report. |

**Priority:** Low-medium (confirms a known deployment choice; guards against a future proxy/config regression). **Reachability:** ✅ Checkable today.

**Open Questions:** None — fully confirmed live and by source.

Evidence: `properties/session-cookie-secure-flag-matches-transport.md`

---

### admin-surface-rejects-anonymous-access — Admin/API surfaces never leak data to anonymous requests

| | |
|---|---|
| **Type** | Safety |
| **Property** | An anonymous request to `/admin-dev/...`, `/api/`, or `/webservice/...` never returns a 2xx with store/employee/customer/order data — always redirects to login or returns 401/403. |
| **Invariant** | `Always` — assert status ∈ {301,302,307,308,401,403} and no data markers in the body. |
| **Antithesis Angle** | Timing pressure on the auth-check itself (DB/cache lookup gating these controllers) — same class of risk as the confirmed employee-creation defect, applied to the auth boundary instead. |
| **Why It Matters** | An auth-boundary regression here is full store compromise (`bugs.md` #7's scenario); `closed-bugs-last-year.md`'s permissions/auth category shows this class of bug recurs (`#9874`, `#10216`). Confirmed **correct today**: live-tested on `AdminEmployees`, `/admin-dev/`, `/api/`, `/webservice/dispatcher.php` — all redirect or 401, no leak. This property's value is as a standing regression guard, not a currently-open defect. |

**Priority:** Medium (currently passing; high blast radius if it ever regresses). **Reachability:** 🔧 Needs workload extension — no auth required, but no anonymous storefront page links to these paths, so Bombadil's default navigation never reaches them. Needs a URL-frontier seed, a smaller lift than full authentication.

**Open Questions:** None on current behavior — fully confirmed live.

Evidence: `properties/admin-surface-rejects-anonymous-access.md`

---

### weak-admin-credentials-blocked-on-auth — Default admin credentials force a reset, or fail

| | |
|---|---|
| **Type** | Safety |
| **Property** | Logging in with the vendored image's default credentials (`demo@prestashop.com`/`prestashop_demo`) either fails or immediately forces a credential change before any other admin action. |
| **Invariant** | `Always` (if implemented) — the first reachable state after such a login is a forced-password-change form, never the dashboard. |
| **Antithesis Angle** | Once authenticated, fault-inject the forced-reset flow itself (interrupted submission, double-submit) for a half-reset state — mirrors the confirmed employee-creation race. |
| **Why It Matters** | Directly `bugs.md` #7's full-takeover scenario — a first-hand confirmed finding on this exact vendored image, the strongest possible evidentiary standing. Additionally validated a related closed issue past its headline: `#40380` ("possible to validate an average admin password") is maintainer-confirmed (`Verified`+`completed`; the installer accepted the password "prestashop" itself), fixed by PR `#40829` — a genuine regression target for password-strength validation specifically. |

**Priority:** High. **Reachability:** 🔒 Blocked on back-office auth.

**Open Questions:** None on the underlying finding — fully confirmed first-hand and cross-referenced against a maintainer-confirmed related issue.

Evidence: `properties/weak-admin-credentials-blocked-on-auth.md`

---

### csrf-token-stability-across-identity-change — Token-protected forms degrade gracefully across an identity change

| | |
|---|---|
| **Type** | Safety |
| **Property** | Submitting a token-protected form after the browser's active customer identity changed (login/logout) via back/forward to a cached page always degrades gracefully — never processes under the wrong identity, never 500s. |
| **Invariant** | `Always` on any POST failing `isTokenValid()` after an identity change: response ∈ {redirect, clear security-token error}, never 5xx or a mutation attributable to the stale identity. |
| **Antithesis Angle** | A genuine ordering property (identity-change window between render and submit) well-suited to deliberate interleaving rather than hoping organic exploration finds the right order. |
| **Why It Matters** | The naive framing (staleness from time passing) is **wrong for this codebase** — a real, source-grounded finding in its own right: `Tools::getToken()` hashes `(customer->id, customer->passwd, page)` with no session nonce or timestamp, so for anonymous browsing the token is *constant* — plain back/forward-then-submit does **not** produce staleness. The actual (and only) trigger is a genuine identity change (login/logout) during the back/forward window. Side finding, not asserted as a bug: `CartController::updateCart()` only checks `isTokenValid()` when the customer `isLogged()` — anonymous cart mutations aren't CSRF-checked at all by this controller. |

**Priority:** Low (mechanism confirmed, but the trigger condition requires authentication — more strongly blocked than any other property in the catalog, since even the *setup* to reach the trigger needs login). **Reachability:** 🔒 Blocked on back-office/login auth — zero reachable trigger today.

**Open Questions:** None on the mechanism — fully traced to source. Reachability is the only blocker.

Evidence: `properties/csrf-token-stability-across-identity-change.md`

## Catalog-Wide Open Questions

- **The single biggest lever on this catalog's actionability**: 5 of 23 properties (`employee-creation-no-crash-on-race`, `order-message-lost-on-premature-reload`, `cart-rule-zero-value-discount-saves-silently`, `weak-admin-credentials-blocked-on-auth`, `csrf-token-stability-across-identity-change`) are blocked on one decision — whether to extend Bombadil to authenticate into `/admin-dev/`. A 6th (`admin-surface-rejects-anonymous-access`) needs only a URL-frontier seed, not auth. Resolving this once, deliberately, is worth more than any single property refinement. `(needs human input)`
- Two properties (`add-to-cart-double-click-no-duplicate-line`, `voucher-code-resubmit-not-double-applied`) have source-validation questions left open purely because of a shared `gh api` rate limit hit during discovery, not because the question is hard — worth a quick retry pass before triage rather than treating them as permanently uncertain. `(needs investigation)`
- Coverage gaps acknowledged rather than filled this pass: multistore, webservice/import-export, and translation/locale bug categories (large in `closed-bugs-last-year.md` but structurally out of reach for a single-shop, no-webservice, single-language Bombadil deployment) — see `sut-analysis.md` Bug History section.
