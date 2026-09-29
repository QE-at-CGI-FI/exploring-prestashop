---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/PrestaShop/PrestaShop/issues/33306
    why: "FO - Error 500 URL with product id = 0" — the originally-flagged issue for this property class. Validated against current source and found FIXED on develop (and confirmed non-reproducing on this project's own vendored install per tests/regression-bugs.spec.js's 2026-08-14 run notes) — this property is a regression guard extending the same class of check, not a claim that #33306 currently reproduces.
  - path: https://github.com/PrestaShop/PrestaShop/blob/6a22f8e2aacb51b2d83e9965eb50f92d691fd2a0/controllers/front/ProductController.php
    why: Primary evidence that the current fix pattern is `(int)` cast + falsy-check-before-object-construction, read directly via gh api.
  - path: https://github.com/PrestaShop/PrestaShop/blob/6a22f8e2aacb51b2d83e9965eb50f92d691fd2a0/controllers/front/listing/CategoryController.php
    why: Same pattern, but a structurally different (weaker) variant — construct-then-check rather than check-then-construct. Read directly via gh api.
  - path: /Users/maaretp/Documents/cgi-code/exploring-prestashop/tests/regression-bugs.spec.js
    why: "Results as of 2026-08-14" comment block records #33306 as NOT reproducing (returns 404) on the vendored image — the discriminating detail per validating-claims.md.
---

# malformed-identifier-params-degrade-to-4xx

## Lens

Protocol Contracts — malformed/edge-case numeric URL identifiers on storefront detail/listing pages.

## Validation of the originating claim (per references/validating-claims.md)

The discovery brief named issue #33306 ("FO product URL with id=0 returns 500 not 404") as a lead.
Read past the headline:

- `tests/regression-bugs.spec.js` lines 14–16 (results log) explicitly record: **"#33306 — does NOT
  reproduce (returns 404, not 500). Likely fixed since the 2023 report."** The scripted test itself
  (lines 50–53) asserts the *old buggy* behavior (`expect(res.status()).toBe(500)`), by this file's own
  documented convention ("each test asserts the CURRENT (reported-buggy) behavior... FAIL = does not
  reproduce this way") — so this test is expected to currently **fail**, which is itself the
  confirmation that the bug is fixed on this install.
- Reading `ProductController.php` (develop @ 6a22f8e2, lines 122–128, 152–159) confirms the mechanism
  of the fix: `$this->id_product = (int) Tools::getValue('id_product');` (line 127) is cast to `int`
  *before* any object is constructed, and `if ($this->id_product) { $this->product = new Product(...); }`
  (the object is only constructed when the cast value is truthy) followed by
  `if (!Validate::isLoadedObject($this->product)) { ...404...return; }` (lines ~152–159). `id_product=0`
  never reaches `new Product()` at all; it falls straight to the 404 branch.

Conclusion: **#33306 does not belong in the catalog as a currently-reproducing defect.** It is
recorded here only as the historical instance of a property class worth keeping as an ongoing
regression guard, per property-catalog.md's "cross-reference closed issues as regression targets"
guidance — the fix's mechanism (int-cast-then-gate) is not applied uniformly everywhere in the
codebase (see below), so a narrower successor bug in the same family is plausible.

## Why this is still worth a property despite the fix

Two structurally different variants of "load an object by an int ID from the query string" exist in
the two controllers read:

1. **ProductController** (hardened): cast to int, check truthy, *then* construct — `new Product()` is
   never called with `id_product=0`.
2. **CategoryController** (`controllers/front/listing/CategoryController.php`, lines 65–71): casts to
   int (line 68: `$id_category = (int) Tools::getValue('id_category');`) but **constructs
   unconditionally** — `$this->category = new Category($id_category, ...)` (line 71) runs even when
   `$id_category` is 0 or negative, relying entirely on `Validate::isLoadedObject($this->category)`
   *after construction* (confirmed present, ~line 76 onward) to catch the not-found case.

Both patterns currently degrade to 404 correctly for the simple `id=0`/negative/non-numeric cases
(verified: `(int)` cast of `"0"`, `"-5"`, `"abc"`, `""` all yield either `0` or a negative int that
fails to load a row — no crash observed in the reviewed code), but they are **not the same guarantee**:
the second pattern is only as safe as `Validate::isLoadedObject()` being called on *every* exit path,
and as safe as the object constructor never throwing for a given malformed int. This project's own
`bugs.md` #19 / the employee-creation crash (already catalogued elsewhere) is a concrete example of
the *general* pattern — "cast-then-gate" done inconsistently across legacy vs. Symfony/CQRS code paths
— producing a real 500 in a sibling area (back-office employee creation) of the exact same codebase.
That is the generalizable risk this property targets on the *storefront* side.

## What Antithesis should actually fuzz here

Plain `id=0`/negative/non-numeric is confirmed handled. The value of an `Always` property here is
letting Antithesis explore the value classes that manual reading can't practically exhaust, on both
`id_product` (ProductController) and `id_category` (CategoryController) query parameters:

- Array-notation injection: `id_product[]=1` (PHP parses this as an array; `(int)` cast of a non-empty
  array yields `1` with a PHP `Warning: Array to int conversion` — not fatal, but an untested class).
- Numeric strings PHP's int cast handles unusually: leading `+`, leading zeros, internal whitespace,
  scientific notation (`1e2`), hex-looking strings (`0x1A`), decimal strings (`5.9`).
- Out-of-range numeric strings (larger than `PHP_INT_MAX`) — cast behavior for over-range numeric
  strings is float-then-int and can produce surprising values, not verified against this code path.
- `id_product_attribute` combined with a *valid* `id_product` but a combination ID belonging to a
  different product — confirmed **already guarded** by `isValidCombination()` (line 1806:
  `return $productAttributeId > 0 && $productId > 0 && Validate::isLoadedObject($combination) &&
  $combination->id_product == $productId;`), included here only as a documented "already checked,
  don't re-flag" boundary so a future reviewer doesn't re-open it as a gap.
- Multiple conflicting occurrences of the same query parameter (`?id_product=1&id_product=99999999`)
  — PHP's own query-string parser resolves this to "last wins" before `Tools::getValue()` ever runs,
  so this is a PHP-runtime-level behavior, not app logic; noted as low-value to pursue further.

## Invariant and Antithesis angle

- **Type:** Safety (regression guard).
- **Property:** Requesting a product or category detail page with any malformed/edge-case value for
  its numeric identifier query parameter (`id_product`, `id_category`) always yields a 404 (or another
  well-formed 4xx per the page's configured redirect settings), never a 500 or rendered fatal-error
  text — and never a 200 that renders a different, unrelated product/category's data.
- **Invariant (`Always`):** on every navigation to `index.php?controller=product` or
  `index.php?controller=category` (and their friendly-URL equivalents), assert
  `httpStatus in {200 with matching product/category id in the rendered page, 301, 302, 404, 410}` —
  i.e., never `5xx`, and when `200`, the rendered entity's own ID must match the requested one (guards
  against a subtly wrong fallback object being silently rendered instead of a clean not-found). This
  is stronger than the existing generic `noHttpErrorCodes`/`noPhpFatalErrorRendered` because it ties
  the assertion to *this specific parameter class* and adds the "rendered entity matches requested ID"
  check that the generic properties don't attempt.
- **Antithesis angle:** this needs a URL-parameter fuzzer layered onto Bombadil's default navigation
  action generator (mutating `id_product`/`id_category` query values with the classes listed above)
  rather than relying on organic click-through, since a real product/category link in the DOM will
  never itself contain a malformed ID. Antithesis's value is in exhausting the int-cast edge cases
  systematically rather than a human enumerating them by hand.

## Open Questions

- Does Bombadil's action-generator set include arbitrary query-parameter mutation on navigation, or
  only following in-DOM links/forms? If only the latter, this property needs a workload extension (a
  small custom action generator that takes an existing product/category URL and mutates its ID
  parameter) to be reachable at all — it would never fire from organic exploration. `(needs human
  input — workload design decision)`
- What does `(int)` cast do, in this PHP version, for a numeric string exceeding `PHP_INT_MAX` (e.g.
  `id_product=99999999999999999999`)? Not traced into PHP's own casting semantics for this specific
  runtime/version; could plausibly still yield a safe small int, or could differ from other malformed
  classes. `(needs a live probe against the running container, not resolvable from source alone)`
