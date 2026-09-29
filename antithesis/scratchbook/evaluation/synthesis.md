---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/prestashop/prestashop
    why: See property-catalog.md.
---

# Evaluation Synthesis

Four evaluation lenses ran against the 23-property catalog: Antithesis Fit, Coverage Balance,
Implementability, and Wildcard. Full evidence in `evaluation/antithesis-fit.md`,
`evaluation/coverage-balance.md`, `evaluation/implementability.md`, `evaluation/wildcard.md`.

## Refinements (applied directly to `property-catalog.md`)

1. **The 3 session-cookie properties are not implementable via Bombadil at all**
   (`session-cookie-lifetime-bounded`, `duplicate-session-cookie-single-write`,
   `session-cookie-secure-flag-matches-transport`). Both Implementability and my own live testing
   (see `bombadil/specification.ts`'s header comment) independently confirmed Bombadil's
   `extract()` has no access to HTTP headers or cookie attributes, and these specific cookies are
   HttpOnly — invisible to page JS by construction, not just to Bombadil. **Action:** retagged
   below from ✅ to a distinct "not implementable via Bombadil" status; recommended destination is
   `tests/regression-bugs.spec.js` (Playwright, which reads via CDP, not page JS).
2. **`csrf-token-stability-across-identity-change`'s reachability was mis-stated.** Its own
   evidence file already shows the trigger is a *storefront customer* login/logout, not back-office
   employee auth — it was incorrectly folded into the "5 properties blocked on back-office auth"
   framing. **Action:** re-tag to 🔧 (needs a customer login/logout extension — a smaller lift than
   full back-office driving) and decouple from the back-office-auth open question.
3. **`cart-ajax-success-flag-decoupled-from-errors`'s implementation plan needed correction.**
   Implementability correctly flagged that "no new action generator needed" was wrong — reading an
   AJAX JSON body needs real interception machinery. This was then *built* (see
   `bombadil/specification.ts`), first as a global `fetch`/`XMLHttpRequest` monkey-patch, which a
   live test caught introducing a genuine regression (see the Implementation Notes section below)
   before it was rewritten as a safe, self-contained probe. **Action:** catalog entry's "Antithesis
   Angle" updated to describe the actual (probe-based) mechanism, not the original "no new
   machinery" claim.
4. **`malformed-identifier-params-degrade-to-4xx` and `admin-surface-rejects-anonymous-access`
   don't need a "URL mutator" or "URL-frontier seed"** — Bombadil has no generic navigate-to-URL
   action, but same-origin `fetch()` calls from a custom action sidestep that entirely (confirmed
   live). **Action:** `malformed-identifier-params-degrade-to-4xx` was implemented this way (see
   `bombadil/specification.ts`); `admin-surface-rejects-anonymous-access`'s 🔧 note was corrected to
   name the same mechanism, still deferred (not yet implemented) pending the noHttpErrorCodes
   interaction question in Bias #2 below.
5. **`cartLineQuantitiesAreSane` (as originally planned) didn't actually implement the cataloged
   property.** The catalog's `cart-quantity-can-exceed-stock-via-update-path` is about exceeding
   *stock*, not just being non-negative. Implementing it surfaced that `window.prestashop.cart`
   exposes `stock_quantity`/`allow_oosp` per product — added `cartLineQuantityNeverExceedsStock` as
   the actual implementation; kept the non-negativity check too since it's cheap and independent.

## Gaps (acknowledged, not filled this pass — see Wildcard/Coverage-Balance evidence files for full detail)

- Zero `Sometimes`/`Reachable` assertions in the whole catalog; no property implements
  `sut-analysis.md` Focus 5's liveness guarantee ("UI eventually reflects new state without a
  manual reload"); several `Always` properties have no `Reachable` companion confirming their
  trigger precondition is ever hit (risk of vacuous passing — `cart-quantity-can-exceed-stock-via-update-path`
  in particular, though implementation confirmed live that the precondition *is* reachable).
- Three candidate properties named in `sut-analysis.md`'s Wildcard section (GDPR consent-checkbox
  visibility, cart-rule-stacking + free-gift interaction, currency-symbol staleness after currency
  deletion) were never actually turned into catalog entries — a synthesis-step miss, not a
  deliberate exclusion.
- Carriers/shipping (24 closed bugs) and combinations/variants (8 bugs, including a cited instance
  of the exact same stock-guard-bypass pattern, `#27871`) have no dedicated properties despite
  bug-density comparable to categories that did get coverage.
- Guest-cart-merge-on-login sits unexamined between two already-covered properties
  (duplicate-line detection and identity-change handling).
- The two-carts-racing-on-the-same-stock-row scenario is named in both `sut-analysis.md` and
  `deployment-topology.md` but has no catalog stub or reachability tag.
- PHP session-file locking could plausibly serialize several of the cataloged client-side races
  (up to 6 properties across 3 categories) — flagged once, locally, in one property's evidence
  file; never elevated as a shared risk to the whole race cluster.

## Biases (escalated to the human — evaluation evidence, not resolved here)

1. **Multistore (22 bugs) and translation/locale (14 bugs) were excluded as "structurally out of
   reach,"** but this may conflate current single-shop/single-language *demo seed data* with an
   actual architectural limit — PrestaShop is natively multistore/multilingual. This is plausibly
   cheaper to address (seed data) than the back-office-auth extension already under consideration.
   **Your call:** is this exclusion final, or worth a quick seed-data feasibility check first?
2. **Extending Bombadil to check `admin-surface-rejects-anonymous-access` (expects 401/403) could
   collide with the existing default `noHttpErrorCodes` property (treats any 4xx/5xx as a
   violation).** Neither of this project's own lenses is positioned to catch new-property-vs-
   existing-default conflicts. **Your call:** worth confirming `noHttpErrorCodes`'s exact scope
   (main-frame navigation only, or all responses?) before adding this property, or scoping the new
   property's fetch calls in a way that's provably outside whatever `noHttpErrorCodes` monitors.
3. **A large fraction of the catalog (5 auth-blocked + 3 not-Bombadil-implementable + several
   needing bespoke probes or seed data) can't run without nontrivial engineering first.** Offered
   as a question, not a claim, given this project's teaching/exploration origin: is the
   back-office-auth investment worth making now, or should near-term effort stay on the ✅-tagged
   properties (10 of 23, all implemented this pass)?

## Implementation Notes (from actually building the ✅-tagged properties)

Beyond the catalog/evidence-file corrections above, building `bombadil/specification.ts` surfaced
one finding worth recording here rather than only in a code comment: **a global `window.fetch`
monkey-patch, used to passively observe organic AJAX traffic, introduced a new
`noUnhandledPromiseRejections` violation** in a live 45-second run (a "Failed to fetch" inside
PrestaShop's own bundled JS) that an equivalent run without the patch did not produce. The likely
mechanism: replacing `window.fetch` with a non-native function breaks a library's own
feature-detection of "real" fetch support, which then takes a different, broken internal path.
This was caught by actually running the test (not just reading the code), and fixed by replacing
the passive interceptor with an active, self-contained probe that only ever *calls* `fetch()`,
never reassigns it. Recorded here because the general lesson — instrumentation that touches a
global the page itself depends on is itself a defect-injection risk — applies to any future
property in this catalog that considers the same technique (e.g., if
`admin-surface-rejects-anonymous-access` or a future XHR-based check is built later).

## Status

13 of 23 cataloged properties are implemented and live-verified. **10** in
`bombadil/specification.ts` (3 clean 45-second runs with `--exit-on-violation`, zero false
positives, after the fetch-patch regression above was found and fixed) — see that file's header
comment for the full list and reasoning. **3** in `tests/session-cookie-properties.spec.js`
(the properties found not implementable via Bombadil at all, since Set-Cookie headers are
invisible to page JS by browser design, regardless of HttpOnly): `session-cookie-lifetime-bounded`
and `duplicate-session-cookie-single-write` currently **fail** on this install, documenting the two
confirmed defects with clear diagnostics; `session-cookie-secure-flag-matches-transport`
**passes**. The remaining 10 are either blocked on the back-office-auth decision (4, after
refinement #2 above) or need a workload extension (seed data, adversarial fill values, or a
funnel-depth increase) not yet built (6).
