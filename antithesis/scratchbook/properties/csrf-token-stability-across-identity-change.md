---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/PrestaShop/PrestaShop/blob/6a22f8e2aacb51b2d83e9965eb50f92d691fd2a0/classes/Tools.php
    why: Primary evidence for the token derivation formula — Tools::getToken(), read via gh api against develop HEAD commit 6a22f8e2aacb51b2d83e9965eb50f92d691fd2a0.
  - path: https://github.com/PrestaShop/PrestaShop/blob/6a22f8e2aacb51b2d83e9965eb50f92d691fd2a0/classes/controller/FrontController.php
    why: isTokenValid() — confirms the comparison this token is checked against.
  - path: https://github.com/PrestaShop/PrestaShop/blob/6a22f8e2aacb51b2d83e9965eb50f92d691fd2a0/controllers/front/CartController.php
    why: updateCart() — confirms token checking is applied only conditionally (only for logged-in customers) on this particular controller, an asymmetry worth recording even though it isn't this property's main claim.
  - path: /Users/maaretp/Documents/cgi-code/exploring-prestashop/antithesis/scratchbook/sut-analysis.md
    why: "Bombadil currently never logs in" open question — this property is squarely in the territory that open question already flags as blocked on a workload decision.
---

# csrf-token-stability-across-identity-change

## Lens

Protocol Contracts — form-action-URL/CSRF-token validity under navigation edge cases (back/forward to
a stale page, then submit), as explicitly named in the discovery brief.

## What led to this

The brief asks specifically about "form action URLs with CSRF tokens" holding under
back/forward-then-submit. Read `Tools::getToken()` and `FrontController::isTokenValid()` to understand
what actually invalidates a PrestaShop front-office token, since that determines whether
back/forward-then-submit is even a *reachable* way to get a stale token in this system.

## The mechanism

`classes/Tools.php`, `Tools::getToken()`:
```php
public static function getToken($page = true, ?Context $context = null)
{
    if (!$context) {
        $context = Context::getContext();
    }
    if ($page === true) {
        return Tools::hash($context->customer->id . $context->customer->passwd . $_SERVER['SCRIPT_NAME']);
    } else {
        return Tools::hash($context->customer->id . $context->customer->passwd . $page);
    }
}
```
`classes/controller/FrontController.php`, `isTokenValid()`:
```php
public function isTokenValid()
{
    if (!Configuration::get('PS_TOKEN_ENABLE')) {
        return true;
    }
    return strcasecmp(Tools::getToken(false), Tools::getValue('token')) == 0;
}
```

The token is a **deterministic hash of `(customer id, customer password hash, controller/page name)`**
— it is not a per-session nonce, has no timestamp/expiry component, and is not rotated on any schedule.
Concretely, this means:

- For an **anonymous** visitor, `customer->id` is `0` and `passwd` is empty, so the token is constant
  for a given controller across the entire anonymous session (and indeed across any anonymous session,
  since nothing session-specific feeds the hash). A plain back/forward-then-submit by an anonymous
  visitor, with nothing else changing, will **not** produce a token mismatch — the "stale form" scenario
  the brief describes isn't actually reachable this way for anonymous browsing.
- The token *does* change when either (a) the customer's `id` changes — i.e. **a different customer
  becomes the logged-in identity in this browser context** (login, logout, or one customer's session
  superseding another's) — or (b) the customer's `passwd` hash changes (a password reset/change).
  Both of these are exactly the kind of identity transition that browser back/forward + bfcache can
  surface: navigate to an account/checkout page while logged in as customer A (token embedded in the
  page's hidden `token` field reflects A), log out (or the session expires / a different customer logs
  in in the same tab), then use the browser's back button to return to the bfcache'd page — the DOM
  still shows the stale hidden `token` input, and submitting it now runs `isTokenValid()` against the
  *new* context's customer id/passwd, which will mismatch.

## What happens on a token mismatch (partially traced, not fully)

`CartController::updateCart()` (lines 224–283) shows one concrete handling path:
```php
if (!Connection::isBot() && !$this->errors
    && !($this->context->customer->isLogged() && !$this->isTokenValid())) {
    // ... normal processing ...
} elseif (!$this->isTokenValid() && Tools::getValue('action') !== 'show' && !Tools::getValue('ajax')) {
    Tools::redirect('index.php');
}
```
Two things worth recording:
1. The token check is only applied `&& $this->context->customer->isLogged()` — for an anonymous
   customer, `isTokenValid()` is never consulted at all in this controller's gating logic, so cart
   mutations are effectively not CSRF-protected for anonymous visitors by this controller. This may be
   intentional (low-value target), but it's a real asymmetry in the token contract worth recording as
   an open question rather than asserting it's a bug.
2. When the mismatch condition *does* apply (logged-in customer, bad token, non-ajax, action != show),
   the controller redirects to `index.php` — a graceful degradation, not a crash. Whether **other**
   front controllers (account edit, checkout address forms, `AuthController`) do the same graceful
   redirect, versus something else (silently proceeding under a mismatched identity, or a 500), was
   **not traced** — only `CartController`, `CmsController`, `ProductController`, and
   `PdfOrderReturnController` are the four front controllers that call `isTokenValid()` directly
   (confirmed via `gh api search/code -f q='isTokenValid repo:PrestaShop/PrestaShop path:controllers/front'`);
   most customer-account forms likely route through Symfony/CQRS controllers with their own (unread)
   CSRF handling, not this legacy `Tools::getToken()` mechanism.

## Why it matters

This is precisely the class of "client-visible contract under navigation edge cases" the brief calls
out, and it's a case where **naive intuition about CSRF tokens is wrong for this codebase** — most
systems rotate a token per-session or per-render, making back/forward-then-submit an obvious source of
staleness; PrestaShop's front-office token is stable for a fixed identity, so the interesting edge case
is specifically an *identity change* during the back/forward window, not mere staleness from time
passing. Getting this distinction right matters for anyone designing the assertion, since testing
"submit after waiting N minutes" would (per this analysis) not exercise the bug at all, while "submit
after logging out/in" would.

## Invariant and Antithesis angle

- **Type:** Safety.
- **Property:** Submitting a token-protected form whose embedded token was rendered under one customer
  identity, after the browser's active identity has changed (login, logout, or a different customer
  logging in) via back/forward navigation to a cached page, always degrades gracefully (redirect to a
  safe page, or a clear re-authentication/error message) — it never processes the mutation under the
  wrong identity, and never 500s.
- **Invariant (`Always`):** on any POST that fails `isTokenValid()` after an identity change, assert the
  response is one of {redirect (3xx) to a non-error page, a rendered validation/security-token error
  message} and never a 5xx or a state-changing side effect attributable to the pre-change identity.
  `Always` fits since this must hold on every such submission, not just sometimes.
- **Antithesis angle:** this is a genuine timing/ordering property — "identity change happens in the
  window between page render and form submission" — which is exactly the kind of interleaving
  Antithesis is well-suited to force deliberately rather than hoping organic exploration stumbles into
  the right order of operations (log in → render form → log out → back → submit).

## Open Questions

- **Blocking:** Bombadil's current workload never logs in (per `sut-analysis.md`'s catalog-wide open
  question) — with an anonymous-only customer identity, this property has **no reachable trigger at
  all** today, since the identity never changes. This property is aspirational/future-workload, more
  strongly so than the other three in this batch: it isn't just "needs a fixture," it needs the
  workload itself extended to perform login/logout as part of its action set. `(needs human input —
  same workload-scoping decision sut-analysis.md already flags, restated here because this property is
  entirely blocked on it rather than just weakened by it)`
- Is the anonymous-cart-mutation token exemption in `CartController::updateCart()` (point 1 above)
  intentional, documented design, or an oversight? Not resolved — no comment in the source explains it,
  and it wasn't investigated further (out of scope: this property is about the *stale-token* class, not
  the *no-token-check-at-all* class, which would be a different, weaker property about anonymous cart
  CSRF exposure in general). `(needs human input if it's ever promoted to its own property)`
- Do the Symfony/CQRS-based customer-account and checkout forms (outside the four legacy controllers
  confirmed to call `isTokenValid()`) use a different CSRF mechanism with different staleness
  properties (e.g. Symfony's per-form-type CSRF tokens, which typically *are* session-bound and could
  behave differently under this exact back/forward-then-submit scenario)? Not investigated. If they
  differ, the invariant above may need to be split into a legacy-controller version and a
  Symfony-form version. `(needs code reading in src/PrestaShopBundle/Form, not done in this pass)`
