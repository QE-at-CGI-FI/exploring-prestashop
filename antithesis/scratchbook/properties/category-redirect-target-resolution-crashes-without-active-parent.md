---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/PrestaShop/PrestaShop/blob/6a22f8e2aacb51b2d83e9965eb50f92d691fd2a0/controllers/front/listing/CategoryController.php
    why: Sole primary evidence for this property — a defect found by direct source reading during this discovery pass, not from any bug report or issue. Read via gh api against develop HEAD commit 6a22f8e2aacb51b2d83e9965eb50f92d691fd2a0 (2026-09-29T14:17:30Z).
  - path: https://github.com/PrestaShop/PrestaShop/blob/6a22f8e2aacb51b2d83e9965eb50f92d691fd2a0/classes/Category.php
    why: getParentsCategories() — confirms the collection that getCategoryToRedirectTo() filters can legitimately be empty for a category with no ancestors.
  - path: /Users/maaretp/Documents/cgi-code/exploring-prestashop/antithesis/scratchbook/sut-analysis.md
    why: "Confirmed defect used as a regression-target property" section documents a structurally identical bug (non-nullable typed parameter/return meets an uncovered code path) in the employee-creation flow — this property is the storefront-side sibling of that same pattern.
---

# category-redirect-target-resolution-crashes-without-active-parent

## Lens

Protocol Contracts — redirect-chain correctness. This is a defect found directly during source
review for this discovery pass (not sourced from a GitHub issue or bugs.md), so there is no external
claim to validate — the "evidence" is the code itself, cited below with exact lines.

## The mechanism

`controllers/front/listing/CategoryController.php` (develop @ 6a22f8e2):

- `init()` (starting line 65), when a category is disabled or not in the current shop (line 96:
  `if (!$this->category->active || !$this->category->existsInShop(...))`), and the category has no
  explicit redirect target configured (line 98: `if (!$this->category->id_type_redirected && ...)`),
  and its `redirect_type` is `TYPE_PERMANENT` or `TYPE_TEMPORARY` (the "redirect to nearest active
  parent" modes, as opposed to a redirect to an explicitly-chosen category), calls:
  ```
  $this->category->id_type_redirected = $this->getCategoryToRedirectTo();
  ```
  (line 99).
- `getCategoryToRedirectTo()` (private method, lines 369–386):
  ```php
  private function getCategoryToRedirectTo(): int
  {
      $categoryToRedirectTo = null;
      foreach ($this->category->getParentsCategories() as $category) {
          if ($category['id_category'] != $this->category->id
              && $category['active'] == 1
              && ($categoryToRedirectTo === null || $category['level_depth'] > $categoryToRedirectTo['level_depth'])
          ) {
              $categoryToRedirectTo = $category;
          }
      }

      return $categoryToRedirectTo['id_category'];
  }
  ```
  The method's declared return type is the **non-nullable `int`**. If the `foreach` loop never finds a
  qualifying parent — either because `getParentsCategories()` returns an empty array (true for a
  category with no ancestors, e.g. the root category itself — see `classes/Category.php`'s
  `getParentsCategories()`, which walks up from `$this->id` and naturally returns `[]` for a
  parentless/root-level record) or because every returned parent is itself inactive — then
  `$categoryToRedirectTo` is still `null` at the `return` statement. `return null['id_category'];`
  first emits a PHP warning ("Trying to access array offset on value of type null"), evaluates to
  `null`, and then hits PHP 8's return-type enforcement: **returning `null` from a method declared to
  return non-nullable `int` is an uncaught `TypeError`**, producing a 500 response instead of any of
  the graceful outcomes (404/410/redirect-to-home) this switch statement otherwise implements for
  every *other* branch.

This is the same defect *shape* already confirmed elsewhere in this codebase (see
`sut-analysis.md`'s employee-creation crash: a legacy code path assumes a value will be present and
hands it to a strictly-typed boundary that doesn't accept the absent case) — independent discovery of
the same class of bug in a completely different subsystem (storefront category redirects vs.
back-office employee creation) is a useful signal that this pattern recurs across the codebase and is
worth treating as a property class, not a one-off.

## Trigger condition, precisely

A category must simultaneously be:
1. Disabled (`active = 0`) or removed from the current shop's association, **and**
2. Configured with `redirect_type` = "Category - Permanent redirection" or "Category - Temporary
   redirection" (`RedirectType::TYPE_PERMANENT` / `TYPE_TEMPORARY`) **and no explicit
   `id_type_redirected` target** (the "auto-pick nearest active parent" mode), **and**
3. Have no active ancestor category to fall back to — concretely, either the category itself is a
   root-level category (no parents at all) or every ancestor up to the root is also disabled.

This is an admin-configuration state, not something a shopper's URL alone can trigger — reaching it
requires either back-office configuration (disable a top-level category and set its redirect mode) or
a seeded fixture/initial-state that includes such a category, then a storefront visit to that
category's URL (which Bombadil's default navigation could stumble into once such a category exists
and is linked, or which a direct URL fuzz on `id_category` — see the sibling property
`malformed-identifier-params-degrade-to-4xx` — could also hit if it happens to land on that ID).

## Why it matters

It's a concrete, source-confirmed uncaught-`TypeError`-to-500 path — the exact failure shape the
discovery brief calls out ("malformed/edge-case ... parameters that should degrade to a proper
404/validation response but instead 500") except the trigger here is a category *state* (disabled +
misconfigured redirect + no active ancestor) rather than a URL parameter directly. A real shopper
would never construct this themselves, but a store owner disabling a top-level category for
maintenance — an entirely ordinary admin action — could accidentally put the storefront into this
state for anyone who has that category bookmarked or linked from search results, with no error
message, just a 500.

## Invariant and Antithesis angle

- **Type:** Safety.
- **Property:** Visiting a disabled category configured for permanent/temporary redirect resolution
  never crashes with an uncaught TypeError, regardless of whether an active ancestor exists to redirect
  to — it either redirects to a valid active ancestor or degrades to a plain 404/410, matching what the
  other branches of the same switch statement already do for their own edge cases.
- **Invariant (`Always`):** on any response from `controller=category`, assert the HTTP status is never
  5xx and the response body never contains fatal-error text — this specific property is best
  implemented as a narrower, differently-worded `always()` from the generic
  `noPhpFatalErrorRendered`/`noHttpErrorCodes` so that a failure here is attributed specifically to
  "category redirect resolution" in Antithesis's report rather than surfacing as an undifferentiated
  generic failure. `Always` fits because the guarantee ("never 500 here") must hold on every evaluation
  Bombadil performs, not just eventually.
- **Antithesis angle:** this is a state/configuration-dependent bug, not a timing race — Antithesis's
  fault injection doesn't need to interleave anything here; the main value is (a) confirming the
  mechanism reproduces against the actually-running container/PrestaShop version (source was read
  against `develop`, not the vendored tag — see the catalog-wide version-drift open question), and (b)
  once a workload/fixture creates the trigger state, continuously re-checking it stays fixed if
  PrestaShop patches it, functioning as a regression guard going forward.

## Open Questions

- Does the vendored `prestashop/prestashop:latest` tag (PS 9.1.4 as of the last recorded check) contain
  this exact code, or has it already been patched relative to `develop`? Not verified against the
  running container — this needs either a live repro attempt (configure a category as described above
  against the actual container) or fetching the same file at the tag matching the running version
  rather than `develop`. `(needs human input / a live repro against the running container)`
- Is there any existing back-office guard that prevents an admin from disabling a *root* category in
  the first place (which would make trigger condition 3 unreachable in practice even though the code
  bug exists)? Not investigated — only the storefront-side `CategoryController` was read, not the
  back-office category-edit form/validation layer. If such a guard exists, the practical trigger
  narrows to "every ancestor disabled" rather than "is the root," which is a rarer but still
  admin-reachable misconfiguration. `(needs code reading in the back-office Category admin
  controller/form type, not done in this pass)`
- Bombadil currently never logs into the back office (per `sut-analysis.md`'s open scoping question),
  so this property is not reachable through today's Bombadil workload unless (a) a fixture/initial-state
  seeds a category already in the trigger state, or (b) the workload is extended to configure categories
  via the admin UI. This is the same workload-scoping question already flagged catalog-wide, applied to
  this specific property. `(needs human input — same open question as sut-analysis.md's back-office
  scoping item, not a new one)`
