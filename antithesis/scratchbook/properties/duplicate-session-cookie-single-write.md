# duplicate-session-cookie-single-write

## Origin

`bugs.md` #12: "Homepage response sets the same `PrestaShop-<hash>` session cookie twice
with two different values in a single response — redundant/conflicting `Set-Cookie` header."
`sut-analysis.md` flags this as one of the two concrete, browser-observable session findings
(#12-13) and specifically asks this pass to validate the mechanism rather than take the
bug-report headline at face value.

## Live reproduction (primary evidence, not just the bug-report claim)

Confirmed directly against the running vendored image (`docker ps` showed the stack already
up: `exploring-prestashop-prestashop-1`, PS 9.1.x per `tests/regression-bugs.spec.js`).

```
curl -s -D - -o /dev/null http://localhost:8080/
```

Homepage response (repeated 3x, reproducible every time) carries **two** `Set-Cookie` headers
for the identical cookie name `PrestaShop-86fce55cad942ed59f2bbba85dc3f9a1`, with two different
encrypted values (both `def50200...`, the magic header for defuse/php-encryption ciphertext v2 —
confirmed this is the app's own `CookieCore` class, not some unrelated cookie):

```
Set-Cookie: PrestaShop-86fce...=def502008 8eca5f5...  ; expires=Mon, 19 Oct 2026 ...
Set-Cookie: PrestaShop-86fce...=def50200e 7a3a1919...; expires=Mon, 19 Oct 2026 ...
```

Same duplication reproduces on the category page (`/3-clothes`) and the product page
(`/1-hummingbird-printed-t-shirt.html`) — i.e. any full front-controller render. It does **not**
happen on pure-redirect responses: the un-canonicalized category URL
(`index.php?id_category=3&controller=category`, 302 to canonical URL) and the search
`index.php?controller=search` short-circuit redirect both set **zero** `PrestaShop-` cookies in
that response (no full page render happens before the redirect fires). Anonymous hits to
`/admin-dev/index.php?controller=AdminEmployees` (308 redirect to the login-guarded URL) and to
`/api/` and `/webservice/dispatcher.php` (401 Unauthorized) each set exactly **one**
`PrestaShop-` cookie — so duplication correlates specifically with a fully-rendered
front-office page completing, not with "any PrestaShop response."

## Root-cause investigation (per validating-claims.md — read the code, not just the symptom)

Fetched `classes/Cookie.php` from `PrestaShop/PrestaShop` `develop` via
`gh api repos/PrestaShop/PrestaShop/contents/classes/Cookie.php`.

- The cookie name is deterministic: `$this->_name = 'PrestaShop-' . md5(($standalone ? '' :
  _PS_VERSION_) . $name . $this->_domain);` (`Cookie.php:103`). For the storefront (non-admin),
  `config/config.inc.php:174` constructs it as `new Cookie('ps-s' . $context->shop->id, ...)` —
  a single, deterministic name for a given shop/version/domain. This is instantiated **once**
  per request and assigned to `$context->cookie` (`config.inc.php:190`); there is no second
  `new Cookie('ps-s...')` call anywhere else in the searched source (`gh api search/code` for
  `"new Cookie("` across the repo returns 6 hits total: `UploadController.php`,
  `config/config.inc.php`, `install-dev/classes/session.php`, `classes/Tools.php` (a `psAdmin`
  read, admin-only), `src/PrestaShopBundle/Install/Install.php`, and a test mock — none construct
  a second front-office `ps-s<id>` cookie).
- `CookieCore::write()` (`Cookie.php:402-430`) is the single write path, invoked from
  `__destruct()` (`Cookie.php:394-397`, "Automatically saves the cookie when the object is
  destroyed"). Critically, `write()` **guards against a redundant write from the same object**:
  it computes a SHA-256 checksum of the serialized content and returns early — without calling
  `setcookie()` — "if the checksum is the same: it means the content has not changed"
  (`Cookie.php:420-424`). So a single `Cookie` object calling `write()` twice (once explicitly,
  once via `__destruct()`) with unchanged content produces **one** `Set-Cookie`, not two. This
  rules out the trivial "duplicate flush of the same unchanged object" explanation.
  `_modified` is also reset to `false` after a successful write (`Cookie.php:426`), so a second
  no-op write from the same object is doubly guarded.
- Two ways remain to produce two genuinely different `Set-Cookie` values for the same name in one
  response, and the current investigation could not fully distinguish which is happening:
  1. **Same object, written twice with content that legitimately changed in between** (e.g. an
     explicit mid-render `write()` call, then a hook/module mutates the cookie's content — e.g.
     "recently viewed product," category last-visited tracking — before `__destruct()` fires a
     second, now-different write). Under this theory the *second* (last) value is authoritative
     and the browser's real behavior (keep the last `Set-Cookie` for a given name, per RFC 6265
     processing order) happens to retain the correct one — the practical defect is a wasted,
     doubled header, not silently-lost state.
  2. **Two independent `Cookie` object instances** for the same logical `ps-s<id>` cookie,
     constructed and destructed at two different points in the same PHP process/request (no
     second `new Cookie('ps-s...')` call site was found by source search, but the bootstrap file
     `config/config.inc.php` is itself `require`d from several places — `index.php`,
     `classes/Tools.php`, `classes/controller/FrontController.php` (a `grep` found only a
     comment referencing it there, not an actual second `require`) — so a second, non-`ps-s`-named
     instantiation path was not ruled out with certainty). Under this theory, if the two objects'
     content genuinely diverges (not just differing due to AES's per-call random IV on identical
     plaintext), whichever write loses the "last one wins" race has its state changes silently
     discarded from the client's perspective.
- Either way, the discriminating fact that *is* established: this is a real, code-level behavior
  of `CookieCore`/`__destruct()`'s write path on full-page renders, not a proxy/webserver
  artifact, not a one-off, and not explained by the trivial "same object flushed twice with no
  change" case (which the checksum guard rules out).

## Why a future reader should care regardless of which mechanism it is

Per RFC 6265 §5.3, a user agent presented with multiple `Set-Cookie` response headers for the
same name/domain/path is expected to process them **in the order received**, so the last one
wins — this is the de facto behavior of major browsers, but it is not a hard requirement for
every HTTP client (proxies, embedded webviews, some HTTP libraries may reorder, dedupe by
first-seen, or reject the response as malformed). PrestaShop's session/cart correctness is
therefore implicitly relying on unspecified client behavior it never documents or tests for. If
mechanism (2) above is ever the case with real semantic divergence (not just IV noise), a client
that does not apply "last Set-Cookie wins" would retain a *stale* guest/session identity for the
rest of that visit — a genuine, hard-to-reproduce-manually desync exactly in Antithesis's
"exploit non-deterministic interleaving" wheelhouse.

## Property

| | |
|---|---|
| **Type** | Safety |
| **Property** | A single HTTP response from the storefront never carries two `Set-Cookie` headers for the same cookie name with two different values. |
| **Invariant** | `Always`: for every navigated page load, group the response's `Set-Cookie` headers by cookie name; assert no name maps to more than one distinct value. `Always` fits because this must hold on every response Bombadil observes, not just some — any violation is worth reporting immediately, not just "at least once." |
| **Antithesis Angle** | Fault injection (latency/CPU throttling on the single `prestashop` container) could change how much module/hook processing completes before `__destruct()` fires relative to output buffering flush timing — useful for widening or narrowing the window in which a second, divergent write is captured, and for checking whether the duplication ever escalates from "two values, probably same underlying content" to "two values with visibly different session/cart implications" (checkable by extending the property to decrypt-and-compare, which needs the cookie key `_NEW_COOKIE_KEY_` — currently out of scope, since Bombadil is a black-box browser client without SUT secrets). |
| **Why It Matters** | Session/cart identity correctness depends on undocumented "last Set-Cookie wins" client behavior that PrestaShop never states as a requirement; a client that doesn't apply it silently keeps a stale guest/session cookie for the rest of the visit. |

**Open Questions:**

- Is the duplication caused by the same `Cookie` object writing twice with content that changed between an explicit mid-render write and `__destruct()`, or by two independent object instances for the same logical cookie? `(partial: ruled out same-object-unchanged-content via the checksum guard in Cookie.php:420-424; could not locate a second `new Cookie('ps-s...')` call site in the searched source)`
- Does the duplication ever produce two values whose *decrypted* content actually differs in a way that matters (different guest ID, different cart association), or is it always the same logical content re-encrypted with a fresh IV? Answering this needs the cookie encryption key, which a black-box Bombadil workload does not have — flagged as a gap for SUT-side instrumentation or a privileged debugging pass, not something the current workload can resolve. `(needs human input / SUT-side access)`

### Investigation Log

#### Is the duplication caused by the same object writing twice, or two independent objects?

- Examined: `classes/Cookie.php` (`develop` branch, fetched via `gh api
  repos/PrestaShop/PrestaShop/contents/classes/Cookie.php`), specifically `__construct` (name
  determinism, line 103), `write()` (lines 402-430), `__destruct()` (lines 394-397),
  `encryptAndSetCookie()` (lines 351-388); `config/config.inc.php` lines 156-190 (single
  `new Cookie('ps-s'...)` call site for the front office); `gh api search/code` for
  `"new Cookie("` across `PrestaShop/PrestaShop` (6 total hits, none a second front-office
  `ps-s<id>` construction); `classes/controller/FrontController.php` for a second
  `config.inc.php` require (found only a comment, not a real second require).
- Found: `write()` self-guards against a no-op re-write via a SHA-256 content checksum
  comparison and resets `_modified = false` after a successful write, so the trivial
  "`__destruct()` re-flushing an already-written, unchanged object" explanation is ruled out.
  Duplication is reproducible on every full-page-render response (home, category, product) and
  absent on pure-redirect and admin-401 responses observed live.
- Not found: the exact second call site (if the mechanism is two independent objects) or
  conclusive proof the same object was mutated and written twice mid-request (if the mechanism
  is a legitimate second write). Neither `Tools.php`'s lone `new Cookie('psAdmin')` (admin-only,
  different cookie name) nor any hook/module source was read in this pass — that would be the
  next step for a deeper dive.
- Conclusion: tagged `(partial: ...)` — enough is established to state the property (the
  observable behavior and its RFC 6265 implication) without a specific, unverified root-cause
  claim in the Property field itself, per "Honest Summaries."
