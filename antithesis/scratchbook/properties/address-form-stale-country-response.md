# address-form-stale-country-response

## Lens

Lifecycle Transitions — generalizing the employee-creation crash's pattern ("a form whose options are
populated by an async call before submission is valid") to the storefront checkout/address forms, per
the lens brief's explicit ask to check address selection in checkout for the same shape.

## What I checked

`themes/_core/js/address.js` (`develop` branch, fetched via `gh api repos/PrestaShop/PrestaShop/contents/...`)
implements the country -> address-field-set dependency for the address form used both in FO checkout
(`classes/checkout/CheckoutAddressesStep.php`) and account address management. Full `handleCountryChange`
function:

```js
function handleCountryChange(selectors) {
  $('body').on('change', selectors.country, (event) => {
    const requestData = {
      id_country: $(selectors.country).val(),
      id_address: $(`${selectors.address} form`).data('id-address'),
    };
    const getFormViewUrl = $(`${selectors.address} form`).data('refresh-url');
    const formFieldsSelector = `${selectors.address} input`;
    const target = $(event.target);

    const submitButton = $(`${selectors.address} [type="submit"]`);
    submitButton.prop('disabled', true);

    $.post(getFormViewUrl, requestData).then((resp) => {
      const inputs = [];
      $(formFieldsSelector).each(function () {
        inputs[$(this).prop('name')] = $(this).val();
      });
      $(target.closest(selectors.address)).replaceWith(resp.address_form);
      $(formFieldsSelector).each(function () {
        $(this).val(inputs[$(this).prop('name')]);
      });
      prestashop.emit('updatedAddressForm', {target: $(selectors.address), resp});
    }).fail((resp) => {
      submitButton.prop('disabled', false);
      prestashop.emit('handleError', {eventType: 'updateAddressForm', resp});
    });
  });
}
```

**This is actually the *good* pattern** — contrast with the employee form: the submit button is
explicitly disabled the moment the country changes, and the whole form subtree (submit button included)
is replaced with fresh server-rendered markup on success, which discards the disabled attribute along
with everything else. So the exact employee-bug shape (submit races ahead of a `<select>` repopulation
and lands a stale/empty value) does **not** replicate here in the way the lens brief hypothesized —
that's a real, useful negative finding: the pattern doesn't repeat everywhere, it repeats selectively,
and this form happens to be one of the guarded ones.

## The race that *does* exist here (a different failure mode)

There is no de-duplication or request sequencing in `handleCountryChange`:

- No `.abort()` of a previous in-flight `$.post` when the country is changed again before the first
  request resolves.
- No sequence number / "is this response still for the currently-selected country" check before
  `replaceWith(resp.address_form)` runs.
- The `submitButton.prop('disabled', true)` call re-fires on every `change` event, so rapid successive
  country changes each independently disable-then-race-to-replace, and jQuery/browser network stacks
  do not guarantee response ordering matches request ordering (especially under Antithesis-style added
  latency/jitter on one of the two requests).

Concretely: select Country A (fires request A, submit button disabled), then quickly select Country B
(fires request B, submit button disabled again) before request A's response has arrived. If request A's
response arrives *after* request B's, `replaceWith(resp.address_form)` runs twice, last-write-wins with
whichever response actually lands last — which can be request A's markup (built for Country A) replacing
a form the user has since set to Country B. The stored/restored field values (`inputs[...]`) are read
from whatever DOM is live at the moment each response processes, so the restore step doesn't fully
protect against this either — it restores values into the *wrong country's* field set (e.g., a US ZIP
into a country whose form expects a different postal-code format, or a "state" dropdown for the wrong
country). This is silent (no error is shown; `.fail()` is the only place the submit button gets
explicitly re-enabled, and the success path doesn't guard against being the stale response).

## Property

| | |
|---|---|
| **Type** | Safety |
| **Property** | The address form's rendered country-specific field set (and its "which country is this state/ZIP list for" framing) always corresponds to the country currently selected in the `.js-country` dropdown — never a stale field set left over from a previous, slower-to-respond country-change request. |
| **Invariant** | `Always`: after any settling period following one or more `change` events on `.js-country`, the `id_country` value embedded in the currently-rendered `.js-address-form` markup (or an equivalent server-echoed marker) equals the `<select>`'s current value. Antithesis's SDK assertion should compare the DOM-visible country selection against whatever the refreshed form's own hidden/data attributes say it was rendered for. `Always` fits: this is a per-observation invariant (rendered form matches selected country), not a one-time liveness milestone. |
| **Antithesis Angle** | Classic out-of-order-response race: two in-flight requests differing only in network latency. Antithesis's fault injection (asymmetric delay/reorder between two concurrent HTTP requests from the same browser session) is precisely the tool that turns "theoretically possible" into "reliably reproduced," since on a fast local network the two responses will almost always arrive in request order and this would be very hard to catch with a fixed Playwright script. |
| **Why It Matters** | A shopper who changes their mind about country twice quickly (not a rare user action) could end up submitting an address with the wrong country's field semantics silently applied — e.g., a state/province value invalid for the field's actual displayed country, which would either fail deeper validation with a confusing error or, worse, save inconsistent address data. |

**Open Questions:**

- Is this address form (and `handleCountryChange`) reachable to an **anonymous** Bombadil session, or does it require being mid-checkout (which needs a non-empty cart + proceeding through guest checkout) or logged into "my account"? Confirmed: `PS_GUEST_CHECKOUT_ENABLED` defaults to `1` (`install-dev/data/xml/configuration.xml`), so guest checkout is on by default and this form is reachable without authentication — but it's several actions deep (add to cart -> proceed to checkout -> fill guest info -> reach address step), which is a *depth* question for Bombadil's autonomous action budget, not an auth blocker. `(partial: confirmed guest checkout default-on; not confirmed whether Bombadil's current action generators reliably reach this deep without scenario scaffolding)`
- I did not verify from the server side (`AddressController` / the `refresh-url` endpoint) whether it echoes back which `id_country` a given response was computed for, which is needed to build the "stale response" assertion precisely — this would need a quick read of the controller action behind `data('refresh-url')` before implementation.
