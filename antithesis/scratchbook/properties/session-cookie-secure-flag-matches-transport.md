# session-cookie-secure-flag-matches-transport

## Origin

`bugs.md` #6: "Entire site, including the admin login form, is served over plain HTTP, so admin
credentials and session cookies travel unencrypted." `sut-analysis.md`'s brief for this pass
specifically asks whether "the storefront ever mix[es] HTTP/HTTPS in a way that could downgrade
a security-relevant response."

## Live reproduction

```
curl -s -D - -o /dev/null http://localhost:8080/
curl -s -D - -o /dev/null http://localhost:8080/admin-dev/
```

Every `Set-Cookie` header observed across the homepage, category page, product page, and the
admin-dev login redirect — `PHPSESSID`, both `PrestaShop-<hash>` cookies (storefront and
`admin-dev`) — carries `HttpOnly` and `SameSite=Lax` but **never** `Secure`. The admin-dev login
redirect (`GET /admin-dev/` → `302 Found` → `Location: /admin-dev/login?_token=`) happens over
plain `http://localhost:8080`, and the `Location` header itself is scheme-relative to `http`, not
`https` — i.e., the login page (and, by construction, wherever its form posts) is served and
addressed entirely within the plain-HTTP scheme in this deployment. No HTTPS listener exists on
the `prestashop` container's exposed port (`compose.yaml` maps `8080:80` only); TLS only exists
via the separate `compose.admin-api.yml` Caddy overlay, which fronts the **Admin API** surface
(`SSLMiddlewareListener` hard-requires TLS 1.2+ there — see `sut-analysis.md` Focus 1), not the
storefront or the `admin-dev` back-office UI Bombadil/an anonymous visitor would see on port 8080.

## Root-cause / mechanism read

`config/config.inc.php:162`: `$force_ssl = Configuration::get('PS_SSL_ENABLED');`, then passed as
the `$secure` constructor argument into every `new Cookie(...)` call (lines 164, 168, 174).
`classes/Cookie.php`'s `encryptAndSetCookie()` passes that value straight through as
`setcookie()`'s `'secure' => $this->_secure` option (`Cookie.php:383`). So the `Secure` flag is
directly, and only, gated on the `PS_SSL_ENABLED` configuration value — this project's
`compose.yaml` never sets it, and the vendored image's default install leaves it off (consistent
with the observed absence of `Secure` on every cookie). This is a **deployment/configuration
characteristic**, not a PrestaShop code defect in the sense `validating-claims.md` cares about:
the code does exactly what `PS_SSL_ENABLED` tells it to. The property below is therefore framed
around the *consistency* invariant (Secure flag tracks the config truthfully, so it never silently
breaks a session) rather than asserting that PrestaShop "should" force HTTPS by default — that's
a legitimate deployment-hardening recommendation, but distinct from a testable code invariant.

## Why this is still worth a property

Two different failure directions matter here, and they cut opposite ways:

1. **Today's confirmed state** (informational, not itself a bug): with `PS_SSL_ENABLED` off,
   `Secure` is correctly never set — this is consistent, not broken. Restating this is a useful
   standing regression check: if a future config change, module, or migration path ever flips
   `force_ssl` on for only *some* of the three `Cookie` constructions in `config.inc.php` (e.g. a
   multistore edge case takes the `ps-sg<group>` branch on one request and `ps-s<id>` on another,
   with divergent per-shop SSL settings), a visitor could receive a mix of `Secure` and
   non-`Secure` cookies for the *same* logical session within one visit — worth catching even
   though it isn't observed today.
2. **The dangerous direction**: if a cookie is ever marked `Secure` while the response is actually
   served over plain HTTP (e.g. a reverse-proxy `X-Forwarded-Proto` trust misconfiguration makes
   PrestaShop believe the request was HTTPS when it wasn't), the browser will accept but then
   **refuse to send that cookie back** on the next plain-HTTP request — silently breaking
   login/session/cart persistence for that visitor with no error surfaced. That failure mode is
   exactly the "mixing HTTP/HTTPS in a way that downgrades a security-relevant response" the
   research brief asks about, and it's the more actionable of the two: a regression here would
   likely first show up as one of the *existing* Bombadil properties failing downstream (cart
   badge/modal desync, since the cart-tracking cookie would stop round-tripping) — a narrower,
   directly-localizing check here would find the root cause immediately instead of just the
   downstream symptom, which is the exact gap `sut-analysis.md`'s Focus 8 calls out for
   `noPhpFatalErrorRendered`/`noHttpErrorCodes` being coarse.

## Property

| | |
|---|---|
| **Type** | Safety |
| **Property** | On every response served over the plain-HTTP origin Bombadil is driving, no cookie is ever issued with the `Secure` attribute. |
| **Invariant** | `Always`: for every navigated page, if the page was loaded via `http://` (as it always is in this deployment — see Open Questions), assert every `Set-Cookie` header lacks `Secure`. `Always` fits: this is a safety invariant about transport/cookie-attribute consistency that must hold on every single response, not an occasional-progress property. |
| **Antithesis Angle** | Fault injection isn't the primary lever here (there's no HTTPS listener to fail over from in this deployment) — the value is as a fast, narrow localizer: if `Secure` ever appears unexpectedly (e.g. from a proxy-header-trust bug reachable via header fuzzing, which Antithesis's HTTP-level fault injection could exercise once this project drives requests through something like the Caddy overlay), this property fails immediately and points straight at cookie/session code, rather than surfacing only as a downstream cart-desync symptom several actions later. |
| **Why It Matters** | Real-world impact is the one `bugs.md` #6 names directly: on this deployment shape, admin credentials and session identity travel in cleartext with no TLS available on the storefront/back-office port. The property doesn't assert PrestaShop enforces HTTPS by default (it doesn't, and that's a config choice, not a code defect) — it guards against the sharper, silent failure mode: a `Secure` cookie issued over a connection that isn't actually HTTPS, which breaks sessions without any visible error. |

**Open Questions:**

- This project's Bombadil workload only ever talks to `http://localhost:8080` (per
  `bombadil/specification.ts`'s header comment and `compose.yaml`) — should the property instead
  be framed to also cover the scenario where the `compose.admin-api.yml` TLS overlay is in front,
  so the same check can distinguish "Secure absent, transport is http" (fine) from "Secure absent,
  transport is https" (a real defect) once/if Bombadil is ever pointed at the TLS-fronted URL?
  Currently out of scope since Bombadil doesn't drive that overlay. `(needs human input)`
- Should PrestaShop ship a stronger default (e.g. HTTPS-only with automatic upgrade) rather than
  leaving `PS_SSL_ENABLED` off by default? This is a product/deployment-hardening question, not a
  code-correctness question this property can answer — noted here rather than folded into the
  Property statement, per "Honest Summaries."
