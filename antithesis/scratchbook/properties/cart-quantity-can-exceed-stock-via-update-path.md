---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/PrestaShop/PrestaShop/blob/develop/controllers/front/CartController.php
    why: The actual add/update-quantity handler. Confirms the mode-dependent stock-check asymmetry described below (fetched via `gh api repos/PrestaShop/PrestaShop/contents/controllers/front/CartController.php`, develop branch, 2026-09-29).
  - path: https://github.com/PrestaShop/PrestaShop/blob/develop/classes/Cart.php
    why: `Cart::updateQty()` — confirms the internal stock guard exists and confirms it is explicitly disabled by the caller for this path.
---

# cart-quantity-can-exceed-stock-via-update-path

## Lens

Data Integrity — is the cart quantity/total shown to the shopper ever a state the system itself
considers invalid (over the actual stock), and does the storefront ever *store* that state rather
than merely fail to prevent it once and self-correct?

## What led to this property

`sut-analysis.md`'s claimed guarantee #3 ("Out-of-stock or quantity-limited products cannot be
added past their limit through the storefront UI") and the "Stock / quantity logic" closed-bug
category (23 issues, e.g. #9974 "Client can order more customized product than the product
stock", #27871 "Combinations quantity in Pack are not verified at the last step of the checkout")
pointed at quantity-vs-stock enforcement as a likely-fragile area. I read the actual enforcement
code rather than trusting the claim or any single issue's description, per
`validating-claims.md`.

## The mechanism, confirmed from source

`controllers/front/CartController.php::processChangeProductInCart()` determines a request `$mode`
from whether the request carries an `update` parameter vs. an `add` parameter:

```php
$mode = (Tools::getIsset('update') && $this->id_product) ? 'update' : 'add';
```

There are **two separate stock checks** in this function, and they are not equivalent:

1. **Line 425 — pre-check, `add` mode only:**
   ```php
   if ('update' !== $mode && $this->shouldAvailabilityErrorBeRaised($product, $qty_to_check)) {
       // ...error, `return;` — never calls updateQty at all
   }
   ```
   This early-returns *before* touching the database, but only runs when `$mode === 'add'`.

2. **Line 497 — the actual DB write, both modes:**
   ```php
   $update_quantity = $this->context->cart->updateQty(
       $this->qty, $this->id_product, $this->id_product_attribute,
       $this->customization_id, Tools::getValue('op', 'up'),
       0, null,
       true,   // auto_add_cart_rule
       true    // <-- skipAvailabilityCheckOutOfStock
   );
   ```
   The 9th positional argument to `Cart::updateQty()` is `$skipAvailabilityCheckOutOfStock`, and
   the front controller **explicitly passes `true`**. Inside `Cart::updateQty()`
   (`classes/Cart.php`), the internal stock guard is:
   ```php
   if ($newProductQuantity < 0 && !$availableOutOfStock && !$skipAvailabilityCheckOutOfStock) {
       return false; // refuses to write
   }
   ```
   Because the caller passes `skipAvailabilityCheckOutOfStock: true`, this guard is disabled for
   every call from `CartController` — the SQL `UPDATE ps_cart_product SET quantity = quantity +
   N ...` commits unconditionally, regardless of stock.

3. **Line 524 — post-check, both modes, but *after* the write already committed:**
   ```php
   } elseif ($this->shouldAvailabilityErrorBeRaised($product, $qty_to_check)) {
       // ...appends a user-facing error like "You can only buy N "product""
   }
   ```
   This runs for *both* `add` and `update` mode, but only as an `elseif` **after**
   `updateQty()` at line 497 has already run and committed. Nothing in this branch reverts the
   write or re-clamps the stored quantity back down.

Net effect: for the **`update` mode path** (adjusting the quantity of a product already in the
cart — the cart page's quantity input/stepper, or any request that carries `update=1` rather than
`add=1`), there is no pre-write guard at all (item 1 is skipped), the write itself cannot refuse
(item 2's guard is disabled), and the only backstop is a post-write error *message* (item 3) that
does not undo the write. A shopper can therefore push a cart line's stored quantity above the
product's actual available stock using the cart page's own quantity control, while simultaneously
being shown text that says they can't.

I did not independently confirm which exact DOM element sends `update=1` (likely the classic
theme's cart-page quantity stepper/input, per standard PrestaShop cart template structure), but
the server-side branching is unconditional on that — any client path that submits
`update=1&id_product=X&qty=N&op=up` hits this exact sequence, and the classic theme's cart page
indisputably has *some* control for changing an already-in-cart product's quantity without
re-visiting the product page.

## What goes wrong if this is violated

- The header badge, cart page line quantity, and checkout summary can display (and the DB can
  hold) a quantity for a product that exceeds real stock, alongside an error message telling the
  shopper the opposite ("You can only buy N"). This is a direct violation of the claimed guarantee
  and a direct contradiction between the error text and the state actually rendered.
- If nothing downstream (e.g. a later `areProductsAvailable()`/`checkQuantities()` call at
  checkout) catches this before payment, an order could be placed for more units than are in
  stock — a real inventory-integrity failure, not just a UI glitch.
- Even if a later check does catch it, the *interim* state (between the update AJAX response and
  the next full reload) is a genuine display/actual-state mismatch — exactly the "wildcard"
  post-navigation class of bug `sut-analysis.md` calls out.

## Property Catalog Entry

### cart-quantity-can-exceed-stock-via-update-path — In-cart quantity updates never store more than the availability error itself claims is purchasable

| | |
|---|---|
| **Type** | Safety |
| **Property** | Whenever the storefront displays an availability-limit error for a product ("You can only buy N '<product>'"), that product's actual in-cart quantity (as shown in the cart line's quantity field/badge) never exceeds N, either immediately or after a reload. |
| **Invariant** | `Always`. Extract, from any page state, pairs of (product-scoped availability-error text with its parsed `N`, that same product's currently-displayed cart-line quantity). Whenever such an error is visible for a product, assert `displayed_quantity <= N`. This is `Always` rather than `AlwaysOrUnreachable` because the guarantee must hold on every occurrence of the error, not just be internally consistent when reached — but note the error itself is a workload-dependent/optional state (see Open Questions on `Sometimes` framing below). |
| **Antithesis Angle** | Exercises exactly the code path described above: the cart page's quantity-update control (distinct from the product-page add-to-cart button, which goes through the `add`-mode pre-check). Rapid/repeated increments on a low-stock product's cart-line quantity, especially interleaved with reloads, are precisely what Bombadil's default click + reload action generators already do without new action-generator work — this turns that existing exploration into a targeted check instead of only relying on the generic `noPhpFatalErrorRendered`/`noHttpErrorCodes` backstops. |
| **Why It Matters** | Directly tests the claimed guarantee in `sut-analysis.md` ("Out-of-stock or quantity-limited products cannot be added past their limit through the storefront UI") against a source-confirmed mechanism (`skipAvailabilityCheckOutOfStock: true` at the one call site that handles both add and update requests) rather than an assumption. Stock/quantity logic is a 23-issue closed-bug category; this is a specific, previously-undocumented (not filed upstream, as far as this pass found) bypass in that area found by reading the code, not by citing an issue. |

**Open Questions:**

- Does a subsequent action (proceeding to checkout, or the delivery-step's `areProductsAvailable()`/`checkQuantities()` call, confirmed to exist in `CartController.php`) actually block or re-correct an over-stock quantity before payment, or does it only append another warning without reverting the DB value? If it always blocks payment, this property is a "confusing UI, but no real inventory harm" bug; if it doesn't reliably block, it's a genuine overselling bug. Not run against the live instance in this pass — needs either a live repro (seed a low-stock product, hammer the cart-page qty control, and inspect `ps_cart_product` / attempt to reach order confirmation) or reading `PaymentModule`'s/order-validation's own quantity re-check more closely than this pass did. `(partial: confirmed CartController::areProductsAvailable() exists and runs after delete/update-mode changes on the same request; not confirmed whether every path to checkout re-runs it before allowing payment)`
- What DOM element(s) in the currently-vendored theme actually submit `update=1` vs. `add=1`? Assumed to be the cart page's quantity stepper/input based on the server-side mode-detection logic and standard PrestaShop cart template structure, not independently confirmed by reading the theme's JS/templates in this pass (a `gh api search/code` for the theme's cart JS did not surface the exact handler). This affects how the Bombadil workload should target the action (e.g., does the default click/fill generators already reach it, or does the qty input need an explicit action generator?). `(needs investigation — read the vendored theme's cart-page template/JS or observe network requests live)`
- Should the invariant instead be framed as `Sometimes(error is shown)` to confirm the error state is ever reached at all, in addition to the `Always` consistency check once it is? Given the current Bombadil workload runs against a fresh install with default-quantity stock on demo products, the error may rarely or never trigger without a deliberately low-stock seed product — an environment/initial-state dependency worth flagging for whoever wires up the workload. `(needs human input on initial-state/environment design)`
