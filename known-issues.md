# What PrestaShop cares about, and a known-issues listing

Source: [PrestaShop/PrestaShop issues](https://github.com/PrestaShop/PrestaShop/issues) (public GitHub API, unauthenticated, snapshot taken 2026-08-14), plus their [severity classification writeup](https://build.prestashop-project.org/news/2019/severity-classification/) and their bug report template.

## How they decide what matters (their own words)

They formally separate **severity** (objective damage: does it lose data, block core operations, affect >60%/>30% of users) from **priority** (what gets scheduled, decided by Dev+PM+QA together). Four severity tiers, each with a numeric user-impact threshold:

| Label | Threshold | Examples they give |
|---|---|---|
| **Critical** | >60% of users; data loss, security vuln, or breaks E2E tests | Can't access FO/BO, fatal errors, can't manage orders globally |
| **Major** | >30% of users; workaround exists but isn't obvious | Can't configure a module/theme, price calculation wrong |
| **Minor** | Workaround exists and is reasonable | Tolerable slowdown, dismissible error, inaccurate stats |
| **Trivial** | No functional impact | Cosmetic issues, wrong translation, missing confirmation toast |

Two explicit tie-breakers when severity is equal: **regressions get fixed before old bugs** (they don't want to ship a version worse than the last one), and issues that risk **damaging trust/brand image** get bumped up — a broken checkout looks worse to them than an equally-severe backend quirk. Security reports are explicitly routed *off* GitHub to security@prestashop.com — a public issue for a real vuln would be against their own process.

## Current backlog shape (live counts, 2026-08-14)

- **764** open issues labeled `Bug`
- **135** `Major`, only **2** `Critical` (multishop + Discount V2 interaction; a psgdpr module exception storm) — consistent with critical bugs getting patch-released fast rather than sitting open
- **12** open `Security` issues, anchored by an [EPIC: Security Roadmap](https://github.com/PrestaShop/PrestaShop/issues/31335) (multi-factor auth, brute-force protection, secure storage API — none shipped yet)
- **30** `Regression`, **50** `Performance`, **72** `Taxes and Prices`, **26** `Checkout`
- Triage is fast: only **5** issues sit in the untouched `New` state; **502** are `Verified` (reproduced) and **474** `Ready` to work; **193** are stuck `NMI` (needs more info from reporter — i.e., died on reproduction, a strong argument for writing tight repro steps)
- `Topwatchers` (6+ people following) sits at **121** open issues — the closest proxy to "the community is actually blocked by this"

### The `Regression` label doesn't match the stated policy

Their own severity writeup says regressions get prioritized *higher* than older bugs, precisely so a new version never ships worse than the last. The 30 open `Regression`-labeled issues don't show that in practice (checked 2026-08-14, ages computed from `created_at`):

- Oldest is **#26754**, open **4.7 years** (filed 2021-11-25)
- **27 of 30** (90%) have been open **more than a year**
- **21 of 30** (70%) have been open **more than 2 years**
- Median age: **~3.3 years** (1215 days); mean **~2.8 years** (1038 days)
- Only one, **#40379** ("Can't install a shop with docker", filed 2025-12-19), is under 8 months old

So either these are mislabeled (fixed but the label never got removed — plausible, since `Fixed`/`Regression` aren't mutually exclusive as labels), or "prioritize regressions" is aspirational rather than actually enforced once an issue ages past its first triage pass. Worth spot-checking a couple of the oldest ones (e.g. #26754, #27600) to see which explanation holds before reading too much into the stated policy.

## What the most-discussed open issues are actually about

Sorted by comment count — this is where users keep coming back to argue, which is a decent proxy for "this genuinely hurts":

1. **#14979** (159 comments) — Cart/checkout performance falls over with many products in the basket
2. **#11115** (111 comments) — Duplicate order reference for two different orders
3. **#9998 / #14703** — Carrier selection on checkout; `StockManager.php` queries are very slow on order status update
4. **#19810** — `ps_facetedsearch` sort-by-price doesn't work
5. **#27880 / #32227** — VAT/discount calculation on customer groups is wrong or under-specified
6. **#39630** (37 comments, "Open for contribution") — community actively wants an Admin API
7. Several install/localization pain points (#35044 Windows install failure, #9975 Cyrillic encoding mangled, #9599 missing email subject translation)

**Pattern**: the things that generate the most sustained community pushback are not cosmetic — they cluster around **checkout/cart correctness and performance, order/pricing calculation accuracy, and installation friction**. That lines up with their own severity criteria (checkout and order management are explicitly called out as Critical/Major territory).

## Reproduction pass: 30 open `Regression` issues, tried against a fresh install

Spun up `docker compose up -d` (prestashop/prestashop:latest → resolved to **PS 9.1.4**) and wrote Playwright tests for the subset of the 30 open `Regression` issues that don't need Multistore, the Webservice API, extra language packs, or SMTP-level inspection — see `tests/regression-bugs.spec.js`. Tests assert the *reported-buggy* behavior, so a pass means "still reproduces," a fail means "doesn't reproduce this way" (fixed, or the environment differs from the report).

Of the 3 actually scripted so far:

| Issue | Result | Notes |
|---|---|---|
| [#33306](https://github.com/PrestaShop/PrestaShop/issues/33306) FO product id=0 → 500 | **Does not reproduce** | Returns a clean 404 now — the behavior the reporter said they *expected*. Looks fixed since the 2023 report. |
| [#38072](https://github.com/PrestaShop/PrestaShop/issues/38072) cart rule saves with a no-op 0% discount | **Reproduces** | Confirmed: BO lets you save a cart rule that discounts nothing, no validation error. |
| [#32186](https://github.com/PrestaShop/PrestaShop/issues/32186) new Salesman employee gets "invalid token" on first login | **Does not reproduce** | A freshly created Salesman employee logs in cleanly and lands on their default page. Looks fixed since the 2023 report. |

**2 of the 3 don't reproduce anymore** — this is a small sample, but it's directly consistent with the earlier hypothesis that the `Regression` label likely isn't cleared once a fix ships, rather than these genuinely sitting broken for years.

**Incidental finding, not one of the 30**: while scripting #32186, submitting the new-employee BO form with a profile change but without letting its dependent "Default page" dropdown repopulate first throws an uncaught `TypeError` (`AbstractEmployeeHandler::assertHomepageIsAccessible(): Argument #1 ($tabId) must be of type int, null given`) — a 500 instead of a normal "this field is required" validation message. Real, reproducible, logged in `var/logs/prod-*.log`. Not filed upstream; flagging here rather than acting on it.

The remaining ~6 default-install-testable issues (#29346, #37739, #31789, #37993, #38078, #39389) have precise repro steps written up at the bottom of the spec file but weren't scripted this pass — each needs a bit more fixture setup (a second currency, a combination product, two stacked cart rules) that was worth writing down rather than guessing blind.

## Cross-reference: our `bugs.md` findings against their tracker

| Our finding | Status in their tracker |
|---|---|
| #8 Reassurance icons fail (`ERR_NAME_NOT_RESOLVED`, malformed `//modules/...` URL) | **Already reported**, near-exact match: [#41961](https://github.com/PrestaShop/PrestaShop/issues/41961), open, unlabeled/untriaged, 0 comments — filed 2026-07-05. Root cause confirmed: `blockreassurance` 5.1.4 seeds a protocol-relative icon path. |
| #10 Dashboard sales graph duplicate/nonsensical Y-axis ticks | No matching open issue found by search — likely underreported (dashboard/stats issues generally get low `Topwatchers`, consistent with "inaccurate stats" being explicitly filed under **Minor** in their own severity examples). |
| #18 `[Vue warn]` console noise on admin dashboard | No matching open issue found — dev-console noise wouldn't clear their reporting bar (no user-facing impact = doesn't fit their template's "why does this matter" ask). |
| #5–7 Default demo creds / plaintext HTTP / no forced reset | Not filed, and shouldn't be as a public issue if it were a real install — their own bug template explicitly redirects security reports to security@prestashop.com rather than public GitHub. On the official Docker demo image this is intentional (seeded demo data), not a vuln to disclose. |
| #12–13 Cookie duplication / 65-year `PHPSESSID` expiry | Not checked against tracker yet — worth a targeted search if pursued further. |

Only one item was checked deeply end-to-end (#8) since GitHub's unauthenticated search API is capped at 10 requests/minute; the rest were spot-checked or not yet searched.

## What this suggests for where to dig next

Given what actually draws sustained community engagement and matches their own "Major/Critical" criteria, the highest-signal areas to explore deeper (per the "areas to investigate deeper" idea in [[session1]]) are:

- **Checkout with a non-trivial cart** (many line items, combinations, discounts) — this is their most-argued-about open issue
- **Order + pricing/VAT calculation edge cases** (customer groups, discounts, multistore) — recurring theme across several Major-labeled issues
- **Faceted search / catalog filtering correctness**, not just that it renders
- Cosmetic/dev-noise findings (like the Vue warnings, dashboard graph) are real but sit below their own severity bar — useful for teaching "not all bugs are equally worth fixing," since PrestaShop's own process would likely park them too

## Not done (would need explicit go-ahead)

I did not file anything against the real PrestaShop/PrestaShop repo. If you want to report #10/#18/#12/#13 (the ones with no existing match) upstream, or add a confirming comment on #41961, that's a separate, visible action on someone else's project — say the word and I'll draft it for review first.
