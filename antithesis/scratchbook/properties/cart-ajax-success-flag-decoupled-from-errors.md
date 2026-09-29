---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/PrestaShop/PrestaShop/blob/6a22f8e2aacb51b2d83e9965eb50f92d691fd2a0/controllers/front/CartController.php
    why: Primary evidence for the AJAX response contract violation below — read directly via `gh api repos/PrestaShop/PrestaShop/contents/controllers/front/CartController.php` against `develop` HEAD commit 6a22f8e2aacb51b2d83e9965eb50f92d691fd2a0 (2026-09-29T14:17:30Z), not a bug-report claim.
  - path: https://raw.githubusercontent.com/PrestaShop/PrestaShop/develop/themes/_core/js/cart.js
    why: Consuming client-side code for the same AJAX response — confirms which fields the front-end actually reads, closing the loop between server contract and client behavior.
---

# cart-ajax-success-flag-decoupled-from-errors

## Lens

Protocol Contracts — response-code/shape correctness for the cart AJAX controller (`controller=cart`),
one of the two AJAX endpoints named explicitly in the discovery brief.

## What led to this

Reading `CartControllerCore` end-to-end (front controller behind the "add to cart" / "update quantity"
UI that Bombadil's default click/fill actions already drive anonymously) looking for narrower classes
of contract violation than the existing catch-all `noPhpFatalErrorRendered`. Two independent code paths
in this controller compute a `success`/`hasError` flag that does **not** actually reflect whether an
error occurred.

## The mechanism (validated directly from source, not a bug-report claim)

### 1. `processChangeProductInCart()` / `displayAjaxUpdate()` — quantity-update mode

`controllers/front/CartController.php` (develop @ 6a22f8e2):

- Line 360: `$ErrorKey = ('update' === $mode) ? 'updateOperationError' : 'errors';` — when the request is a
  cart **update** (not an add), validation errors are appended to `$this->updateOperationError`, a
  *different* array than `$this->errors`.
- Lines 369–374: if `$this->qty == 0` (e.g. `qty=0` sent to `?controller=cart&action=update&ajax=1`),
  an error message ("Null quantity.") is appended to `$this->{$ErrorKey}` — **but there is no `return`
  after this block**, unlike the sibling checks a few lines later (e.g. line 385's block *does* fall
  through similarly, but the `!$product->id` block at the top of the method does `return` after adding
  its error). Execution continues into the full add/update flow.
- Lines 497–518: `Cart::updateQty($this->qty, ...)` is called with the zero delta; when the resulting
  `$update_quantity` is falsy/negative, further messages are appended to `$this->{$ErrorKey}` —
  still `updateOperationError` in update mode, never `$this->errors`.
- `displayAjaxUpdate()` (line 114 onward) branches purely on `$this->errors`:
  ```
  if (!$this->errors) {
      ...
      $this->ajaxRender(json_encode([
          'success' => true,
          ...
          'errors' => empty($this->updateOperationError) ? '' : reset($this->updateOperationError),
      ]));
      return;
  } else {
      $this->ajaxRender(json_encode(['hasError' => true, 'errors' => $this->errors, ...]));
      return;
  }
  ```
  (lines 114–148). In update mode, `$this->errors` stays empty even when `updateOperationError` is
  non-empty, so the **success branch runs**, producing a JSON body shaped like
  `{"success": true, ..., "errors": "Null quantity."}` — `success: true` *and* a populated `errors`
  string in the same payload, with no `hasError` key at all.

### 2. Consuming JS confirms the contract break is real, not just theoretical

`themes/_core/js/cart.js` (develop):
- Line 125: `if (!resp.hasError) { ... }` fires the "product updated" success flow (re-renders quantity,
  fires `updatedProductQuantity` event) whenever `resp.hasError` is falsy.
- Line 175: `if (resp.hasError) { ... .text(resp.errors[0]) }` is the *only* place `resp.errors` is
  surfaced to the shopper, and it's gated on `resp.hasError`.

Since the update-mode success response never sets `hasError` at all, the client takes the *success*
branch unconditionally and the `errors` string the server computed is never shown to the user. The
shopper who tried to set a quantity to 0 (or hit any other check that lands in `updateOperationError`
rather than `errors`) sees the cart re-render as if nothing went wrong, with no explanation of why the
quantity didn't change as expected (or changed to something they didn't request).

### 3. A second, more blatant instance of the same anti-pattern

`displayAjaxProductRefresh()` (lines 179–223, marked `@deprecated 1.7.3.1` but still present and
presumably still dispatchable via PrestaShop's `displayAjax{ucfirst($action)}` convention if
`action=productRefresh` is still routed):
```
if ($this->id_product) {
    ...
    $url = $this->context->link->getProductLink(...);
} else {
    $url = false;
}
...
$this->ajaxRender(json_encode(['success' => true, 'productUrl' => $url]));
```
(line 214 for `'success' => true`). `success` is hard-coded `true` regardless of whether `$url`
resolved — if `id_product` is falsy/missing, the endpoint still reports `success: true` with
`productUrl: false`. Same defect class: a `success` field whose value isn't actually conditioned on
the operation's outcome.

## Why it matters

This is exactly the "narrower than the catch-all" class of protocol-contract bug the discovery brief
asked for: not a 500/stack-trace, not an HTTP 4xx/5xx (`noHttpErrorCodes` won't catch it — the response
is a clean 200 with valid JSON), and not fatal-error text (`noPhpFatalErrorRendered` won't catch it
either). The defect is purely in the **semantic contract** of the JSON body: `success`/`hasError`
don't track whether the requested mutation actually happened as requested. A shopper could believe
their cart is in one state (whatever `resp.cart` shows) while an error the server itself detected
was silently dropped — a small but real correctness gap in the one surface (cart contents) the
SUT-analysis flags as the highest-priority "must never lie to the shopper" guarantee.

## Invariant and Antithesis angle

- **Type:** Safety.
- **Property:** The cart-controller AJAX responses (`displayAjaxUpdate`, `displayAjaxProductRefresh`)
  never report `success: true` (or omit `hasError`/report it falsy) while also carrying a non-empty
  `errors`/`updateOperationError`-derived message, and never report `success: true` with a `productUrl`
  that indicates the requested lookup failed.
- **Invariant (`Always`):** parse every JSON response body from `controller=cart` ajax actions; assert
  `!(body.success === true && typeof body.errors === 'string' && body.errors.length > 0)` for the
  update-mode response shape, and assert `!(body.success === true && body.productUrl === false)` for
  the product-refresh response shape. `Always` fits because this must hold on every single AJAX
  response Bombadil observes from this controller, not just eventually or on some optional path.
- **Antithesis angle:** Bombadil's own quantity +/- fuzzing and rapid clicking is already likely to
  drive quantity to 0 or below via the `qty`/`op` parameters; no new action generator is needed, only
  the assertion. Antithesis's value-add here is exploring the many ways to land in
  `updateOperationError` (zero qty, stock-limit hits combined with an update, minimal-quantity
  violations combined with an update) that a human wouldn't enumerate by hand, and confirming the
  contract break reproduces (or doesn't) for each.

## Open Questions

- Does `Cart::updateQty()` ever return a value that makes `$update_quantity < 0` true for a
  `qty=0`/`op=up` update, adding a *second* message to `updateOperationError` beyond "Null quantity."?
  Not traced into `Cart::updateQty()` itself — doesn't change the property (the contract break exists
  either way) but would change which message text ends up silently dropped. `(needs code reading if the
  exact message matters for the assertion)`
- Is `displayAjaxProductRefresh` still reachable via routing/dispatch given its `@deprecated` tag, or
  has the calling JS been fully removed such that `action=productRefresh` 404s before reaching this
  method? If unreachable, drop the second half of the invariant (the `productUrl` check) and keep only
  the `displayAjaxUpdate` half. `(needs a live request against the running container to confirm
  dispatch, not resolved from source alone)`
