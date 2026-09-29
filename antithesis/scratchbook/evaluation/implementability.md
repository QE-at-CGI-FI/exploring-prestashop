---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/prestashop/prestashop
    why: Source used to build the catalog being evaluated; consulted here only to spot-check specific claims when needed.
---

# Implementability Evaluation — Property Catalog

## Method

Read `property-catalog.md` (23 properties), `sut-analysis.md`, `deployment-topology.md`,
`existing-assertions.md`, `property-relationships.md`, `bombadil/specification.ts`, and 8 property
evidence files (`session-cookie-lifetime-bounded`, `duplicate-session-cookie-single-write`,
`session-cookie-secure-flag-matches-transport`, `cart-ajax-success-flag-decoupled-from-errors`,
`malformed-identifier-params-degrade-to-4xx`, `admin-surface-rejects-anonymous-access`,
`category-redirect-target-resolution-crashes-without-active-parent`,
`csrf-token-stability-across-identity-change`).

Critically, this pass also read Bombadil's actual **public API surface** — not just
`bombadil/specification.ts` (which only shows two `extract()` calls against `state.document`) but
the installed package's type definitions at
`node_modules/@antithesishq/bombadil/dist/browser/index.d.ts`,
`dist/browser/defaults.d.ts`, `dist/browser/defaults/properties.d.ts`, `dist/actions.d.ts`, and
`dist/internal.d.ts`, plus an exhaustive `grep -rniE
"network|response|header|cookie|fetch|xhr|request"` across the entire compiled `dist/` tree
(zero matches). This was necessary because several properties' claimed mechanisms
(parsing `Set-Cookie` headers, parsing raw AJAX JSON bodies, asserting exact HTTP status codes)
presuppose a capability the catalog never explicitly verified against the tool's actual interface.

The public `State` type Bombadil's `extract()` receives is exactly:

```ts
export interface State {
    document: HTMLDocument;
    window: Window;
    navigationHistory: { back, current, forward: NavigationEntry[] };
    errors: { uncaughtExceptions: [...] };   // JS errors only
    console: ConsoleEntry[];
    lastAction: Action | null;
    resources: Resources;                     // perf metrics (heap, DOM node count, timings)
}
```

There is no field for response headers, cookie attributes, HTTP status codes, or request/response
bodies. `noHttpErrorCodes` (a *default*, pre-built property, not something user code can compose
from) is evidently implemented using a capability internal to Bombadil's own driver that is not
exposed to specification-authored `extract()` functions — its `.d.ts` shows it as an opaque
`Formula` constant, not something built from a documented `state.response`-shaped field.

## Findings

### Finding 1 (catalog-wide, severe): The three "Session/cookie mechanics" properties claim an observation mechanism Bombadil's public API cannot provide, and two are additionally blocked by `HttpOnly`

**Properties:** `session-cookie-lifetime-bounded`, `duplicate-session-cookie-single-write`,
`session-cookie-secure-flag-matches-transport` — all three tagged **✅ Checkable today**.

The reachability key defines ✅ as reachable "with only a straightforward addition to the
property's own `extract()`/`always()` logic." All three properties' stated invariants require
reading HTTP response headers directly:

- `session-cookie-lifetime-bounded`: "parse each session cookie's Max-Age/expires."
- `duplicate-session-cookie-single-write`: "group each response's `Set-Cookie` headers by name;
  assert no name maps to more than one distinct value."
- `session-cookie-secure-flag-matches-transport`: "assert every `Set-Cookie` header lacks
  `Secure`."

None of these attributes (`Max-Age`, `expires`, the count of `Set-Cookie` headers for one name,
`Secure`) are readable from `document.cookie` — the only cookie-adjacent surface JavaScript (and
therefore Bombadil's `state.document`/`state.window`) exposes. `document.cookie` returns a single
flattened `name=value; name2=value2` string per current cookie value; it exposes none of the
cookie's own attributes and cannot distinguish "this name was set twice in one response" from
"this name has one current value."

Worse: the properties' own evidence files show, via their own `curl -D -` reproductions, that the
actual cookies in question (`PHPSESSID`, `PrestaShop-<hash>`) are issued with the `HttpOnly` flag
(`session-cookie-lifetime-bounded.md` line 16: `...; path=/; HttpOnly; SameSite=Lax`). A cookie
marked `HttpOnly` is invisible to `document.cookie` **entirely** — not just its attributes, its
name/value pair too. So for these specific cookies, Bombadil's browser-JS-only visibility isn't
merely insufficient for the *attribute* checks; it cannot see the cookies **at all**.

This isn't a "needs workload extension" (🔧) situation either — no amount of new action generators,
seed data, or fill-value fuzzing changes what a browser's JS layer can read from an `HttpOnly`
cookie's headers. It is a hard capability wall given Bombadil's documented public API. The ✅ tag
and its stated rationale ("straightforward extract()/always() addition") are incorrect for all
three properties as currently worded.

**Suggested action:** Re-tag all three from ✅ to a new/explicit "not implementable via Bombadil's
documented extract() API" status distinct from 🔧/🔒 (neither "needs a workload extension" nor
"needs back-office auth" describes the actual blocker — see Wildcard finding W2 for a concrete
alternate implementation path outside Bombadil).

### Finding 2: `cart-ajax-success-flag-decoupled-from-errors`'s claimed mechanism ("no new action generator needed... only the assertion") requires page-context script injection, not a bare `extract()` addition

**Property:** `cart-ajax-success-flag-decoupled-from-errors` — tagged **✅ Checkable today**.

The invariant is stated as: "parse every JSON response body from `controller=cart` ajax actions;
assert `!(body.success === true && ...)`." The response body of an AJAX call is not part of the
`State` interface above — there is no `state.network`/`state.responses` field, and `noHttpErrorCodes`
only reports pass/fail on status codes (per its name), not bodies.

A workaround exists in principle: inject a `fetch`/`XMLHttpRequest` monkey-patch into the page
early (e.g., via a custom action using `registerCustomAction`, which does receive `document` and
`window`) that records response bodies onto a `window`-scoped array, which a subsequent
`extract()` could then read via `state.window`. This is a standard technique in browser test
automation, but it is materially different engineering from "add an `extract()`/`always()`" —
it requires the injection to run and take effect *before* the cart AJAX calls it needs to observe
fire, and to survive whatever client-side re-rendering the cart JS does. The catalog's "Antithesis
Angle" text ("no new action generator needed, value is in exhausting..." ) does not mention this
requirement at all, and the ✅ tag's rationale doesn't account for it.

**Suggested action:** Downgrade to 🔧 and add the injection mechanism explicitly as the workload
extension required, or reframe the property around DOM-visible symptoms of the same defect (e.g.,
does the cart page silently fail to reflect an attempted quantity-0 update, with no visible error
text anywhere in the DOM?) which *is* checkable via `state.document` alone, at the cost of a
weaker, more indirect signal than reading the JSON body directly.

### Finding 3: Two properties' invariants are literally phrased as exact-HTTP-status-code-set membership, which isn't observable either — only approximable via DOM heuristics

**Properties:** `malformed-identifier-params-degrade-to-4xx`, `admin-surface-rejects-anonymous-access`
— both tagged ✅ (simple cases) / 🔧 (edge classes) and 🔧 respectively.

- `malformed-identifier-params-degrade-to-4xx`'s invariant: "assert `httpStatus in {200 with
  matching product/category id, 301, 302, 404, 410}`."
- `admin-surface-rejects-anonymous-access`'s invariant: "assert the response status is in `{301,
  302, 307, 308, 401, 403}`."

Exact HTTP status codes are not part of `State` either. What *is* approximable from `state.document`
plus `state.navigationHistory` (comparing the requested URL to the final rendered URL to infer a
redirect occurred) is a heuristic proxy: "did the URL change" + "does the page look like a 404
template" + "does the rendered entity's ID match the requested one." That is weaker than the
literal invariant in a way that specifically undermines each property's own reason for existing:

- For `malformed-identifier-params-degrade-to-4xx`, the property's whole point is to catch a
  **soft-404** (a `200` status that renders a not-found-looking page, or a `200` with the wrong
  entity silently substituted) as distinct from a real `404`/`410`. If the check can only reason
  from rendered content, it may not reliably distinguish a true `404` response from a `200`
  response whose body happens to look like one — precisely the ambiguity a status-code-based
  invariant exists to resolve.
- For `admin-surface-rejects-anonymous-access`, distinguishing "redirected to login" (3xx, correct)
  from "served a 200 admin shell with no obviously-recognizable data markers" (a real leak, but one
  that might not match a hand-picked DOM marker list) is weaker than a direct status check.

**Suggested action:** Reword both invariants' `Invariant` field to state the DOM/navigation-history
proxy actually used, rather than the literal HTTP status set, so a future reader doesn't believe a
stronger check is running than actually is. If Bombadil's driver-internal status-code visibility
(used by `noHttpErrorCodes`) can be surfaced to custom code, that would resolve this properly —
worth a direct question to Bombadil's maintainers/docs before accepting the DOM-only workaround.

### Finding 4: No generic "navigate to URL" action exists in Bombadil's public `Action` type — the 🔧 tags for `malformed-identifier-params-degrade-to-4xx` and `admin-surface-rejects-anonymous-access` understate the lift

**Properties:** `malformed-identifier-params-degrade-to-4xx` (edge classes), `admin-surface-rejects-anonymous-access`.

`dist/browser/index.d.ts`'s `Action` union contains: `Custom`, `"Back"`, `"Forward"`, `"Reload"`,
`"Wait"`, `Click`, `DoubleClick`, `TypeText`, `PressKey`, `ScrollUp`, `ScrollDown`,
`SetFileInputFiles`, `MouseDrag`, `SetViewport`. There is no `Navigate: { url }` (or equivalent)
action. The specification file's own header comment describes the default generators as clicking,
filling, scrolling, and navigating — but "navigate" here almost certainly means *following in-DOM
links via Click*, since that's the only way the documented Action union can move between pages
other than Back/Forward/Reload.

This means:

- `malformed-identifier-params-degrade-to-4xx`'s 🔧 note ("needs a URL-parameter mutator layered
  on navigation") implies a navigate-with-parameters primitive already exists and just needs a
  mutator plugged in. It doesn't exist — this needs a bespoke `registerCustomAction` that directly
  sets `window.location` (or injects and clicks a synthetic anchor) to an arbitrary, ID-mutated
  URL.
- `admin-surface-rejects-anonymous-access`'s 🔧 note ("needs only a URL-frontier seed, a smaller
  lift than full authentication") has the same gap: "seeding" a frontier implies configuration
  data, but there is no frontier-consuming navigate primitive to seed. The same bespoke custom
  action is needed.

Both properties' own evidence files partially anticipate this ("Does Bombadil's action-generator
set include arbitrary query-parameter mutation on navigation, or only following in-DOM
links/forms? If only the latter, this property needs a workload extension... a small custom action
generator" — `malformed-identifier-params-degrade-to-4xx.md`), so the uncertainty was flagged, but
the catalog-level reachability tags and one-line rationales don't carry that caveat forward — a
reader of `property-catalog.md` alone would not know a new custom action (not just seed data) is
required.

**Suggested action:** Both properties' 🔧 notes should read "needs a custom `registerCustomAction`
performing direct `window.location` navigation, since Bombadil has no built-in parameterized
navigate action" rather than "seed"/"mutator layered on navigation," which reads as a much smaller
change than it is.

### Finding 5: `deployment-topology.md` specifies no seed-data/fixture mechanism, but at least 3 properties' 🔧 tags depend on one existing

**Properties:** `voucher-code-resubmit-not-double-applied` (needs a seeded active cart rule),
`category-redirect-target-resolution-crashes-without-active-parent` (needs a seeded disabled,
parentless category configured for redirect), and implicitly `price-formatting-consistent-across-pages`'s
Open Question about a second currency.

`deployment-topology.md`'s `db` component section says: "Image: official `mysql:8`... no change
needed." Nothing in the topology document (nor in `compose.yaml`, per its own description)
describes a fixture-loading step, an init SQL script, or any other mechanism for getting the
storefront's default demo data into a state that includes an active cart rule or a
disabled/parentless category with redirect configured. Since these fixtures require *either*
back-office-admin-driven creation (blocked on the same auth decision as the 🔒 properties) *or* a
DB-level seed mechanism the topology never mentions, the 🔧 tag's implication — "reachable without
authentication, needs new action generators or seed data" — glosses over a real open question:
where would that seed data come from, mechanically, given the currently-planned three-container
topology has no described fixture step at all?

**Suggested action:** `deployment-topology.md` should either add a fixture-seeding mechanism (e.g.,
an init SQL script mounted into the `db` container, run once at startup) or these properties'
🔧 tags should be split into "needs seed data (mechanism undetermined)" as a distinct, tracked
open question rather than folded into the same tag as the (mechanically well-understood) URL-mutator
and adversarial-fill-value extensions.

### Finding 6: `csrf-token-stability-across-identity-change` is miscategorized as blocked on the *back-office* auth decision; its actual trigger is *storefront customer* login/logout

**Property:** `csrf-token-stability-across-identity-change` — tagged 🔒, folded into the
catalog-wide "5 properties / one decision (admin `/admin-dev/` auth)" framing in
`property-catalog.md`'s Catalog-Wide Open Questions ("Resolving this once... unblocks all five").

The property's own text and evidence file are explicit that the needed trigger is a *customer*
identity change — `Tools::getToken()` hashes `(customer->id, customer->passwd, page)`, and the
property's mechanism section states the token changes "when... a different customer becomes the
logged-in identity" via ordinary storefront login/logout, not employee/back-office authentication.
The evidence file itself compounds the conflation: its Open Questions say "Bombadil's current
workload never logs in (per `sut-analysis.md`'s catalog-wide open question)... same workload-scoping
decision `sut-analysis.md` already flags, restated here" — explicitly treating storefront customer
login and back-office `/admin-dev/` employee login as the same decision. They are not: storefront
account registration/login is ordinary, unauthenticated-starting-point functionality reachable
without any admin credentials, and is a much smaller workload extension (fill a login form with a
seeded/registered customer account, no `/admin-dev/` routing or employee-role credentials involved)
than teaching Bombadil to authenticate into the back office.

**Impact:** Resolving the "should Bombadil authenticate into `/admin-dev/`" decision — the thing
`property-catalog.md` calls "the single biggest lever on this catalog's actionability" — does
**not** unblock this property at all. It is bundled with 4 properties for which that framing is
correct (`employee-creation-no-crash-on-race`, `order-message-lost-on-premature-reload`,
`cart-rule-zero-value-discount-saves-silently`, `weak-admin-credentials-blocked-on-auth`) and 1 for
which it is not. This risks the property being deprioritized behind a decision irrelevant to it,
when a separate, likely cheaper decision (should Bombadil register/log in as a storefront customer)
would actually move it forward.

**Suggested action:** Re-tag as 🔧 (needs workload extension: customer registration/login/logout
action sequence), decouple from the back-office-auth catalog-wide open question, and record it as
its own, separate open question.

### Finding 7: Fault-injection language in several properties describes single-request-targeted control that the planned topology's fault vocabulary doesn't clearly provide

**Properties:** `delivery-option-stale-at-payment-confirm` ("Delaying/dropping the delivery-update
POST while letting the payment-confirm POST through"), `address-form-stale-country-response`
("asymmetric-latency/reorder fault injection"), `employee-creation-no-crash-on-race` ("Network-fault
injection on `GET /employees/tabs`").

`deployment-topology.md`'s fault section for the `prestashop` container lists: "node hang, node
throttling... baseline network latency/congestion between it and the client" — container/node-level
faults, described in aggregate terms, not per-endpoint or per-in-flight-request terms. It's
plausible that Antithesis's broader nondeterministic run-to-run scheduling variance eventually
produces the needed interleaving between two specific concurrent requests without literally
targeting one of them — but the catalog states the mechanism with a precision (deliberately
delaying *this* request while letting *that* one through) the topology document's own fault
vocabulary doesn't describe having. This wasn't resolved by anything in the required reading list
(`references/faults.md` wasn't part of this evaluation's inputs).

**Suggested action:** Confirm (via Antithesis's actual fault-injection primitives, not covered by
this evaluation's inputs) whether request/route-level fault targeting exists, or whether these
three properties should be reworded to describe the coarser, node-level mechanism actually
available and accept a probabilistic (not deliberately constructed) trigger.

## Passes

- `extreme-quantity-input-does-not-corrupt-cart`'s 🔧 tag (adversarial fill values) is realistically
  buildable: `dist/actions.d.ts`'s `StringGenerator` type (`"Email" | {Text: Range} | {CharSet:
  ...} | {Regexp: string}`) combined with `weighted()`/`actions()` genuinely supports constructing
  a custom fill generator emitting negative numbers, huge integers, decimals, and non-numeric
  strings into a targeted input. This is a moderate, well-scoped extension, accurately described.
- Both `malformed-identifier-params-degrade-to-4xx.md` and `admin-surface-rejects-anonymous-access.md`
  proactively flag, in their own Open Questions, that Bombadil's action-generator set may not
  support the navigation they need — the underlying uncertainty was noticed at the property level
  even though it didn't propagate to the catalog-level reachability tag (see Finding 4).
- `category-redirect-target-resolution-crashes-without-active-parent.md` is honest about its own
  precondition: its Open Questions already state plainly that it needs either a seeded fixture or
  back-office-driven category configuration, and cites the same catalog-wide scoping question
  rather than overclaiming reachability.
- `deployment-topology.md` correctly declines to enable node-termination faults, since no property
  in the catalog needs crash-recovery testing — an accurate, appropriately scoped topology decision.
- `deployment-topology.md` correctly and explicitly acknowledges (rather than silently drops) the
  single-client-replica limitation for cross-session stock races, flagging it as an out-of-scope
  gap rather than ignoring it.
- The ✅/🔧/🔒 reachability-tag schema itself is a reasonable, useful piece of catalog design; the
  problems found here are in specific tag *assignments*, not the taxonomy.

## Uncertainties

- Whether Bombadil's underlying native binary (the Rust/CDP-based executables under
  `node_modules/@antithesishq/bombadil/binaries/`) has network/header/cookie-inspection
  capability that simply isn't exposed through the public TypeScript API this evaluation checked.
  Only the published `.d.ts` files and the compiled `dist/` tree were inspected; the native
  binaries were not disassembled or run. If such capability exists but is undocumented, Finding 1
  would be an API-ergonomics gap rather than a hard wall.
- Whether the vendored `prestashop/prestashop:latest` image's default demo data already includes a
  spare cart rule, a disabled category, or a second currency — would reduce the seeding gap in
  Finding 5 for some properties. Not checked against the live container's database in this pass.
- Whether `noHttpErrorCodes` treats any 4xx/5xx anywhere in a run as an unconditional violation, or
  is scoped/configurable per-path. Only its `.d.ts` (an opaque `Formula` export) was available;
  its actual implementation wasn't inspected. This affects both Finding 3's severity and the
  cross-cutting conflict raised in the Wildcard evidence file (W4).
- Whether Antithesis's fault-injection primitives (beyond `deployment-topology.md`'s summary)
  support request/route-level targeting, which would resolve Finding 7. `references/faults.md`
  was not part of this evaluation's required reading.
