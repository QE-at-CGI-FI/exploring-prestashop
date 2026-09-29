---
sut_path: /Users/maaretp/Documents/cgi-code/exploring-prestashop
commit: 77b4b05d303516bdd44baa4f2281ab344193a1f4
updated: 2026-09-29
external_references:
  - path: https://github.com/prestashop/prestashop
    why: Checked for Antithesis SDK usage inside the SUT itself (not just the workload).
---

# Existing Assertions

## SUT-side (PrestaShop application source)

No Antithesis SDK assertions (`assert_always!`, `assert_sometimes!`, `assert_reachable!`,
`assert_unreachable!`, or non-macro equivalents in any language SDK) exist in the PrestaShop
codebase. Searched `github.com/prestashop/prestashop` (via `gh api search/code`) for
`antithesis` and found no matches. This is expected — PrestaShop is unmodified upstream
software; this project does not fork or patch it, so SUT-side instrumentation is not available
without maintaining a PrestaShop fork, which is out of scope for this project. Every property in
`property-catalog.md` that would benefit from SUT-side instrumentation notes it as
**aspirational / not actionable without forking the SUT** rather than a near-term recommendation.

## Workload-side (Bombadil)

Bombadil's `always()`/`extract()` calls in `bombadil/specification.ts` are the project's actual
existing property layer (Bombadil's own assertion primitive, not the general Antithesis SDK
macros, but functionally the same role: a continuously-checked invariant against the state
Bombadil observes). Recorded here as the baseline the property catalog extends:

| Export | File:Line | Type | What it checks |
|---|---|---|---|
| `cartBadgeCountIsNonNegative` | `bombadil/specification.ts:39-41` | `always` | Header cart badge (`.header-block__badge`), if present, parses to a non-negative integer |
| `cartModalAgreesWithHeaderBadge` | `bombadil/specification.ts:60-64` | `always` | The "N items in your cart" modal count, if present, equals the header badge count |
| `noPhpFatalErrorRendered` | `bombadil/specification.ts:79` | `always` | No PHP fatal-error / uncaught-exception / Whoops text appears in the rendered page body |

Plus the re-exported defaults (`export * from "@antithesishq/bombadil/browser/defaults"`):
generic baseline properties for uncaught JS exceptions, unhandled promise rejections, console
errors, and HTTP 4xx/5xx responses, plus the default action generators (click, fill, scroll,
navigate, back/forward/reload).

None of the properties below duplicate these three or the defaults; each is either a distinct
invariant or an explicit strengthening (noted in its evidence file where applicable).
