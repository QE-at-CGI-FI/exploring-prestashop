# checkout-step-state-consistent-after-navigation

## Lens

Lifecycle Transitions — this is the "Wildcard Focus 12" item from `sut-analysis.md` ("Reload/back/
forward as an accidental fuzzer... make sure at least one property explicitly targets post-navigation
consistency") plus the lens brief's explicit ask: "does the storefront ever let checkout proceed in an
inconsistent step state" after browser back/forward or a reload mid-step. Bombadil's default action
generators already include back/forward/reload, so this property rides existing exploration for free —
no new action generator needed, only a new assertion.

## What I checked

- `classes/checkout/CheckoutProcess.php`, `classes/checkout/AbstractCheckoutStep.php` — step
  reachability/completeness (`step_is_reachable`, `step_is_complete`, `step_is_current`) is computed
  server-side, fresh, on every full page render of the checkout controller (not trusted from any
  client-submitted flag). This is a **good** sign: a genuine full navigation (reload, or back/forward
  that forces a fresh document load rather than a bfcache restore) will always re-derive step state
  correctly from `CheckoutSession`.
- `themes/_core/js/checkout-steps.js` — the *client-side* decoration layer. `Steps` toggles CSS classes
  (`-current`, `-unreachable`, `-complete`) on step elements when the user clicks a step header
  in-page — this is DOM-only bookkeeping to control which step's content is visually expanded; it does
  not itself refetch anything from the server.
- `themes/_core/js/checkout.js` — wires up `handleCheckoutStepChange()` (the above) and
  `handleSubmitButton()` (a `data('disabled')` flag + `.disabled` class added on `submit`, to block
  rage-clicks on the *current* form's submit button specifically).

## The gap

I did not find a `pageshow` / `event.persisted` listener (the standard way to detect a **bfcache
restore** — the browser serving a fully back/forward-navigated page from an in-memory snapshot instead
of doing a fresh request) anywhere in the checkout JS files I read (`checkout.js`, `checkout-steps.js`,
`checkout-address.js`, `checkout-delivery.js`, `checkout-payment.js`). If the browser satisfies a back/
forward navigation from bfcache, no server round-trip happens at all — the DOM (including whatever step
was marked `-current` via client-side class toggling, and whatever delivery/payment amounts were last
rendered) is restored verbatim from before the navigation, with no opportunity for the server-authoritative
step-state computation in `AbstractCheckoutStep`/`CheckoutProcess` to run.

This matters specifically when the *forward* history entry being restored is for a step whose
underlying `CheckoutSession` state has since changed via an action taken in another step (e.g., the user
went back to address, changed something that invalidates the previously-selected delivery option, then
hit browser-forward back into a bfcache'd payment step) — the restored page could show stale content
(an old total, an old "current" step highlighted, a Place Order button that was enabled based on
pre-navigation conditions) without the fresh reachability check that a live render would have applied.
I did **not** confirm this actually breaks anything at runtime (I read code, not a running repro) — this
is an absence-of-defense finding, not a confirmed defect, which is why it's tagged as an open question
below rather than asserted as fact.

## Property

| | |
|---|---|
| **Type** | Safety |
| **Property** | After any browser back, forward, or reload during checkout, the step the UI presents as "current"/active, and the enabled/disabled state of any "Continue"/"Place order" button, are always consistent with what the checkout controller would compute as reachable/complete for the session's actual current state — never a bfcache-restored view of a step that the live session state would now mark unreachable or incomplete. |
| **Invariant** | `Always`: whenever a workload action is back/forward/reload during checkout, extract (a) which step element carries the "current" class in the resulting DOM and (b) whether any "continue"/"place order" button in that step is enabled, then assert this matches a freshly-fetched render of the same checkout URL (i.e., the bfcache/cached view, if one was served, is not stale relative to a live equivalent). `Always` fits: this must hold after every such navigation during a run, not just once. |
| **Antithesis Angle** | Back/forward/reload are already default Bombadil actions, so this property adds detection, not new exploration surface — Antithesis's value here is in *timing* the back/forward relative to in-flight AJAX calls from the delivery/address steps (see the other two checkout properties in this batch), which is exactly the kind of interleaving a fixed script wouldn't stumble into but autonomous+fault-injected exploration would. |
| **Why It Matters** | A checkout flow that lets a shopper act on a stale, bfcache-restored step (e.g., confirm payment against a total that no longer matches the live cart/delivery state) breaks the "checkout completes or fails with a clear reason, never silently" guarantee called out as high-priority in `sut-analysis.md` Focus 10. |

**Open Questions:**

- Is there in fact no `pageshow`/`event.persisted` (or equivalent cache-busting `Cache-Control: no-store` header on the checkout response) defense anywhere in the checkout flow? I checked the theme-level JS files most likely to own this (`checkout.js` and its five direct step modules) but did not check HTTP response headers from a live request, nor Smarty/controller-level cache-control settings, nor every hook-registered module that might contribute checkout JS. `(partial: no defense found in the reviewed files; HTTP-header-level mitigation not ruled out)`
- Does this need Bombadil to actually reach multi-step checkout (guest checkout, confirmed enabled by default) to be meaningful, or is there a simpler bfcache-consistency check reachable purely on the storefront's existing pages (cart page, product page) that would already exercise the same underlying question without checkout depth? Worth considering as a cheaper first cut. `(needs a design decision, not just more research)`
