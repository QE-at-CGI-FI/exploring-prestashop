# weak-admin-credentials-blocked-on-auth

## Status: workload-blocked

This property requires an authenticated back-office session (to log in with the default
credentials and/or to drive the installer's password field) and possibly the install flow itself.
Per `sut-analysis.md`'s open question and `bombadil/specification.ts`'s own header comment,
Bombadil "currently never logs in" — it drives the storefront as an anonymous visitor only. This
property is catalogued as **aspirational / future-workload**, not actionable by the current
Bombadil configuration, per this pass's explicit instruction to still record high-value
auth properties that would apply if Bombadil is extended to authenticate.

## Origin

`bugs.md` #5-7 (validated first-hand by the project's own manual testing, not just an external
report):

> 5. Admin back office logs in successfully with the well-known default demo credentials
>    (`demo@prestashop.com` / `prestashop_demo`) — installer never forces a credential change.
> 6. Entire site, including the admin login form, is served over plain HTTP...
> 7. Predictable-once-known admin path + default credentials + no 2FA/forced reset = full store
>    takeover for anyone who's seen this Docker image before.

This is explicitly the "literal behavior of the vendored image on fresh install," per this task's
brief — i.e. the strongest possible evidentiary standing (a first-hand repro against the actual
running SUT, not a third-party claim to validate). #6 is already covered by the checkable-today
`session-cookie-secure-flag-matches-transport` property in this batch; this property covers #5/#7
specifically (credential strength / forced reset), which genuinely can't be checked without
logging in.

## Related closed issues (validated per validating-claims.md, not taken at face value)

Three issues from `closed-bugs-last-year.md`'s "Permissions / auth / security (17)" section were
checked against their actual GitHub state (`gh api repos/PrestaShop/PrestaShop/issues/<n>`), not
just their titles:

- **`#40380`** "It is possible to validate an average admin password" — `state: closed`,
  `state_reason: completed`, labels include `Bug`, `Major`, `Regression`, `Verified` (i.e.
  maintainer-confirmed, not a stale/unconfirmed report). Issue body: reporter could set the
  installer password field to `"prestashop"` or `"Correct Horse Battery Staple"` and the
  installer's password-strength validation accepted it. Fixed by linked PR **`#40829`** ("Fix
  validate medium pass"), confirmed via the issue's timeline (`cross-referenced` event pointing at
  that PR number). This is directly relevant to #5/#7: even a store owner who *does* change the
  demo password at install time was, until this fix, not meaningfully blocked from choosing
  something close to "prestashop" itself.
- **`#29778`** "Password policy not respected in backoffice customer forms" — closed, `Verified`,
  `PR available` label, `Regression` label — a maintainer-confirmed defect (not investigated
  beyond metadata in this pass; noted as a related, lower-priority lead since it's about
  *customer* password policy, not admin).
- **`#37898`** "Max password length allowed in the password policy is longer than bcrypt can
  handle and hardcoded max pass length for customer" — closed, `Verified`, `Security` label — a
  maintainer-confirmed defect (not investigated beyond metadata in this pass; bcrypt silently
  truncates input past 72 bytes, so a password policy allowing longer input than that creates a
  false sense of entropy — relevant background for any future property about password *strength
  enforcement* specifically, distinct from the *forced reset* angle this property focuses on).

All three are `state_reason: completed` with a `Verified` label — i.e. maintainer-confirmed real
defects that were fixed, not "not a bug"/stale closures. This clears the `validating-claims.md`
bar for treating them as real (now-fixed) defects, and per `property-catalog.md`'s "Cross-Reference
Closed Issues as Regression Targets" guidance, a fixed bug in this exact area (admin/install
password strength) is a good regression target: the fix (`#40829`) may not cover every input the
original weak-validation logic accepted, and this project's vendored `prestashop/prestashop:latest`
tag may predate or postdate that fix (see `sut-analysis.md`'s version-drift caveat) — not
independently confirmed which, in this pass.

## Why this can't be checked today

- Confirming "logs in successfully with default credentials" requires actually submitting the
  admin login form with `demo@prestashop.com` / `prestashop_demo` and observing an authenticated
  response — Bombadil's current action generators never fill in and submit that specific form,
  and even if they randomly did (unlikely — email/password fields aren't typical fuzz targets for
  generic click/fill), there's no property today that would check the fact of successful admin
  login as meaningful.
- Confirming "no forced credential change" requires observing what happens *after* a successful
  login (is there a forced-reset interstitial?) — inherently needs an authenticated session.
- Confirming whether `#40380`'s weak-password-acceptance defect still reproduces on this specific
  vendored tag requires either driving the installer's password field (a one-time flow, already
  past by the time `compose.yaml`'s `PS_INSTALL_AUTO: 1` has run) or exercising the back office's
  "change my password" form as an authenticated employee — both back-office-authenticated actions.

## Property

| | |
|---|---|
| **Type** | Safety |
| **Property** | Logging in to the back office with the vendored image's known default credentials (`demo@prestashop.com` / `prestashop_demo`) either fails (credentials were forced to change) or immediately requires a credential change before any other admin action is permitted. |
| **Invariant** | `Always` (if implemented): whenever an authenticated Bombadil-driven session is established using these default credentials, assert the very next reachable state is a forced-password-change form, not the normal dashboard. `Always` fits because this is a safety boundary that should hold unconditionally if the workload is extended to authenticate — there's no "sometimes acceptable" version of a fresh install shipping live, unchanged default credentials into a normal admin session. |
| **Antithesis Angle** | Once authenticated, fault injection could target the forced-reset flow itself (if one exists) — e.g. does interrupting the reset form submission (page reload, double-submit, network blip) ever leave the account in a state where it's usable with the *old* default password again, or in a half-reset state? This mirrors the `employee-creation-no-crash-on-race` pattern already confirmed elsewhere in this project: a timing-sensitive form flow around an auth-critical action. |
| **Why It Matters** | This is the exact mechanism `bugs.md` #7 names for full store takeover — a real, first-hand-confirmed finding on the vendored image (not a hypothetical), and the single highest-severity item in the "Security" section of `bugs.md`. |

**Open Questions:**

- Should Bombadil be extended to authenticate at all, and if so, does that mean a dedicated
  authenticated-session workload variant (separate from the anonymous storefront spec), or an
  extension of `bombadil/specification.ts` itself? This is the same open scoping question
  `sut-analysis.md` already raises catalog-wide — repeated here because this specific property is
  one of the most concrete, highest-value payoffs of resolving it. `(needs human input)`
- Does the currently-vendored `prestashop/prestashop:latest` tag predate or postdate the fix for
  `#40380` (PR `#40829`)? This determines whether the "average password accepted at install"
  sub-case is even still reproducible on this image, versus only the broader "default credentials
  were never forced to change post-install" claim (which is a separate, install-flow-level
  behavior not addressed by that PR at all — that PR only fixes password-strength *validation*,
  not the presence/absence of a forced-reset step, so it wouldn't fix #5/#7 even if fully applied).
  `(needs human input / needs version pinning per sut-analysis.md's catalog-wide open question)`

### Investigation Log

#### Are the three related closed permissions/auth issues (#40380, #29778, #37898) real, maintainer-confirmed defects or unvalidated reports?

- Examined: `gh api repos/PrestaShop/PrestaShop/issues/40380`, `.../29778`, `.../37898` for
  `state`, `state_reason`, `labels`, `comments` count; issue body and timeline for `#40380`
  specifically (`gh api repos/PrestaShop/PrestaShop/issues/40380/timeline`).
- Found: all three are `state_reason: completed` with a `Verified` label (maintainer-confirmed,
  not "not a bug"/stale-bot closures); `#40380` has an attached screen recording in its body and a
  cross-referenced fix PR (`#40829`, "Fix validate medium pass"), giving a specific, discriminating
  mechanism (installer accepted "prestashop" as a password) rather than just a headline.
- Not found: the actual diff/fix content of PR `#40829` (would confirm exactly what validation
  rule was added/strengthened, and thus what a regression test should target precisely); no
  investigation of `#29778`/`#37898` beyond their metadata (both flagged as related but
  lower-priority leads, not built into the Property fields above, since they're about customer
  passwords, not the admin-takeover scenario this property targets).
- Conclusion: `#40380` clears the validation bar (maintainer-confirmed, discriminating mechanism
  read, not just title) and is cited directly in Why It Matters/related context; `#29778` and
  `#37898` are recorded as adjacent leads for a future pass, not folded into this property's
  claims, since their exact mechanisms weren't read in this pass.
