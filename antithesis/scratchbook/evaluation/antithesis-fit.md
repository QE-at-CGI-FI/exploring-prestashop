---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/prestashop/prestashop
    why: Source used to build the catalog being evaluated; consulted here only to spot-check specific claims when needed.
---

# Evaluation — Lens 1: Antithesis Fit

## Scope and method

Read all 23 properties in `property-catalog.md`, `sut-analysis.md`, `deployment-topology.md`,
`existing-assertions.md`, and `property-relationships.md` in full. Spot-checked
`properties/cart-quantity-can-exceed-stock-via-update-path.md`,
`properties/order-message-lost-on-premature-reload.md`, and
`properties/voucher-code-resubmit-not-double-applied.md` for deeper mechanism context. This lens
asks, per property: does verifying this require exploring a state space deterministic tests
cannot reach (timing, concurrency, partial failure, combinatorial interleaving), or would a fixed
Playwright test with one or two hand-picked inputs fully verify it? Also checks the inverse:
properties whose Antithesis value the catalog undersells.

## Finding 1 (catalog-wide): ~35% of the catalog is deterministic-defect territory, not
fault-injection territory — and the catalog's own text already says so

Eight of 23 properties have confirmed or primary trigger mechanisms that reproduce on a single,
ordinary, non-concurrent action sequence — no race, no interleaving, no fault injection needed —
and in every case the catalog's own "Antithesis Angle" prose explicitly disclaims a timing
dependency rather than me inferring it:

| Property | Catalog's own words disclaiming timing dependence |
|---|---|
| `cart-quantity-can-exceed-stock-via-update-path` | "the server-side branching is unconditional" on any `update=1` request — confirmed in evidence file: any single over-limit update reproduces it every time, not a race |
| `cart-rule-zero-value-discount-saves-silently` | "A configuration/validation-gap property, **not a timing race**" |
| `cart-ajax-success-flag-decoupled-from-errors` | "Bombadil's existing qty +/- fuzzing **already lands** on qty=0" — ordinary fuzzing finds it, not fault injection |
| `category-redirect-target-resolution-crashes-without-active-parent` | "**Not timing-dependent** — a state/config-dependent bug" |
| `order-message-lost-on-premature-reload` | "This isn't really a *timing* race in the concurrency sense — it's a pure ordering/lifecycle gap... Antithesis's role here is less about fault injection..." |
| `session-cookie-lifetime-bounded` | "**Not a race** — a standing regression guard" |
| `session-cookie-secure-flag-matches-transport` | "**Not a race** — a fast localizer" |
| `weak-admin-credentials-blocked-on-auth` | Property is "attempt login with known default credentials, check the result" — a single deterministic action, no timing framing offered anywhere in the entry |

This is not an argument that these are bad properties — several are cheap, valuable regression
guards (e.g. `session-cookie-lifetime-bounded` is "the single strongest finding in this catalog"
per its own priority note) and cost little to run continuously alongside genuine race properties.
But it does mean roughly a third of the catalog's "search budget" framing is doing work that a
fixed integration test would do equally well, and this has a concrete consequence for the
catalog's own stated highest-leverage decision: **two of the five properties gated on the
back-office-auth investment are in this deterministic group** (`cart-rule-zero-value-discount-saves-silently`,
`weak-admin-credentials-blocked-on-auth`). If the human weighing that investment is doing so
partly on the strength of "this unlocks properties Antithesis is uniquely suited to check," they
should know two of the five are actually "this unlocks properties a five-line authenticated
Playwright script would check just as reliably, without needing the Antithesis platform at all."
The other three gated properties (`employee-creation-no-crash-on-race`,
`order-message-lost-on-premature-reload`'s reload-timing-vs-fixed-script distinction is arguably
soft — see above — and `csrf-token-stability-across-identity-change`) are stronger justifications
for the investment on Antithesis-fit grounds specifically.

**Suggested action:** Add an explicit tag or note distinguishing "regression guard, cheap to run
continuously, doesn't need Antithesis's fault-injection engine to trigger" from "genuinely needs
exploration/fault injection to surface" in the catalog, so the back-office-auth cost/benefit
argument and any future search-budget tuning can be made on accurate grounds.

## Finding 2 (catalog-wide, cross-cuts Coverage Balance/Implementability): unexamined assumption
that concurrent client-originated requests are also concurrent server-side

Three properties build their entire premise on two near-simultaneous AJAX requests racing against
each other on the server: `add-to-cart-double-click-no-duplicate-line` ("Antithesis timing
exploration increases the odds of two concurrent add-to-cart AJAX requests racing on the
server-side read-modify-write"), `quantity-stepper-double-click-no-race`, and
`delivery-option-stale-at-payment-confirm`. None of the three, nor `sut-analysis.md`, mention PHP's
default session handling: `session.save_handler=files` acquires an exclusive lock on the session
file for the duration between `session_start()` and `session_write_close()`, which — unless
PrestaShop calls `session_write_close()` early in these specific controllers — would serialize
requests from the same PHP session at the web-server level regardless of how close together the
browser fires them. `delivery-option-stale-at-payment-confirm`'s own Open Questions already raise
exactly this question for its own mechanism ("Whether PHP session-file locking might naturally
serialize the delivery-update and payment-confirm requests, closing the window — not verified"),
but the catalog never generalizes that same unresolved question to the other two properties built
on an identical "two concurrent requests race server-side" premise, and never flags it as a
single, shared, high-leverage investigation (analogous to how the back-office-auth question is
tracked once catalog-wide instead of once per property).

This matters for Antithesis Fit specifically: if session locking does serialize these requests
server-side, the only real race is client-side response-ordering (which response the browser
processes/paints first) — still a legitimate Antithesis target via asymmetric network
latency/reordering, but a materially different mechanism than "the server-side read-modify-write
isn't atomic," which is how `add-to-cart-double-click-no-duplicate-line` currently frames its "Why
It Matters." Getting this right changes which fault type (client-side response delay/reorder vs.
server-side concurrent-write corruption) the property should be described as targeting, and
whether server-side atomicity is even a meaningful thing to assert on at all here.

**Suggested action:** One investigation (read PrestaShop's session bootstrap, e.g.
`Session`/`Context` initialization and whether `CartController`/checkout controllers call
`session_write_close()` before their slow work) resolves this for all three properties at once —
same shape as the catalog's own back-office-auth catalog-wide question.

## Finding 3 (catalog-wide, inverse check): input-space fuzzing properties are underpriced
relative to their fit

`extreme-quantity-input-does-not-corrupt-cart` and `malformed-identifier-params-degrade-to-4xx`
are the catalog's clearest instances of "combinatorial input-space exploration" — the lens's
fourth explicitly-named Antithesis strength — yet both are pitched at Medium priority and framed
primarily through their relationship to an already-confirmed sibling bug (`cart-quantity-can-exceed-stock-via-update-path`
for the former; "simple cases already confirmed safe" for the latter) rather than through their
own combinatorial-fuzzing value, which doesn't depend on any known bug existing at all — the whole
point of fuzzing adversarial numeric/ID values is finding classes of input nobody has thought to
name yet. Framing their value as derivative of a known bug undersells the case for prioritizing
them, since Antithesis's actual comparative advantage here (vs. a human writing five boundary-value
unit tests) is trying values nobody enumerated, which is precisely what "simple cases already
confirmed safe" is not evidence against.

**Suggested action:** Consider re-framing (not necessarily re-prioritizing) these two properties'
"Why It Matters" around their fuzzing value independent of the sibling bug, to avoid the priority
looking anchored to "is there already a known bug here."

## Finding 4 (catalog-wide): the lens's named flag ("a `Sometimes` needing astronomically unlikely
timing") has no instances to check, because there are no `Sometimes` assertions at all

The catalog contains zero `Sometimes` and zero pure `Reachable` invariants — every property is
`Safety`/`Always` or `AlwaysOrUnreachable`. This is squarely Coverage Balance's named check (missing
property types), so the full analysis lives in that evidence file, but it's worth flagging here too
because it means this lens's specific "wrong assertion type for the testing mode" flag is
structurally unable to fire in one direction (no `Sometimes` exists to be miscalibrated) while the
opposite failure mode — an `Always` that can never observe its own precondition and would pass
vacuously — is live. See Finding 5.

## Finding 5 (property-specific): `cart-quantity-can-exceed-stock-via-update-path` risks vacuous
passing, and the catalog already noticed without acting on it

This property's own evidence file asks: "Should the invariant instead be framed as
`Sometimes(error is shown)` to confirm the error state is ever reached at all... the error may
rarely or never trigger without a deliberately low-stock seed product" — and leaves this as an open
question rather than adding the companion property. As currently specified (`Always`, guarded on
"whenever such an error is visible"), if the availability-limit error is never shown during a run
(plausible on a fresh install with default-quantity stock), the property is vacuously satisfied
every time — Antithesis has no way to distinguish "checked and always held" from "never got the
chance to check." This is exactly the failure mode the lens's guidance describes for
`Always`-without-`Reachable` pairing.

**Suggested action:** Add a paired `Reachable` (or `Sometimes`) property asserting the
availability-limit error state is actually reached at least once per sufficiently long run, once a
low-stock seed product exists in the workload's initial state. `extreme-quantity-input-does-not-corrupt-cart`
shares the same seed-data dependency and would benefit from the same companion property.

## Finding 6 (property-specific): `price-formatting-consistent-across-pages` is a borderline case
the catalog doesn't resolve

The property is explicitly framed as "not a timing property... value comes from page/code-path
breadth." That framing is honest, but it leaves open whether Bombadil's autonomous exploration
actually visits a meaningfully larger set of distinct price-rendering code paths (product list,
detail, cart line, cart total, checkout summary, discounted vs. original price, tax-included
toggle) than a hand-written crawl of ~10-15 fixed page types would. If the set of distinct
code paths is small and enumerable — which it plausibly is for a single storefront theme — a fixed
integration test achieves equivalent coverage at a fraction of the cost, and this property's
value from Antithesis specifically (vs. as a `tests/` Playwright check) is genuinely unclear rather
than confidently one way or the other. Recorded as an Uncertainty below rather than a firm flag,
because resolving it needs empirical data (how many distinct price-render sites exist in the
current theme) that this evaluation pass doesn't have.

## Finding 7 (property-specific): `admin-surface-rejects-anonymous-access`'s Antithesis-fit
justification looks stretched relative to its confirmed mechanism

The property is confirmed *currently correct* (live-tested, no leak) and is explicitly a
regression guard. Its "Antithesis Angle" proposes "timing pressure on the auth-check itself
(DB/cache lookup gating these controllers) — same class of risk as the confirmed employee-creation
defect." Unlike `employee-creation-no-crash-on-race`, there is no source-confirmed mechanism here
for a race in the auth check itself — this reads as a plausible-sounding analogy rather than a
grounded finding, and the property would be just as well served (and just as honestly described)
as a standing correctness assertion that benefits from Antithesis's broad exploration reaching the
admin/API paths at all (a reachability problem, per its own 🔧 tag) rather than from timing
pressure on the check.

**Suggested action:** Either find/cite a concrete mechanism for a timing-sensitive auth check here,
or drop the timing-pressure framing and describe this property's Antithesis value accurately as
"reaches an otherwise-unlinked URL, then applies a cheap standing assertion" — still worth keeping,
just not for the reason currently given.

## Passes

- The strongest race/ordering properties are well-matched and self-aware about *why* Antithesis
  specifically (vs. a fixed test) adds value: `employee-creation-no-crash-on-race` ties network
  latency injection directly to widening a window that today triggers "by luck/speed alone" — the
  clearest textbook fit in the catalog.
- `address-form-stale-country-response` and `delivery-option-stale-at-payment-confirm` correctly
  target genuine out-of-order-response races needing asymmetric latency/reorder fault injection
  specifically, a materially harder-to-hit fault type than mere rapid clicking, and correctly
  identified as such.
- `csrf-token-stability-across-identity-change` self-corrects a naive framing (staleness from time
  passing) to the actual source-grounded mechanism (staleness only from an identity change) —
  evidence of real rigor rather than an assumed race.
- The catalog is unusually transparent about which properties are *not* timing-dependent
  (`order-message-lost-on-premature-reload`, `session-cookie-lifetime-bounded`,
  `session-cookie-secure-flag-matches-transport`, `category-redirect-target-resolution-crashes-without-active-parent`)
  — this self-labeling made Finding 1 straightforward to build directly from the catalog's own
  words, and is worth preserving as a practice.

## Uncertainties

- Whether PHP session-file locking is actually in effect and whether PrestaShop calls
  `session_write_close()` early in the cart/checkout controllers (Finding 2) — would require
  reading PrestaShop's session bootstrap source, out of scope for this evaluation-only pass.
- Whether Bombadil's click-repeat timing can realistically produce two requests close enough
  together to be "concurrent" in any sense (server-side or client-side-response-ordering) before
  fault injection is added — depends on Bombadil framework internals not reviewed here.
- Whether the set of distinct price-rendering code paths in the current theme is small enough that
  a fixed crawl would match Bombadil's exploration coverage for `price-formatting-consistent-across-pages`
  (Finding 6) — needs empirical inspection of the theme, not just the property text.
