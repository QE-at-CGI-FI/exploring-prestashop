---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
---

# voucher-code-resubmit-not-double-applied

## Lens

Idempotency and Replay — resubmitting the same state-changing request (a voucher/cart-rule code
application) a second time.

## What led to this property

The task brief names this scenario directly: "Applying the same voucher code twice in a row —
does the system correctly reject the duplicate rather than double-applying the discount?" and asks
to validate against the actual PrestaShop cart-rule application code if locatable via
`gh api search/code`.

I attempted this. Both `gh api search/code` calls in this session (for `addDiscount` and for
`CartController voucher`) returned `403 API rate limit exceeded`, and the tool's own system
message clarified this is "a shared secondary rate limit... shared across all tools and agents" in
this environment, not specific to this GitHub account (confirmed: `gh api rate_limit` reported
`search: remaining 30/30` immediately before and after the failing calls). Per the instruction not
to retry in a loop, I did not keep attempting. **This means the core mechanism this property is
supposed to validate against source is unconfirmed** — the property below is written as a claimed
guarantee to test (the ordinary shopper expectation that re-entering the same code doesn't double
a discount), not a source-confirmed defect, consistent with `validating-claims.md`'s treatment of
an unvalidated claim: it does not get stated as a fact, and the gap is recorded as an open question
rather than papered over.

Independently, `closed-bugs-last-year.md`'s "Cart rules / discounts / vouchers" category (7 issues)
contains two issues whose titles describe exactly the class of bug this property would catch if it
exists:

- [#19393](https://github.com/PrestaShop/PrestaShop/issues/19393) "CART RULE - cart rule is applied even when you disabled" (2024 days open)
- [#40116](https://github.com/PrestaShop/PrestaShop/issues/40116) "Problem in the logic for checking the validity of a shopping cart rule" (0 days open — recent)
- [#36982](https://github.com/PrestaShop/PrestaShop/issues/36982) "Disabled or expired voucher is not removed from the cart" (447 days open)

I have **not** read these issues' bodies/comments/resolutions — per `validating-claims.md` these
are headlines only, i.e. leads, not validated mechanisms. They are cited here as evidence that
"the logic for (re-)validating whether a cart rule should currently apply" is a recurring,
plausibly-fragile area in this codebase (three separate issues about validity-checking logic in
one small category), which is exactly the logic a double-submit of the same code would exercise a
second time. That is the extent of what this pass supports: a bug-density signal, not a confirmed
mechanism.

## What goes wrong if this is violated

- The discount is applied twice (e.g., a 10%-off code reduces the total by 20% instead of 10%,
  or a fixed-amount voucher subtracts its amount twice) — a direct, quantifiable revenue-impacting
  bug, and one a shopper could plausibly trigger by accident (impatient double-click on "Add" next
  to the promo code field) rather than by any malicious intent.
- The cart summary lists the same voucher/cart-rule name twice as separate line items, which is
  confusing even if the arithmetic happens to still be correct (e.g., if the second submission is
  silently a no-op but still renders a redundant UI row).

## Property Catalog Entry

### voucher-code-resubmit-not-double-applied — Resubmitting the same voucher code never doubles the discount

| | |
|---|---|
| **Type** | Safety |
| **Property** | Submitting the same cart-rule/voucher code a second time in immediate succession (rapid double-click on the "Add" control, or a back/forward resubmission) never doubles the applied discount amount and never lists the same cart-rule name twice in the cart's discount summary. |
| **Invariant** | `AlwaysOrUnreachable`. Extract the set of distinct discount/cart-rule names shown in the cart summary and their individual reduction amounts; whenever at least one voucher/cart-rule is present in the observed state, assert each name appears at most once and the total reduction attributable to that rule does not exceed what a single application of its configured discount would produce. `AlwaysOrUnreachable` (not `Always`) because applying any voucher at all is an optional, workload-dependent path for the current anonymous, no-seeded-cart-rule Bombadil configuration — most runs may never reach a state where a voucher is present at all, and "never executed" is an acceptable outcome; but any run that does reach it must satisfy the invariant. |
| **Antithesis Angle** | Exercises PrestaShop's cart-rule (re-)validation logic under rapid double-submit and (via the default back/forward action generators) resubmission-by-navigation, timing conditions Bombadil already produces without new action-generator work. The closed-bug cluster around "logic for checking the validity of a shopping cart rule" (`closed-bugs-last-year.md`, 3 of 7 issues in the category) suggests this validation path has a history of edge-case bugs, making it a plausible target for Antithesis's scheduling exploration to land on a not-yet-fixed variant. |
| **Why It Matters** | `sut-analysis.md` notes cart rules/discounts is a *small* raw closed-bug count (7) but "structurally overlaps the much larger calculation/pricing/tax category" (47, the largest category) "because many pricing bugs are cart-rule interaction bugs" — a double-applied discount is precisely that overlap. |

**Open Questions:**

- Does PrestaShop's server-side handler for "apply cart rule by code" treat a resubmission of an already-applied code as a no-op (checked, e.g., by code-uniqueness-in-cart before applying) or does it re-run the full application logic and only rely on some other invariant to prevent double-counting? Not confirmed against source — both `gh api search/code` attempts in this session hit a shared rate limit (see Investigation Log). This is the central mechanism question for this property and should be attempted again before this property is prioritized for implementation. `(needs investigation once rate limit resets)`
- The current Bombadil workload runs anonymously against a fresh install with no active/seeded cart rule or promo code known to it — does this install have any default demo voucher code, or does exercising this property require extending the initial-state workload to seed one via the admin API/back office first (as `sut-analysis.md`'s Wildcard section suggests: "a slightly richer initial-state workload... an active cart rule")? Not checked against the running instance in this pass. `(needs human input / needs workload change)`

### Investigation Log

#### Does resubmitting the same voucher code double-apply the discount?

- Examined: attempted `gh api search/code` for `repo:PrestaShop/PrestaShop addDiscount language:php` and for `repo:PrestaShop/PrestaShop CartController voucher`, both in this session. Also ran `gh api rate_limit` before and immediately after, which reported `search: remaining 30/30, used 0` both times — i.e. my own account's documented quota was not exhausted, yet the calls still returned `403 API rate limit exceeded` with a message pointing at a shared/scraping-protection limit.
- Found: nothing from source. Found (secondhand, from `closed-bugs-last-year.md` headline text only, not read further): three open issues in the cart-rules/discounts category whose titles describe validity-checking bugs (#19393, #40116, #36982) — a bug-density signal, not a mechanism confirmation.
- Not found: the actual cart-rule application handler, whether it deduplicates by code before applying, and whether any of the three cited issues' resolutions describe a mechanism resembling double-submission.
- Conclusion: left open, tagged `(needs investigation once rate limit resets)` rather than `(needs human input)` — this looks mechanically resolvable (retry the search, or read one of the three issues directly) once the shared rate limit clears, not a question that requires a human decision.
