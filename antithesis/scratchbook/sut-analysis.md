---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/prestashop/prestashop
    why: This repo vendors prestashop/prestashop:latest with no local copy of the application source. Used to confirm the real mechanism behind candidate properties (e.g. the employee-creation crash below) before treating a local repro or a GitHub issue as a system defect.
  - path: bugs.md
    why: First-pass manual exploratory testing findings on a fresh install (touring home → search → category → product → cart → admin).
  - path: closed-bugs-last-year.md
    why: Categorized analysis of PrestaShop's last 12 months of closed `Bug` issues (937 total). Used to weight property discovery toward high-density bug areas.
  - path: tests/regression-bugs.spec.js
    why: Scripted regression checks against this install; distinguishes which known GitHub issues still reproduce on the vendored image vs. which are already fixed.
  - path: sessions/session1.md
    why: Exploratory testing session notes — install/setup experience, initial bug tour.
  - path: sessions/session2.md
    why: Exploratory testing session notes — bug-density analysis of the GitHub tracker, and the origin of this exercise ("try this with bombadil and antithesis property skill").
---

# SUT Analysis — PrestaShop storefront + back office (this teaching/exploration project)

## What this project actually tests

This repo does **not** contain PrestaShop's application source. It vendors the official
`prestashop/prestashop:latest` Docker image (see `compose.yaml`) and drives it three ways:

- `tests/` — scripted Playwright specs (smoke tests + `regression-bugs.spec.js`, which
  re-checks specific known GitHub issues against a fresh install)
- `bombadil/specification.ts` — Bombadil, autonomous property-based browser exploration of
  the **storefront** (default action generators: click, fill, scroll, navigate, back/forward/reload)
- `schemathesis/` — Schemathesis, property-based testing of the **Admin API**
  (`ps_apiresources`, OpenAPI/OAuth2), via a separate TLS-proxy overlay (`compose.admin-api.yml`)

Antithesis' role in this project, per the scope this research targets, is specifically
**expanding the Bombadil storefront property set**. The SUT for that purpose is the
storefront (and, to the extent Bombadil's default action generators wander into it, the back
office) as served by the vendored image — a PHP 8 / Symfony (partial migration from a legacy
MVC core) monolith backed by MySQL 8, run as a single Apache+PHP process per `compose.yaml`.

**Version drift caveat (open question, catalog-wide):** `tests/regression-bugs.spec.js` records
the installed image as PS 9.1.4 as of 2026-08-14; `prestashop/prestashop:latest` will drift
forward over time and this repo has no pin. Properties below that cite a specific PrestaShop
source file (from the `develop` branch, fetched via `gh api`) should be treated as "confirmed
against develop, assumed present in the currently-running tag" unless separately re-verified —
develop and the running tag can differ.

## Architecture and Data Flow (Focus 1)

- Single `prestashop` container (Apache + PHP-FPM/mod_php) + single `db` container (MySQL 8),
  networked over the default compose bridge network (`compose.yaml`). No cache layer, no queue,
  no separate search service in this deployment (PrestaShop ships a faceted-search module that
  uses MySQL directly in this configuration, not Elasticsearch).
- Two front doors on the same PHP process: the **storefront** (legacy `index.php` controllers,
  e.g. `product`, `cart`) and the **back office** at `/admin-dev/` (increasingly Symfony —
  `src/PrestaShopBundle`, `src/Adapter`, `src/Core` — with legacy classes like `Cart`, `Profile`,
  `Employee` still authoritative for core data access). This split matters for property discovery:
  the legacy front controllers (`#33306`, product id=0 → 500) and the Symfony back-office command
  handlers (the employee-creation crash below) fail in different ways for the same underlying
  cause (missing input validation before a typed/legacy boundary).
- `compose.admin-api.yml` adds a Caddy TLS-terminating proxy (`admin-api-tls`) in front of the
  same `prestashop` container, because the Admin API's `SSLMiddlewareListener` hard-requires
  HTTPS + TLS 1.2+ outside Symfony debug mode. Irrelevant to Bombadil (storefront, plain HTTP)
  but relevant if this scratchbook is later reused for an Admin-API-focused pass.

## State Management and Persistence (Focus 2)

- All durable state lives in MySQL (`ps_*` tables) — cart, cart rules, orders, stock,
  employees, tokens. No Redis/Memcached in this deployment; PrestaShop's cache layer (when
  configured) falls back to filesystem cache, which is inside the single `prestashop`
  container's ephemeral storage.
- **Two independently-rendered views of the same cart-count state** (confirmed by the existing
  Bombadil properties): the header badge (`.header-block__badge`) and the "Added to your cart"
  modal (`#blockcart-modal`) sentence. One is likely rendered server-side on next page load, the
  other via the AJAX response of the add-to-cart action itself — two paint paths for one number,
  a classic desync surface. The existing properties only check these two against each other, not
  against a subsequent authoritative reload of the cart page.
- Sessions: `bugs.md` #12–13 already found the storefront sets a duplicate `Set-Cookie` for the
  `PrestaShop-<hash>` session cookie in a single response (two different values) and issues
  `PHPSESSID` with a ~65-year expiry. Both are observable from the browser/HTTP layer, i.e.
  exactly what Bombadil can check without SUT-side instrumentation.

## Concurrency Model (Focus 3)

- No in-process concurrency in the SUT worth modeling (synchronous PHP request/response, one
  request per Apache worker). The concurrency surface Bombadil can actually exercise is
  **client-side races**: double-clicking add-to-cart / quantity +/- before the AJAX response
  lands, submitting a form before a dependent AJAX call (e.g. the profile → "Default page"
  dropdown refresh) resolves, or reloading mid-request. `tests/regression-bugs.spec.js`'s own
  comment on the employee-creation bug is a concrete instance of exactly this pattern turning
  into a server-side crash — see "Confirmed defect" below.
- MySQL-level races (e.g. two carts decrementing the same stock row) are real in principle but
  not observable to a single-browser-session Bombadil workload without a second concurrent
  session; flagged as a gap for `deployment-topology.md` / future workload design rather than a
  property to add now.

## Safety Guarantees Claimed by the System (Focus 4)

PrestaShop's docs/comments don't state formal safety invariants the way a database or consensus
system would, but the product implicitly claims several things a shopper would rely on:

- The displayed cart total (badge, modal, cart page, checkout) always reflects the actual cart
  contents — never negative, never stale, never inconsistent between renderings. (Already
  partially covered by existing Bombadil properties.)
- A displayed price is the price that will be charged at checkout (no client-visible/server
  mismatch introduced by currency, tax, or discount recalculation).
- Out-of-stock or quantity-limited products cannot be added past their limit through the
  storefront UI.
- Server-side validation errors are surfaced as validation errors, not as fatal errors —
  i.e., bad input from the browser degrades to a form error, not a 500.

These are exactly the kind of "obvious, unstated" guarantees `references/property-catalog.md`
asks to make explicit and testable rather than assumed. Per `references/validating-claims.md`,
they are treated below as claims to test, not facts.

## Liveness Guarantees (Focus 5)

Largely not applicable to a single-process storefront in this deployment shape (no failover,
no queue to drain). The one liveness-flavored guarantee worth noting: after an add-to-cart or
checkout-step action, the UI *eventually* reflects the new state without requiring a manual
reload — Bombadil's `reload` action generator can help confirm this isn't silently relying on
stale client-side state.

## Bug History and Density (Focus 6)

`closed-bugs-last-year.md` (937 closed `Bug` issues, last 12 months, 572 actively closed / 365
stale-bot-closed) gives a categorized hotspot map. By count: **calculation/pricing/tax (47,
largest category)**, display/UI (36), install/upgrade (34), crash/fatal (33), carriers/shipping
(24), stock/quantity (23), multistore (22), import/export/API (21), module-specific (27),
permissions/auth (17), translation/locale (14), save/persist (11), email (10),
combinations/variants (8), cart rules/discounts (7).

Three caveats carried forward from `references/validating-claims.md` discipline:

1. This is a **closed-issue** density map, not a confirmed-defect map — "closed" includes
   "not a bug," "user error," and stale-bot closures alongside real fixes. It tells us where
   PrestaShop *maintainers spend triage attention*, which is a reasonable proxy for where
   real complexity/fragility lives, but individual issues in it are still leads, not facts.
2. Multistore (22) and import/export/webservice (21) are largely out of reach for a
   single-shop, no-webservice-configured Bombadil deployment — noted as scope gaps, not
   ignored.
3. Cart rules/discounts is a *small* raw count (7) but structurally overlaps the much larger
   calculation/pricing/tax category (many pricing bugs are cart-rule interaction bugs), and
   this project already has a **confirmed, currently-reproducing** defect there (`#38072`,
   below) — so it's weighted higher than its raw count suggests.

### Confirmed defect used as a regression-target property (validated per validating-claims.md)

**Employee creation crashes with an uncaught `TypeError` instead of a validation error, if the
form is submitted before the profile-scoped "Default page" AJAX call resolves.**

This was found *incidentally* while scripting `tests/regression-bugs.spec.js` (not filed
upstream) and is exactly the kind of race Antithesis is good at forcing. Root cause confirmed
by reading the actual PrestaShop source (`develop` branch, fetched 2026-09-29 via
`gh api repos/PrestaShop/PrestaShop/contents/...`), not just the local repro:

- `AbstractEmployeeHandler::assertHomepageIsAccessible(int $tabId, int $profileId): void`
  (`src/Adapter/Profile/Employee/CommandHandler/AbstractEmployeeHandler.php`) declares
  `$tabId` as a non-nullable `int` parameter.
- `AddEmployeeHandler::handle()` calls it as
  `$this->assertHomepageIsAccessible($command->getDefaultPageId(), $command->getProfileId())`
  (`AddEmployeeHandler.php:74`).
- `AddEmployeeCommand::__construct()` (`src/Core/Domain/Employee/Command/AddEmployeeCommand.php`)
  takes `$defaultPageId` **without a type hint and without casting it** —
  `$this->defaultPageId = $defaultPageId;` — so whatever the controller passes through survives
  unchanged (contrast with the *edit* path, `EmployeeFormDataHandler`, which explicitly does
  `->setDefaultPageId((int) $data['default_page'])` before building its command).
- If the "Default page" `<select>` hasn't been repopulated yet (it's refetched via AJAX scoped
  to the chosen profile — see the comment in `tests/regression-bugs.spec.js`), the submitted
  `default_page` form value can be missing/empty, which flows through uncast on the **add**
  path and arrives at `assertHomepageIsAccessible()` as `null` — a value PHP will not silently
  coerce into a non-nullable `int` parameter, producing an uncaught `TypeError` (HTTP 500)
  instead of the validation error a malformed form field should normally produce.
- This confirms the discriminating detail `references/validating-claims.md` requires: the *add*
  path lacks the `(int)` cast the *edit* path has, and the assertion's parameter is genuinely
  non-nullable in the currently-published source — this is a real, narrow defect in the add-employee
  flow, not an environment/config issue on this install.

This becomes property `employee-creation-no-crash-on-race` in the catalog.

## Existing Test Strategy (Focus 7)

- Playwright (`tests/prestashop.spec.js`, `regression-bugs.spec.js`): scripted, fixed-path,
  fixed-data. Confirms/refutes specific known issues; does not explore.
- Bombadil (`bombadil/specification.ts`): autonomous exploration + 3 continuously-checked
  properties (cart badge non-negative, modal/badge agreement, no rendered PHP fatal). This is
  the target this research expands.
- Schemathesis (`schemathesis/`): property-based fuzzing of the Admin API's OpenAPI schema —
  out of scope for Bombadil (browser-only) but establishes that "generic correctness properties
  over generated inputs" is already the house style for API-shaped surfaces; the storefront
  equivalent (Bombadil) is comparatively under-specified (3 properties vs. Schemathesis's
  schema-wide generic checks).
- No unit/integration test suite is part of this repo (it tests the vendored image as a black
  box); no chaos/fault-injection testing exists yet — that gap is exactly what wiring this
  project into the actual Antithesis platform (vs. local `npx bombadil browser test`) would add:
  container-level faults (node hang/throttle, network latency/partition — see
  `references/faults.md`) around the same Bombadil workload and property set.

## Failure and Degradation Modes (Focus 8)

- `noHttpErrorCodes` and the custom `noPhpFatalErrorRendered` property (existing) are the only
  current backstops against the SUT degrading into visible breakage. Both are coarse (any
  4xx/5xx, any fatal-error text anywhere) — good baseline safety nets, but they don't localize
  *which* user action caused the failure, so a new fatal-error class would show up as "a fatal
  error happened somewhere during this run" rather than pointing at add-to-cart, checkout, or
  search specifically. Property discovery should look for narrower, action-scoped variants
  where the evidence supports it.
- `bugs.md` #19 (now formally reproduced as the confirmed defect above) is the one first-hand
  example of the SUT degrading ungracefully (crash instead of validation error) under a timing
  condition — exactly Antithesis's sweet spot per `references/sut-analysis.md` ("Antithesis's
  Superpower Is Timing").

## External Dependencies and Integration Points (Focus 9)

- MySQL is the only real dependency in this deployment. No outbound calls are exercised by the
  Bombadil default action set (no payment gateway, no email, no third-party API) — those exist
  in PrestaShop but aren't reachable through unauthenticated storefront browsing, so they're out
  of scope for this property set.

## Product Context (Focus 10)

- The properties that matter most to a real shopper, in descending order of "how bad is a bug
  here": (1) the cart total / price shown is what gets charged, (2) checkout completes or fails
  with a clear reason, never silently, (3) search/browse surfaces the right products, (4) the
  page doesn't visibly break. This ordering is reflected in the priorities assigned in
  `property-catalog.md`.

## Unproven Assumptions (Focus 11)

- The add-employee crash (above) is one instance of a pattern worth generalizing: **any form
  whose options are populated by a profile/context-scoped AJAX call assumes the call completes
  before submission is possible.** Nothing in the reviewed source enforces that ordering
  client-side (no disabling of Save until the AJAX call resolves). The employee form is the one
  instance validated so far; whether the same pattern exists on other dependent-dropdown forms
  in the back office is an open question (see below) — Bombadil's storefront-only default action
  generators wouldn't reach the back office at all unless the workload is extended to log in
  and drive `/admin-dev/`, which is itself an open scoping question for this catalog.
- The storefront assumes the two cart-count render paths (badge vs. modal) stay in sync by
  construction; nothing found so far enforces this beyond "both queries currently agree."

## Wildcard (Focus 12)

- **Reload/back/forward as an accidental fuzzer.** Bombadil's *default* action generators
  already include reload and browser back/forward — these are exactly the actions most likely to
  catch cart/session desync (a stale bfcache page showing an old cart badge next to a live add
  action) without any new property authorship, just by running longer. Property discovery should
  make sure at least one property explicitly targets *post-navigation* consistency (state after
  back/forward/reload), not just single-page-load consistency.
- **The project's own bug-tracking artifacts are, structurally, an existing-assertions surface.**
  `bugs.md` and the "documented but not scripted" section at the bottom of
  `regression-bugs.spec.js` are effectively a backlog of un-encoded properties. Several (the
  GDPR consent-checkbox visibility bug, the cart-rule stacking + free-gift interaction, the
  currency-symbol staleness after currency deletion) are storefront/back-office interactions
  Bombadil could in principle stumble into, but none require exotic setup beyond what a slightly
  richer initial-state workload (a second currency, an active cart rule) could provide — flagged
  as candidate properties below, each validated against upstream source before being catalogued.
- **Bombadil currently never logs in.** All 3 existing properties (and the default action
  generators) operate against the storefront as an anonymous visitor. A large share of the
  bug-density map (permissions/auth, save/persist, multistore, employee handling) is
  back-office-only and structurally unreachable to the *current* Bombadil configuration. This is
  a coverage/topology question for the human, not something property discovery alone can resolve
  — flagged as an open question below and echoed in `property-relationships.md`.

## Open Questions

- Should the Bombadil workload be extended to also drive the authenticated back office
  (`/admin-dev/`), or should back-office-only properties (e.g. the employee-creation crash) stay
  catalogued as aspirational/future-workload properties for now? This changes which properties in
  the catalog are actionable today vs. blocked on a workload change. `(needs human input)`
- Is `prestashop/prestashop:latest` pinned anywhere for this project, or expected to float? Properties
  validated against a specific `develop`-branch source read may silently stop applying if the
  vendored tag moves past a fix. `(needs human input)`
