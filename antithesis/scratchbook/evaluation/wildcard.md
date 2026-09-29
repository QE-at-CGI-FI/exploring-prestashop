---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/prestashop/prestashop
    why: Source used to build the catalog being evaluated; consulted here only to spot-check specific claims when needed.
---

# Wildcard Evaluation — Property Catalog

## Method and scope

Read the full catalog, SUT analysis, deployment topology, existing assertions, property
relationships, `bombadil/specification.ts`, Bombadil's public API surface (`node_modules/@antithesishq/bombadil/dist/**/*.d.ts`),
and a sample of property evidence files. Received one-line summaries of the other two lenses
running in parallel: Lens 1 (Antithesis Fit) evaluates sweet-spot fit vs. unit/integration-test
territory; Lens 2 (Coverage Balance) evaluates the property set as a portfolio against the SUT
analysis. This lens deliberately avoids their territory — no findings below are about "is this
property individually testable by a unit test" (Lens 1) or "is this risk area under/over-represented"
(Lens 2) in isolation. This lens also avoids restating raw observability mechanics already covered
in depth by the Implementability lens (e.g., the cookie-header/HttpOnly wall); where a wildcard
finding touches that territory, it's because the finding is about a *different formulation* the
other lens wasn't positioned to propose, not about re-litigating what's infeasible.

## Findings

### W1 (catalog-wide, systemic): PHP session-locking may collapse the entire "same-session race" super-cluster, and this risk is visible in only one property's Open Questions instead of being recognized as cross-cutting

**Properties affected (potentially):** `employee-creation-no-crash-on-race`,
`address-form-stale-country-response`, `delivery-option-stale-at-payment-confirm`,
`add-to-cart-double-click-no-duplicate-line`, `quantity-stepper-double-click-no-race`, and
indirectly `csrf-token-stability-across-identity-change` — six properties spanning three of the
catalog's four categories.

PHP's classic session mechanism acquires an exclusive lock on the session data store for the
duration of a request that calls `session_start()`; a second, concurrent request presenting the
*same* session cookie blocks at the PHP layer until the first request finishes (or explicitly
calls `session_write_close()` early). If PrestaShop's custom `SessionHandler`
(`src/Core/Session/SessionHandler.php`, read directly in this project's own
`session-cookie-lifetime-bounded.md` evidence) preserves this locking discipline, then every
"two near-simultaneous requests from the same browser tab" race this catalog is counting on —
double-clicking add-to-cart, submitting a form before a dependent AJAX call resolves, racing a
delivery-update POST against a payment-confirm POST — may be serialized at the PHP session layer
regardless of how aggressively Antithesis perturbs client-side or container-level timing. The race
window these properties assume exists at the browser/network layer could be closed by something
neither Bombadil nor the planned container-level fault injection touches at all.

This is flagged **exactly once**, locally, in `delivery-option-stale-at-payment-confirm`'s Open
Questions: "Whether PHP session-file locking might naturally serialize the delivery-update and
payment-confirm requests, closing the window — not verified." Nothing elevates this to a
catalog-wide risk, even though the same mechanism (if it applies) would affect at minimum five
other properties that all depend on it identically. This is precisely a "combination of conditions
no single lens would construct" (per this lens's directive): each property's own discovery pass
saw only its own local instance of "will the race window actually be open," because the properties
are filed under different clusters (pricing, checkout-lifecycle, back-office-race) that never
compared notes.

**Cross-cut / suggested action:** This is cheap to resolve before investing further build effort
in the race-shaped properties — one source-reading pass on whatever storage backend
`SessionHandler.php` actually uses (and whether it calls `session_write_close()` early anywhere in
PrestaShop's front-controller bootstrap) would confirm or rule this out for the whole cluster at
once, rather than being re-discovered piecemeal as each property is implemented and quietly fails
to reproduce.

### W2 (cross-cut with Implementability): The cookie-mechanics cluster has a feasible alternate formulation the "expand Bombadil" framing never considered — because the properties' own evidence already used it

**Properties:** `session-cookie-lifetime-bounded`, `duplicate-session-cookie-single-write`,
`session-cookie-secure-flag-matches-transport`.

This is the concrete instance of this lens's required cross-cut: "a property Antithesis Fit would
call high-value but Implementability would call infeasible — is there a different formulation
that's both?" The Implementability lens (this same pass) establishes that these three properties'
stated mechanisms (parsing `Set-Cookie` headers and their attributes) cannot be implemented through
Bombadil's documented `extract()`/`state.document` API — the cookies in question are `HttpOnly`,
invisible to JS entirely, and even non-`HttpOnly` cookie attributes aren't exposed by
`document.cookie`. These are exactly the kind of subtle, easy-to-miss defects (a
unit-mismatch producing a 56-year cookie lifetime; a duplicate `Set-Cookie` write) that a fresh
pass would rate as high-value findings worth continuously guarding.

The alternate formulation is sitting in plain sight: every one of these three properties'
evidence files reproduced and confirmed the defect using a raw `curl -s -D -` request, not
Bombadil. The project's own investigative method already proves the right tool for this specific
signal is a raw HTTP client, not a browser-automation tool constrained to what JavaScript can see.
Implementing these three checks as a small standalone script (or a lightweight non-Bombadil step in
the same `bombadil-client` container, or a separate assertion step in CI) run against the same
`prestashop` container would preserve the value Lens 1 would likely assign these properties while
sidestepping the observability wall entirely. The SUT analysis and catalog frame "Antithesis's role
in this project... is specifically expanding the Bombadil storefront property set" — a framing
that, taken literally, forces these three properties into a tool that structurally can't check
them, when the project's own prior work already demonstrates a tool that can.

**Suggested action:** Treat "must be a Bombadil `extract()`/`always()` property" as a default, not
a hard constraint from the discovery brief — carve these three out as a small
raw-HTTP-client-based check (could still run as a step alongside the Antithesis workload) rather
than either forcing them into Bombadil or dropping them for infeasibility.

### W3: A common, everyday usage pattern — the same shopper, two browser tabs, one cart — is structurally unrepresented, distinct from the already-acknowledged cross-session race gap

`sut-analysis.md`'s Concurrency Model section and `deployment-topology.md`'s Out-of-scope section
both explicitly flag and defer one concurrency gap: two *different* customers/sessions racing on
the same product's stock, which would need a second `bombadil-client` replica. That gap is
correctly named and correctly deferred.

A different, much more mundane usage pattern is never named at all: the *same* shopper, in the
*same* session/cart (same `PHPSESSID`), with two browser tabs open — e.g., adjusting quantity in a
cart tab while a product page is open in another tab, or double-submitting a voucher code because
a second tab was left on the checkout page. This needs no second identity, no second container,
and no stock contention — just two concurrent requests sharing one session, which is common real
shopper behavior and could produce exactly the cart-badge desync or double-voucher-application
several existing properties already worry about (`cart-state-survives-history-navigation`,
`voucher-code-resubmit-not-double-applied`), but from a different, unmodeled trigger.

It is nonetheless structurally out of reach for the *current tool*, independent of the topology's
single-client-replica decision: Bombadil's public `Action` type
(`dist/browser/index.d.ts`) has no "open a new tab/context" primitive — only in-page actions plus
Back/Forward/Reload/Wait. So even though this scenario needs no new container, it needs a
capability (multiple concurrent contexts within one identity) that isn't in the tool's documented
action set either.

**Suggested action:** Name this explicitly as a distinct, currently-unaddressed gap in any future
discovery/topology pass — worth checking whether Bombadil supports multiple tabs/contexts within a
single test run at all before assuming a second container is the only way to reach any multi-request
scenario.

### W4: Extending Bombadil's frontier to admin/webservice paths (for `admin-surface-rejects-anonymous-access`) would put a property that *expects* 4xx as correct onto the same run as the existing global default that (apparently) treats any 4xx/5xx as a violation

`admin-surface-rejects-anonymous-access`'s entire premise is that landing on a 401/403/redirect at
`/admin-dev/`, `/api/`, `/webservice/` is the *correct*, passing outcome. The project's existing
baseline property `noHttpErrorCodes` (re-exported from Bombadil's defaults in
`bombadil/specification.ts`, and referenced throughout `sut-analysis.md`/`property-catalog.md` as
catching "any 4xx/5xx") is, by every description of it in this project's own documents, a coarse,
global "no HTTP errors anywhere in the run" check. If that description is accurate (flagged as
unconfirmed against source — see Implementability's Uncertainties), then implementing the
URL-frontier extension this property needs would make the pre-existing, already-running baseline
property fail on **every single test run** the moment Bombadil is pointed at those paths, since a
401/403 there is exactly what the new property wants to see and exactly what the old property is
built to flag.

Neither Coverage Balance (which looks at the catalog's properties as a portfolio) nor
Implementability (which checks each property against the topology) is naturally positioned to catch
this, because the conflict is between a *new* catalogued property and an *existing*, already-running
default that predates the catalog entirely — a structural interaction the catalog-authoring process
never had a checkpoint for.

**Suggested action:** Before implementing this property's workload extension, explicitly resolve
whether `noHttpErrorCodes` can be scoped to exclude `/admin-dev/`, `/api/`, `/webservice/`, or
whether the two properties need to be reconciled some other way (e.g., a wrapped/narrowed version
of the default for use once the frontier is extended).

### W5: "Structurally out of reach" for multistore/translation may be conflating demo-data seed state with architectural limitation

`sut-analysis.md`'s Bug History section and `property-catalog.md`'s catalog-wide Open Questions
both dismiss multistore (22 closed bugs) and translation/locale (14 closed bugs) — 36 issues
combined, more than the cart-rules/discounts category (7) that got a dedicated cluster — as
"structurally out of reach for a single-shop, no-webservice, single-language Bombadil deployment."

PrestaShop is natively multistore- and multilingual-capable software; "single-shop,
single-language" describes the *current demo data/seed state* of the vendored image as configured
in this project, not an inherent architectural ceiling on what the storefront Bombadil drives could
expose. This matters because the catalog is *already* seriously considering nontrivial workload
investment elsewhere (a back-office-auth extension affecting 5 properties, several bespoke custom
navigate actions) — against that backdrop, "seed a second shop or a second active language in the
DB" is not obviously more expensive than those, and might be considerably cheaper (a data/config
change vs. new driver code), yet it was never evaluated as an option before the 36-issue territory
was set aside.

**Suggested action:** Before permanently filing multistore/translation as out of scope, get an
explicit answer to "is this excluded because Bombadil structurally cannot reach a second
shop/language once one is configured, or only because none is configured in this deployment's
current seed data?" — the two have very different costs to fix.

### W6 (soft observation on framing, not a technical finding): the catalog's actionable-today slice may be smaller than a first pass through it suggests, in tension with this project's apparent teaching/exploration purpose

`sut-analysis.md` cites `sessions/session2.md` as "the origin of this exercise ('try this with
bombadil and antithesis property skill')" — this project reads as an explicit teaching/exploration
exercise in applying Antithesis's property-discovery workflow, not (only) a production QA
engagement. Combined with the Implementability lens's findings, a meaningful share of the
catalog — the 5 back-office-auth-blocked properties, the 3 cookie-mechanics properties (blocked
outright per Implementability Finding 1), the 2 properties needing bespoke custom navigate actions,
and the 2-3 properties needing an undetermined seed-data mechanism — cannot actually run without
nontrivial new engineering first. If the near-term goal is "see Antithesis catch something," a
catalog front-loaded this heavily with build cost before payoff is worth naming as a possible
priority mismatch, separate from whether any individual property is well-reasoned (most are). This
is speculative about intent (this lens cannot confirm the project's actual near-term goal) and is
offered as a question for the human, not a claim.

## Passes

- The catalog-wide framing of "one decision (back-office auth) unblocks the largest single group
  of properties" is directionally right for 4 of the 5 properties it names (all but
  `csrf-token-stability-across-identity-change`, addressed in the Implementability evidence file) —
  a reasonable prioritization instinct even where one member is misassigned.
- `property-relationships.md`'s "submit-before-async-resolves" cluster correctly identifies a real,
  recurring architectural pattern (typed/legacy boundary trusts an unconfirmed async write) across
  independently-discovered properties — exactly the kind of cross-cutting pattern this lens looks
  for, already caught by the discovery process itself.
- The catalog-wide Open Questions section already proactively flags the multistore/translation
  exclusion as "acknowledged rather than filled," which is more self-aware than simply omitting it
  — W5 asks a sharper question about *why* it's excluded, not whether the exclusion was noticed.
- The single-`bombadil-client`-replica, cross-session-stock-race gap is well-documented and
  correctly distinguished from a property this catalog claims to cover — it isn't silently dropped.

## Uncertainties

- Whether PrestaShop's `SessionHandler.php` (or PHP's session layer as PrestaShop configures it)
  actually preserves exclusive-lock-per-session semantics, or whether PrestaShop calls
  `session_write_close()` early enough in its bootstrap to avoid the serialization W1 describes.
  Not traced in this pass or (per its evidence file) in the property discovery pass either.
- Whether `noHttpErrorCodes`'s actual behavior matches the "any 4xx/5xx anywhere is a violation"
  characterization this catalog and SUT analysis repeat throughout their text (W4 depends on this).
  Only its type signature was available, not its implementation.
- Whether Bombadil supports multiple browser tabs/contexts within a single workload run at all
  (W3) — not documented in the public `.d.ts` files reviewed, and not something this pass could
  test directly (would require running Bombadil against a live target, outside this evaluation's
  scope).
- How much of the multistore/translation exclusion (W5) is genuinely architectural vs. a seed-data
  artifact — would require inspecting the vendored image's actual default shop/language
  configuration, not done in this pass.
