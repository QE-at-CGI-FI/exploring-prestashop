# session-cookie-lifetime-bounded

## Origin

`bugs.md` #13: "`PHPSESSID` cookie is issued with a ~65-year expiry (`expires=2083`,
`Max-Age=1788458201`) instead of a normal session/short-lived cookie." First-hand manual-testing
finding, not a GitHub issue — this pass re-confirmed it live and traced the mechanism.

## Live reproduction

```
curl -s -D - -o /dev/null http://localhost:8080/
```

```
Set-Cookie: PHPSESSID=bf286eff57b533416ea24bc733bf2e56; expires=Sun, 18 Jul 2083 13:21:40 GMT; Max-Age=1792435250; path=/; HttpOnly; SameSite=Lax
```

`1792435250` seconds ≈ 56.8 years (the exact figure drifts slightly run-to-run since it's computed
as `time() + N`; `bugs.md` recorded `1788458201`/`2083` on an earlier run — same order of
magnitude, same root cause). The co-issued `PrestaShop-<hash>` cookies in the same response carry
the identical `Max-Age=1728000` (exactly 20 days) — a **different**, much more reasonable value —
so the two session-identifying cookies in a single response currently disagree by roughly three
orders of magnitude in intended lifetime.

## Root-cause / mechanism read

`config/config.inc.php:157-160`:

```php
$cookie_lifetime = defined('_PS_ADMIN_DIR_') ? (int) Configuration::get('PS_COOKIE_LIFETIME_BO') : (int) Configuration::get('PS_COOKIE_LIFETIME_FO');
if ($cookie_lifetime > 0) {
    $cookie_lifetime = time() + (max($cookie_lifetime, 1) * 3600);
}
```

This single `$cookie_lifetime` value (an hours-based config setting converted to an absolute
future Unix timestamp) is threaded into **two different consumers** with different actual
observed results:

- The `Cookie` (`PrestaShop-<hash>`) objects at lines 164/168/174 — observed `Max-Age=1728000`
  (20 days) in this install.
- `src/Core/Session/SessionHandler.php`, constructed at `config.inc.php:179` with the *same*
  `$cookie_lifetime` variable, which calls `session_set_cookie_params(['lifetime' =>
  $this->lifetime, ...])` (`SessionHandler.php:78-79`) — this governs `PHPSESSID`'s expiry via
  PHP's native session cookie mechanism, and is observed at ~56.8 years, not 20 days.

Both consumers are handed the *same* `$cookie_lifetime` PHP variable in the same request, yet the
two cookies end up with wildly different lifetimes — and the mechanism is now confirmed, not just
suspected, by reading `SessionHandler.php` in full (`gh api
repos/PrestaShop/PrestaShop/contents/src/Core/Session/SessionHandler.php`):

- `SessionHandler::__construct(int $lifetime, ...)` does `$this->lifetime = $lifetime;` — no
  conversion, no reinterpretation (`SessionHandler.php:47`).
- `SessionHandler::init()` passes it straight through:
  `session_set_cookie_params(['lifetime' => $this->lifetime, ...])` (`SessionHandler.php:78-79`).
- PHP's `session_set_cookie_params()` documents `lifetime` as "*Lifetime of the session cookie,
  defined in seconds*" — i.e. a **relative duration from now**, which the session extension adds
  to the current time when the cookie is actually emitted.
- But the value `config.inc.php` hands to `SessionHandler`'s constructor is **not** a relative
  duration — it's the same `$cookie_lifetime` that lines 157-160 already converted into an
  **absolute future Unix timestamp** (`time() + hours * 3600`) specifically for `Cookie::__construct()`'s
  `$expire` parameter, which `CookieCore::encryptAndSetCookie()` correctly feeds to `setcookie()`'s
  `'expires'` option (which *does* expect an absolute timestamp — so the `Cookie` class's usage is
  correct).
- Net effect: `SessionHandler` receives an absolute epoch timestamp (≈1.79 billion, i.e. "now") and
  treats it as a **relative** seconds-from-now duration, so PHP computes the actual cookie expiry as
  `time_at_session_start + (an already-absolute-timestamp-sized number)` ≈ *twice* the current
  epoch time plus the small configured offset. The arithmetic matches the observed symptom closely:
  with "now" ≈ epoch 1.79×10⁹ (this pass ran 2026-09-29) and a modest configured
  `PS_COOKIE_LIFETIME_FO` offset, `2 × 1.79×10⁹ ≈ 3.58×10⁹` seconds since epoch lands on almost
  exactly **18 July 2083** — the precise date both `bugs.md`'s original finding and this pass's
  live `curl` reproduced. This is a strong, arithmetic-level confirmation, not a coincidence: it is
  a **unit-mismatch defect in `config/config.inc.php`** (an absolute timestamp built for one
  consumer is reused, unconverted, for a second consumer with a different, incompatible
  contract), not a `PS_COOKIE_LIFETIME_FO` misconfiguration and not a `SessionHandler.php` defect
  (its own contract — a plain relative lifetime in seconds, matching PHP's own documented
  `session_set_cookie_params()` semantics — is implemented correctly in isolation).

## Why it matters

An eternally-valid, unauthenticated session-identifying cookie widens the exposure window for
session-fixation and cookie-theft scenarios far beyond any plausible product need (cart
persistence, "remember this browser") — a stolen or physically-recovered `PHPSESSID` value
remains valid for the visitor's entire remaining lifetime with this browser profile, with no
natural expiry ever forcing re-issuance. This is squarely the kind of "obvious, unstated
guarantee" (`sut-analysis.md` Focus 4) a shopper/security reviewer would assume is bounded to
something sane (days/weeks) without ever being told otherwise. Per `validating-claims.md`, this
is no longer just the manual-testing report's word for it: the unit-mismatch mechanism above is
confirmed from PrestaShop's own source and matches the observed date/magnitude precisely, so this
is a genuine PrestaShop code defect (in `config/config.inc.php`'s reuse of an absolute-timestamp
variable as a relative-duration argument to `SessionHandler`), not a config choice or environment
quirk.

## Property

| | |
|---|---|
| **Type** | Safety |
| **Property** | No session-identifying cookie (`PHPSESSID`, `PrestaShop-<hash>`) is issued with an unbounded or implausibly long lifetime — its expiry stays within a defined sane ceiling. |
| **Invariant** | `Always`: for every navigated page, parse each session-identifying cookie's `Max-Age`/`expires`; assert the resulting lifetime does not exceed a chosen ceiling. `Always` fits because this is a per-response attribute check that should hold on every observation, not a rare/occasional condition. |
| **Antithesis Angle** | Limited direct fault-injection angle (this is a deterministic code-path defect, not a race), but valuable as a **standing regression check**: once fixed upstream, this property (with a sane ceiling) should hold; keeping it in the catalog catches a re-introduction of the same absolute-timestamp/relative-duration confusion in `config.inc.php` or an equivalent unit mismatch in a future refactor of the cookie/session bootstrap. |
| **Why It Matters** | Real shopper/security impact: an unauthenticated session identifier that never expires materially worsens the blast radius of session-fixation or cookie theft. Confirmed root cause: `config/config.inc.php` computes `$cookie_lifetime` as an absolute future Unix timestamp for `Cookie::__construct()`'s `$expire` parameter (correct for `setcookie()`'s `'expires'` option), then reuses that same already-absolute value, unconverted, as the `$lifetime` argument to `SessionHandler`'s constructor — which forwards it to `session_set_cookie_params(['lifetime' => ...])`, a parameter PHP documents as a **relative** duration in seconds. Feeding it an absolute epoch timestamp instead of a small relative duration makes the effective expiry land roughly at *"now" + "now"* (≈ double the current epoch time), which is exactly why the observed expiry lands in 2083 — not because any admin configured "56.8 years," but because of this unit mismatch. |

**Open Questions:**

- Is this already fixed upstream (in a version newer than what this pass validated against, `develop` as of 2026-09-29) or still present? The arithmetic and code both check out against `develop`, but per `sut-analysis.md`'s version-drift caveat, the vendored `prestashop/prestashop:latest` tag and `develop` can diverge — worth re-confirming against whichever tag is actually running before treating this as a still-open upstream defect to file. `(needs human input — is this filed upstream already?)`
- What sane ceiling should the property assert once the unit-mismatch is fixed (30 days? 1 year? match `PS_COOKIE_LIFETIME_FO` exactly)? This is a product decision PrestaShop's own docs/comments don't state. `(needs human input)`

### Investigation Log

#### Why do PHPSESSID and PrestaShop-<hash> diverge in lifetime despite sharing config.inc.php's $cookie_lifetime?

- Examined: `config/config.inc.php` lines 156-190 (single shared `$cookie_lifetime` computation
  feeding both the `Cookie` constructors and `new SessionHandler($cookie_lifetime, ...)`);
  `src/Core/Session/SessionHandler.php` (`gh api repos/PrestaShop/PrestaShop/contents/...`),
  specifically the constructor storing `$this->lifetime = $lifetime` and
  `session_set_cookie_params(['lifetime' => $this->lifetime, ...])` at line ~78.
- Found: both code paths are handed the identical variable in the same request; the *observed*
  runtime values differ by roughly 1000x (20 days vs ~56.8 years) on this specific install.
  `SessionHandler` performs no conversion on `$lifetime` before handing it to
  `session_set_cookie_params()`. PHP's own documentation defines that function's `lifetime`
  parameter as a relative duration in seconds from the current time, not an absolute timestamp —
  whereas `config.inc.php:157-160` had already converted `$cookie_lifetime` into an absolute
  future Unix timestamp (`time() + hours*3600`) before passing it to *both* `Cookie::__construct()`
  (whose `$expire` is correctly used as an absolute `setcookie()` `'expires'` value) and
  `SessionHandler::__construct()` (whose `$lifetime` is incorrectly treated the same way, but
  PHP's session layer interprets it as relative). Redoing the arithmetic with "now" ≈ the epoch
  value the day of this test (~1.79×10⁹, i.e. 2026-09-29) reproduces the observed expiry date
  (18 July 2083) to within the precision of a rough hand calculation, which is strong
  circumstantial confirmation that this specific unit mismatch — not a misconfigured
  `PS_COOKIE_LIFETIME_FO` value — is the root cause.
- Not found: the actual stored value of `PS_COOKIE_LIFETIME_FO` in this install's `ps_configuration`
  table (would require DB access, not just source reading, to pin the exact offset added on top of
  "double now"); no changelog/issue search was done to check whether this specific mismatch is
  already a known, filed, or fixed upstream defect.
- Conclusion: root cause is confirmed at the code + arithmetic level (no longer `(partial)`); the
  two open items are (a) whether it's already tracked/fixed upstream past this repo's `develop`
  read, and (b) the DB-level exact `PS_COOKIE_LIFETIME_FO` value, which only refines the precise
  ceiling to assert, not whether the defect is real.
