# delivery-option-stale-at-payment-confirm

## Lens

Lifecycle Transitions — generalizing the employee-creation crash's pattern to the checkout carrier/
delivery step, per the lens brief's explicit ask about carrier selection.

## What I checked

`themes/_core/js/checkout-delivery.js` (`develop`, via `gh api`):

```js
const updateDeliveryForm = (event) => {
  const $deliveryMethodForm = $(deliveryFormSelector);
  const requestData = $deliveryMethodForm.serialize();
  ...
  $.post($deliveryMethodForm.data('url-update'), requestData)
    .then((resp) => {
      $(summarySelector).replaceWith(resp.preview);
      if ($(prestashop.selectors.checkout.cartPaymentStepRefresh).length) {
        // we get the refresh flag : on payment step we need to refresh page to be sure
        // amount is correctly updated on payment modules
        refreshCheckoutPage();
      }
      prestashop.emit('updatedDeliveryForm', {...});
    })
    .fail((resp) => { ... });
};
$body.on('change', `${deliveryFormSelector} input`, updateDeliveryForm);
```

and `classes/checkout/CheckoutDeliveryStep.php::handleRequest()`:

```php
public function handleRequest(array $requestParams = [])
{
    if (isset($requestParams['delivery_option'])) {
        $this->setComplete(false);
        $this->getCheckoutSession()->setDeliveryOption($requestParams['delivery_option']);
        ...
    }
    ...
    if ($this->isReachable() && isset($requestParams['confirmDeliveryOption'])) {
        ...
    }
}
```

Key finding: **the server persists the new delivery option into `CheckoutSession` as soon as the
`change`-triggered "preview" AJAX call lands** — `setDeliveryOption()` runs whenever `delivery_option` is
present in the request, not gated on an explicit "confirm" action. There is no `confirmDeliveryOption`
requirement for the session write; that flag only affects whether the *step* is marked complete/advances.

The maintainers' own code comment ("on payment step we need to refresh page to be sure amount is
correctly updated on payment modules") shows they're aware that a delivery-option change can leave a
stale total visible if the payment step is already rendered — their fix is `refreshCheckoutPage()`, a
forced full-page reload, gated on a `cartPaymentStepRefresh` flag in the server's response.

`themes/_core/js/checkout-payment.js::Payment.confirm()` does a pre-submit server round-trip
(`action: 'checkCartStillOrderable'`) before finally submitting the selected payment module's form, but
this call only asks "is everything in the cart still orderable" — it does not re-fetch or re-confirm
which delivery option is currently persisted server-side, and nothing in `confirm()` waits on or checks
the state of any in-flight `updateDeliveryForm` request.

## The race

Because steps are made clickable via `checkout-steps.js` (`.$clickableSteps = $(currentStepSelector).prevAll().addBack()`)
a user who has reached the payment step can click back to the delivery step (a client-side DOM
manipulation, no full navigation) and change the selected carrier there. Sequence:

1. User is on/has reached the payment step (already rendered, showing a total based on delivery option A).
2. User clicks the delivery step (client-side step nav), selects delivery option B — this fires the
   `change` handler, POSTing `updateDeliveryForm`.
3. **Before that POST resolves** (network delay, or Antithesis-injected latency/drop), the user clicks
   back to the payment step and clicks "Confirm"/pay.
4. `Payment.confirm()` only checks `checkCartStillOrderable` (cart contents), not delivery-option
   freshness, and submits.
5. If the `updateDeliveryForm` POST from step 2 hasn't been processed server-side yet, the order is
   created against the **old** `CheckoutSession` delivery option (A), even though the browser UI shows B
   selected — a silent mismatch between what the user picked and what they're charged/shipped via.

This is the same *shape* as the employee-form bug (a client action races ahead of an in-flight
persistence call and the server acts on stale state) but manifests as a silent wrong-value defect
instead of a crash, and the built-in `refreshCheckoutPage()` mitigation only fires *after* the delayed
response eventually arrives — it does nothing to prevent the window between click-B and click-Confirm
from closing early if the response is slow. I did not find any disabling of the payment "Confirm" button
while a delivery-update request is in flight — `checkout-payment.js`'s `toggleOrderButton()` only reacts
to the terms checkbox and the payment-option radio, not to delivery-form request state.

## Property

| | |
|---|---|
| **Type** | Safety |
| **Property** | The delivery/shipping option reflected in the confirmed order (and the amount presented for payment) always corresponds to the delivery option most recently selected by the user before confirming payment — never a delivery option whose selection-persisting request hadn't completed yet. |
| **Invariant** | `Always`: on the order-confirmation page (or the response to the payment confirmation POST), the recorded carrier/shipping method and total match the delivery-option radio that was checked at the moment "Confirm"/pay was clicked — not an earlier selection. Concretely: extract the last-selected delivery-option id from browser state right before the confirm click, and assert it equals the delivery/carrier id echoed on the confirmation/order-detail page. `Always` because this must hold for every completed order, not just a deliberately-raced one. |
| **Antithesis Angle** | Delaying/dropping the `url-update` POST behind `updateDeliveryForm` while allowing the payment confirm POST through is a direct, realistic network-fault scenario (asymmetric latency between two concurrent requests from one session) — exactly what Antithesis's fault injection is built to explore, and very unlikely to be caught by a fixed-timing Playwright script. |
| **Why It Matters** | This is the storefront analogue of the confirmed-real employee-form race, but on the money/shipping path instead of an admin form — if it reproduces, a customer could be charged/shipped for a carrier they didn't actually select last, which is a direct instance of the "displayed price is the price charged at checkout" guarantee the SUT implicitly claims (`sut-analysis.md`, Focus 4). |

**Open Questions:**

- I have not confirmed server-side whether `CheckoutDeliveryStep::handleRequest()`'s `setDeliveryOption()` write and `Payment::confirm()`'s order-creation path share a single request-ordering guarantee (e.g., session-level locking that would serialize these two POSTs and make the race non-issue in practice, or whether both land on the same PHP-FPM/mod_php worker such that PHP's session file lock naturally serializes them). PrestaShop's default session handling does typically hold a file lock for the session's duration, which **could** naturally serialize these two requests server-side even if the client fires them close together — this would significantly narrow or close the window. `(needs human input / needs a source read of PrestaShop's session save handler before this property is implemented)`
- Whether this is reachable by the *current* Bombadil (anonymous, storefront-only) is the same depth question as `address-form-stale-country-response`: guest checkout is enabled by default, so no auth extension is required, but reaching the payment step requires completing several prior steps (cart, guest info, address, delivery) which may need scenario scaffolding rather than relying purely on default autonomous action generators. `(partial: confirmed reachable in principle via guest checkout; action-budget/scaffolding needed unconfirmed)`
