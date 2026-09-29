# admin-surface-rejects-anonymous-access

## Origin

`sut-analysis.md`'s brief for this pass asks: "does any anonymous-reachable endpoint expose
admin-only data or functionality?" This is the one property in this batch not anchored to a
specific `bugs.md` line item — it's a baseline auth-boundary check the research brief asked to be
validated directly rather than inferred from a report.

## Live reproduction

All requests made with a bare `curl` (no cookies carried over, no credentials, no prior
navigation — i.e. exactly what an anonymous first-time visitor's HTTP client would send):

```
curl -s -D - -o /dev/null "http://localhost:8080/admin-dev/index.php?controller=AdminEmployees"
→ HTTP/1.1 308 Permanent Redirect
  Location: http://localhost:8080/admin-dev/index.php/configure/advanced/employees/?_token=

curl -s -D - -o /dev/null "http://localhost:8080/admin-dev/"
→ HTTP/1.1 302 Found
  Location: /admin-dev/login?_token=

curl -s -D - -o /dev/null "http://localhost:8080/api/"
→ HTTP/1.1 401 Unauthorized
  WWW-Authenticate: Basic realm="Welcome to PrestaShop Webservice, please enter the authentication key as the login. No password required."
  Content-Length: 16

curl -s -D - -o /dev/null "http://localhost:8080/webservice/dispatcher.php"
→ HTTP/1.1 401 Unauthorized
  (same WWW-Authenticate header, Content-Length: 16)
```

In every case tried, the response is either a redirect toward a login-guarded URL or a 401 with a
minimal (16-byte) body — no employee list, no dashboard shell, no store configuration, no
customer/order data leaked in any of these anonymous responses. This is the **expected, correct**
behavior; this property exists to make that expectation explicit and continuously checked, per
`property-catalog.md`'s point that "obvious, unstated guarantees" are exactly what should become
properties rather than assumed. It also gives a narrow, fast-localizing signal distinct from the
existing coarse `noHttpErrorCodes`/`noPhpFatalErrorRendered` checks (`sut-analysis.md` Focus 8):
a 401/redirect here is *correct*, so this property isn't "no 4xx/5xx" — it's "specifically these
paths never return a 200 with sensitive content to an anonymous caller."

## Why this needs a property at all

Nothing observed today is broken — this is a forward-looking regression guard, motivated by:

1. The closed-issue density map (`closed-bugs-last-year.md`, "Permissions / auth / security (17)")
   shows this is a category PrestaShop actively fixes bugs in — e.g. `#9874` ("View permission
   doesn't work for modules"), `#10216` ("Permission management error") — i.e. permission-boundary
   regressions are a real, recurring category for this codebase, not a hypothetical.
2. The hybrid legacy/Symfony architecture (`sut-analysis.md` Focus 1) means the *same* logical
   guarantee ("admin-only data requires an authenticated session") is independently implemented
   in at least two different code paths — legacy `AdminController`-family token/session checks for
   `/admin-dev/`, and a separate OAuth2/API-key check for `/api/`+`/webservice/`. Two independent
   implementations of the same invariant is exactly the kind of surface where one path could
   regress while the other doesn't, and nothing currently in this project's Bombadil property set
   would catch it.

## Property

| | |
|---|---|
| **Type** | Safety |
| **Property** | An anonymous, unauthenticated HTTP request to an admin-only controller (`/admin-dev/...`) or the webservice/Admin API surface (`/api/`, `/webservice/...`) never returns a `2xx` response containing store, employee, customer, or order data — it always degrades to a redirect toward the login flow or an authentication challenge (401/403). |
| **Invariant** | `Always`: for every request Bombadil makes (or is seeded to make — see Open Questions) against an admin-namespaced or webservice-namespaced path, assert the response status is in `{301, 302, 307, 308, 401, 403}` and, if any body is returned, it does not contain recognizable account/store data markers (e.g. employee email patterns, `_token`-authenticated page shell markers). `Always` fits: this is a boundary that must hold on every single such request, not an eventual-progress condition. |
| **Antithesis Angle** | Fault injection around the auth-check code path itself (timing pressure on whatever session/token lookup gates these controllers) is the most direct angle — if the permission check involves a DB round-trip or cache lookup that can be starved/delayed, a race between "request arrives" and "auth state resolves" is exactly the class of bug `sut-analysis.md`'s "Antithesis's Superpower Is Timing" callout describes, and exactly the shape of the *already-confirmed* `employee-creation-no-crash-on-race` defect elsewhere in this catalog (missing validation before a race resolves). This property would catch an analogous race in the *auth-check* path specifically, which nothing else in the current property set targets. |
| **Why It Matters** | An auth-boundary regression here is a full store compromise, not a cosmetic bug — directly the scenario `bugs.md` #7 describes ("full store takeover for anyone who's seen this Docker image before") if the boundary itself, not just credential strength, were to fail. |

**Open Questions:**

- Bombadil's default action generators (click, fill, scroll, navigate, back/forward/reload) only
  reach URLs discoverable from the DOM of pages already visited. The anonymous storefront does not
  appear to link to `/admin-dev/`, `/api/`, or `/webservice/` anywhere in normal browsing — so this
  property, as scoped, is likely **not organically reachable** by Bombadil's current
  configuration even though it requires no authentication to check. Making it actionable needs
  Bombadil's initial-state/seed URLs extended to include these paths (a much smaller lift than the
  full "teach Bombadil to log in" question already flagged in `sut-analysis.md`'s Open Questions,
  since no credentials or session state are needed here — just an explicit navigation target).
  `(needs human input — is seeding extra anonymous URLs into Bombadil's frontier in scope for this pass?)`
- Only 4 endpoints were smoke-tested live in this pass (`AdminEmployees`, `/admin-dev/` root,
  `/api/`, `/webservice/dispatcher.php`). Other admin controllers (`AdminOrders`, `AdminCustomers`,
  `AdminModules`, etc.) were not individually probed — assumed to share the same
  `AdminController`-family auth gate based on the one tested, but not verified per-controller.
  `(partial: confirmed the gate behavior on one representative legacy admin controller and the
  webservice dispatcher; did not enumerate all admin controllers)`

### Investigation Log

#### Does the anonymous-reachable admin/webservice surface ever leak data or functionality without authentication?

- Examined: live HTTP responses from `/admin-dev/index.php?controller=AdminEmployees`,
  `/admin-dev/`, `/api/`, `/webservice/dispatcher.php` against the running vendored image
  (`docker ps` confirmed `exploring-prestashop-prestashop-1` up).
- Found: every response is a redirect to a login-guarded URL or a 401 with a 16-byte body and a
  `WWW-Authenticate: Basic` challenge naming the webservice's own auth scheme (API key as
  username, no password) — no data leak in any tested case.
- Not found: a per-controller enumeration beyond the one legacy admin controller tested; no test
  of whether any admin AJAX endpoint (as opposed to full-page controllers) behaves differently.
- Conclusion: no defect found in this pass — property recorded as a standing regression guard
  given the closed-issue density in this category, with the seeding/reachability question flagged
  above as the practical blocker to making it an active Bombadil check today.
