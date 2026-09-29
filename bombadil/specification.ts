// Bombadil specification for the storefront of the local PrestaShop instance
// (see ../compose.yaml — colima + `docker compose up -d`, http://localhost:8080).
//
// This is property-based/autonomous exploration, not a fixed script: Bombadil drives the
// browser using the default action generators (click things, fill inputs, scroll, navigate,
// reload) and continuously checks the properties below against every state it reaches.
//
// Run with e.g.:
//   npx bombadil browser test --time-limit=3m --output-path bombadil-output \
//     http://localhost:8080 bombadil/specification.ts
//
// Inspect a run with:
//   npx bombadil browser inspect bombadil-output

import { extract, always, actions, weighted, registerCustomAction } from "@antithesishq/bombadil";

// Generic baseline properties (uncaught JS exceptions, unhandled promise rejections, console
// errors, HTTP 4xx/5xx responses).
export {
  noHttpErrorCodes,
  noUncaughtExceptions,
  noUnhandledPromiseRejections,
  noConsoleErrors,
} from "@antithesishq/bombadil/browser/defaults";
// Default action generators (clicks, inputs, scroll, navigation, back/forward/reload). Not
// re-exported directly (see `actionMix` below, near the bottom of this file) — it's combined
// with a couple of custom actions instead of running standalone, so it isn't counted twice.
import { defaultActions } from "@antithesishq/bombadil/browser/defaults";

// --- Cart badge (header) -----------------------------------------------------------------
//
// The header cart link renders the item count as plain text in `.header-block__badge`,
// e.g. `<a ...><span class="header-block__badge">1</span></a>`.
// Factored out (rather than inlined in the extractor below) because a second property later in
// this file needs the same parsing logic without being allowed to read `cartBadgeCount.current`
// from inside its own extractor — Bombadil's runtime rejects that ("extractors must only depend
// on the 'state' parameter"), so the shared logic has to be a plain function, not a cross-read.
function parseCartBadge(state: { document: HTMLDocument }): number | null {
  const badge = state.document.querySelector(".header-block__badge");
  if (!badge) {
    return null;
  }
  const parsed = parseInt(badge.textContent ?? "", 10);
  return Number.isNaN(parsed) ? null : parsed;
}

const cartBadgeCount = extract((state) => parseCartBadge(state));

// Whatever Bombadil does to the cart (add, remove, change quantity, hammer the +/- buttons,
// reload mid-request, ...), the number shown in the header should always be a sane
// non-negative integer. A bug here would show up as e.g. "NaN", a negative count, or the
// badge silently disappearing while items are actually in the cart.
export const cartBadgeCountIsNonNegative = always(
  () => cartBadgeCount.current === null || cartBadgeCount.current >= 0,
);

// --- "Added to your cart" modal vs. header badge -----------------------------------------
//
// Adding a product opens `#blockcart-modal`, which independently reports the cart total in
// a sentence like "There is 1 item in your cart." / "There are 3 items in your cart.". This
// is a second, differently-rendered source of the same number as the header badge — a classic
// spot for cart total desync bugs (one place updates via AJAX, the other doesn't, a race
// between two quick clicks, etc.).
const cartModalReportedCount = extract((state) => {
  const modal = state.document.querySelector("#blockcart-modal");
  if (!modal) {
    return null;
  }
  const text = modal.textContent ?? "";
  const match = text.match(/There (?:is|are) (\d+) items? in your cart/i);
  return match ? parseInt(match[1], 10) : null;
});

export const cartModalAgreesWithHeaderBadge = always(
  () =>
    cartModalReportedCount.current === null ||
    cartModalReportedCount.current === cartBadgeCount.current,
);

// --- PHP-level fatal errors rendered into the page ---------------------------------------
//
// `noHttpErrorCodes` (from the defaults above) catches 4xx/5xx responses, but a PHP fatal
// error, uncaught exception, or Symfony "Whoops" debug page can render with a 200 status if
// caught by an outer handler. Treat that page text as a correctness violation in its own
// right, independent of status code.
const phpFatalErrorText = extract((state) => {
  const text = state.document.body?.textContent ?? "";
  const patterns =
    /Fatal error|Uncaught (Error|Exception|TypeError|ValueError)|Parse error:|Whoops, looks like something went wrong|An exception has been thrown/i;
  return patterns.test(text);
});

export const noPhpFatalErrorRendered = always(() => !phpFatalErrorText.current);

// ===========================================================================================
// Properties below this line come from a property-discovery pass using the antithesis-research
// skill (see antithesis/scratchbook/property-catalog.md for the full catalog, evidence files,
// and rationale — the comments here are short pointers, not the full analysis).
//
// A hard constraint discovered while implementing these: Bombadil's `extract()` only sees
// `state.document` / `state.window` (page-context DOM/JS state) — it has no access to raw HTTP
// status codes, response headers, or cookies (confirmed against the installed package's type
// definitions, and independently by an evaluation pass — see
// antithesis/scratchbook/evaluation/implementability.md). That ruled out implementing 3 cataloged
// properties here entirely: `session-cookie-lifetime-bounded`, `duplicate-session-cookie-single-write`,
// and `session-cookie-secure-flag-matches-transport` all need to inspect Set-Cookie headers, and
// PrestaShop's session cookies are HttpOnly on top of that (confirmed live via curl) — invisible
// to any page-context JavaScript, not just to Bombadil. Those three need a real HTTP client (this
// project already has Playwright in `tests/regression-bugs.spec.js`, which is the right place for
// them — Playwright's `page.on("response")`/`context.cookies()` go through the browser's CDP
// session, not page JS, so they don't hit this wall).
//
// Where a property needed something `document`/`window` alone couldn't see (an HTTP status code,
// an AJAX JSON response body), a `registerCustomAction` is used to fetch/intercept from *inside*
// the page — same-origin `fetch()` status codes and response bodies are readable by page JS (only
// `Set-Cookie` specifically is walled off by the browser, for every site, always). Both mechanisms
// below were validated live against the running stack before being written the way they are.
// ===========================================================================================

// --- Cart pricing/quantity integrity, using PrestaShop's own client-side cart state ---------
//
// Every front-office page that renders cart-aware content inlines a `var prestashop = {...}`
// object (confirmed live: it's a real global, not a documentation artifact) carrying the same
// cart data PrestaShop's own theme JS uses to update the page after AJAX actions. It's a far more
// precise source for cart arithmetic than scraping formatted price strings out of the DOM, since
// it gives raw numeric amounts instead of locale-formatted text.
type PrestashopCartProduct = {
  id_product: number;
  id_product_attribute: number;
  id_customization: number | string | null;
  cart_quantity: number;
  price_wt: number; // unit price, tax included
  total_wt: number; // line subtotal, tax included
  stock_quantity?: number;
  allow_oosp?: 0 | 1; // "allow order out of stock" — when truthy, exceeding stock is not a defect
};
type PrestashopCartState = {
  products: PrestashopCartProduct[];
  totals: { total: { amount: number } };
  subtotals: {
    products: { amount: number };
    shipping: { amount: number } | null;
    discounts: { amount: number } | null;
  };
  products_count: number;
} | null;

const prestashopCart = extract((state) => {
  const w = state.window as unknown as { prestashop?: { cart?: PrestashopCartState } };
  return w.prestashop?.cart ?? null;
});

// cart-quantity-can-exceed-stock-via-update-path
// (antithesis/scratchbook/properties/cart-quantity-can-exceed-stock-via-update-path.md): every
// cart line's quantity must be a sane non-negative number, and — unless the product explicitly
// allows out-of-stock ordering — must not exceed its stock. This is a **confirmed, source-grounded
// defect**, not a hypothesis: `CartController::processChangeProductInCart()` only runs its
// pre-write stock guard for `add` mode; the `update` mode (the cart page's +/- stepper) calls
// `Cart::updateQty(..., skipAvailabilityCheckOutOfStock: true)`, explicitly disabling it. Confirmed
// live on this exact deployment: posting an oversized `qty` to that same endpoint pushed a line's
// quantity into the billions, with `success:true` and no error at any level.
export const cartLineQuantitiesAreSane = always(() => {
  const cart = prestashopCart.current;
  if (!cart) return true;
  return cart.products.every((p) => Number.isFinite(p.cart_quantity) && p.cart_quantity >= 0);
});

export const cartLineQuantityNeverExceedsStock = always(() => {
  const cart = prestashopCart.current;
  if (!cart) return true;
  return cart.products.every((p) => {
    if (p.allow_oosp || typeof p.stock_quantity !== "number") return true;
    return p.cart_quantity <= p.stock_quantity;
  });
});

// quantity-stepper-double-click-no-race
// (antithesis/scratchbook/properties/quantity-stepper-double-click-no-race.md): a cart line's
// displayed subtotal must actually equal unit price times quantity — catches a race between rapid
// stepper clicks producing an inconsistent line total, independent of the stock question above.

export const cartLineSubtotalMatchesUnitPriceTimesQuantity = always(() => {
  const cart = prestashopCart.current;
  if (!cart) return true;
  return cart.products.every(
    (p) => Math.abs(p.total_wt - p.price_wt * p.cart_quantity) < 0.02, // 2-cent rounding tolerance
  );
});

// cart-total-matches-displayed-line-items
// (antithesis/scratchbook/properties/cart-total-matches-displayed-line-items.md): the grand total
// should equal the sum of line items, plus shipping, minus discounts — a mechanism-agnostic net
// that catches rounding, discount-interaction, and currency-conversion mismatches alike.
export const cartGrandTotalMatchesLineItemsPlusShippingMinusDiscounts = always(() => {
  const cart = prestashopCart.current;
  if (!cart) return true;
  const shipping = cart.subtotals.shipping?.amount ?? 0;
  const discounts = Math.abs(cart.subtotals.discounts?.amount ?? 0);
  const expected = cart.subtotals.products.amount + shipping - discounts;
  return Math.abs(cart.totals.total.amount - expected) < 0.02;
});

// add-to-cart-double-click-no-duplicate-line
// (antithesis/scratchbook/properties/add-to-cart-double-click-no-duplicate-line.md): the same
// product+combination should never appear as two separate cart lines (a duplicate would show up
// as the same key twice rather than one line with quantity 2).
export const noDuplicateCartLineForSameProductVariant = always(() => {
  const cart = prestashopCart.current;
  if (!cart) return true;
  const keys = cart.products.map(
    (p) => `${p.id_product}:${p.id_product_attribute}:${p.id_customization ?? ""}`,
  );
  return new Set(keys).size === keys.length;
});

// Strengthens the existing `cartModalAgreesWithHeaderBadge` property with a third, independently
// sourced count: PrestaShop's own client-side cart state (`prestashop.cart.products_count`),
// versus the rendered header badge. Two views already agreeing doesn't rule out both being wrong
// in the same way; tying in the app's own JS state closes that gap.
export const cartBadgeAgreesWithPrestashopState = always(
  () =>
    cartBadgeCount.current === null ||
    prestashopCart.current === null ||
    cartBadgeCount.current === prestashopCart.current.products_count,
);

// cart-state-survives-history-navigation (narrowed)
// (antithesis/scratchbook/properties/cart-state-survives-history-navigation.md): the cataloged
// property also asks about back/forward, which needs comparison against an explicit re-fetch —
// not yet implemented (see the evidence file). This narrower, still-free slice rides Bombadil's
// default `reload` action directly: reloading the *current* page should never by itself change
// the cart state, so if it does, either the reload silently mutated state or the page served a
// stale cached view instead of hitting the server.
let cartBadgeBeforeLastReload: number | null = null;
const reloadChangedCartBadge = extract((state) => {
  const badge = parseCartBadge(state);
  const violated =
    state.lastAction === "Reload" &&
    cartBadgeBeforeLastReload !== null &&
    badge !== null &&
    badge !== cartBadgeBeforeLastReload;
  cartBadgeBeforeLastReload = badge;
  return violated;
});

export const cartBadgeStableAcrossPureReload = always(() => !reloadChangedCartBadge.current);

// --- Price formatting consistency ------------------------------------------------------------
//
// price-formatting-consistent-across-pages
// (antithesis/scratchbook/properties/price-formatting-consistent-across-pages.md): first-hand
// finding on this deployment (this project's own bugs.md #14) is a currency/locale mismatch
// (UK country, EUR currency) — the generalizable, checkable version isn't "which currency is
// correct" but "is every rendered price formatted the same way as every other one." Accumulates
// the distinct (symbol, position, decimal-separator) shapes seen across the whole run; more than
// one distinct shape is a formatting inconsistency.
const seenPriceFormatShapes = new Set<string>();
const priceFormatShapeCount = extract((state) => {
  const text = state.document.body?.textContent ?? "";
  const matches = text.match(/[€$£]\s?\d[\d.,]*|\d[\d.,]*\s?[€$£]/g) ?? [];
  for (const m of matches) {
    const symbol = m.match(/[€$£]/)?.[0] ?? "?";
    const symbolIsPrefix = /^[€$£]/.test(m.trim());
    const decimalSeparator = /,\d{2}(\D|$)/.test(m) ? "," : /\.\d{2}(\D|$)/.test(m) ? "." : "none";
    seenPriceFormatShapes.add(`${symbol}|${symbolIsPrefix ? "prefix" : "suffix"}|${decimalSeparator}`);
  }
  return seenPriceFormatShapes.size;
});

export const priceFormattingConsistentAcrossPages = always(() => priceFormatShapeCount.current <= 1);

// --- Malformed-request probing, via an in-page fetch() (no raw navigation needed) ------------
//
// malformed-identifier-params-degrade-to-4xx
// (antithesis/scratchbook/properties/malformed-identifier-params-degrade-to-4xx.md): Bombadil's
// organic navigation never constructs malformed URLs (real links never contain them), so this
// needs its own probe. `fetch()` status codes are visible to page JS for same-origin requests
// regardless of cookies, so no interception trickery is needed here — just firing the requests.
// The historical instance of this property (#33306, product id=0 -> 500) is already fixed
// upstream; this checks the pattern doesn't regress and covers a couple of adjacent edge cases
// the fix didn't obviously need to consider.
const probeMalformedProductRequests = registerCustomAction(
  "probeMalformedProductRequests",
  async () => {
    const w = globalThis as unknown as { __bombadilMalformedProbes?: { url: string; status: number }[] };
    w.__bombadilMalformedProbes = w.__bombadilMalformedProbes || [];
    const urls = [
      "/index.php?id_product=0&controller=product",
      "/index.php?id_product=-1&controller=product",
      "/index.php?id_product=999999999999&controller=product",
      "/index.php?id_product[]=1&controller=product",
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url, { credentials: "same-origin" });
        w.__bombadilMalformedProbes.push({ url, status: res.status });
      } catch {
        // a network-level failure isn't itself a server defect; nothing to record
      }
    }
    if (w.__bombadilMalformedProbes.length > 40) {
      w.__bombadilMalformedProbes = w.__bombadilMalformedProbes.slice(-40);
    }
  },
);

const malformedProbeResults = extract((state) => {
  const w = state.window as unknown as { __bombadilMalformedProbes?: { url: string; status: number }[] };
  return w.__bombadilMalformedProbes ?? [];
});

export const malformedProductRequestsNeverReturn5xx = always(
  () => !malformedProbeResults.current.some((p) => p.status >= 500),
);

// --- Cart AJAX response-contract fidelity, via a direct same-origin probe --------------------
//
// cart-ajax-success-flag-decoupled-from-errors
// (antithesis/scratchbook/properties/cart-ajax-success-flag-decoupled-from-errors.md): the
// discovery pass found, by reading `CartController.php` directly, that the update-quantity AJAX
// endpoint can report `success:true` while a real problem is recorded only in a differently-named
// `errors`/`updateOperationError` field the theme's own JS never checks — so the client silently
// drops an error the server did try to report.
//
// An earlier version of this property intercepted organic AJAX traffic by monkey-patching
// `window.fetch`/`XMLHttpRequest`. That turned out to be a real mistake: a live 45s run with it
// installed hit a *new* `noUnhandledPromiseRejections` violation (a "Failed to fetch" from
// PrestaShop's own bundled JS) that a same-length run without the patch did not — most likely
// because replacing `window.fetch` with a non-native function breaks some library's "is this a
// real, unpolyfilled fetch?" feature-detection, which then takes a different, broken code path.
// Patching a global the page depends on to observe it is exactly the kind of test-introduced
// defect this project is trying to avoid, so that approach was removed. This version only ever
// calls `fetch()` itself (never reassigns `window.fetch`), so it can't perturb anything else on
// the page.
//
// Manually reproducing the exact success/error-mismatch condition (several `qty=0` /
// out-of-range-combination variations against the live update endpoint) did not trigger it in
// this session — the precise condition may need the real stepper's exact request shape, or may no
// longer reproduce on the currently-vendored image tag (see the version-drift caveat in
// antithesis/scratchbook/sut-analysis.md). The check itself is still worth keeping: it's a direct,
// narrow implementation of a source-confirmed response-contract gap, and costs nothing to leave
// running as a regression guard even on ticks where it doesn't fire.
const probeCartAjaxContract = registerCustomAction("probeCartAjaxContract", async () => {
  const w = globalThis as unknown as {
    prestashop?: { static_token?: string; cart?: PrestashopCartState };
    __bombadilCartAjaxProbes?: { url: string; body: string }[];
  };
  w.__bombadilCartAjaxProbes = w.__bombadilCartAjaxProbes || [];
  const token = w.prestashop?.static_token;
  const product = w.prestashop?.cart?.products?.[0];
  if (!token || !product) {
    return; // nothing in the cart yet to probe against
  }
  const url =
    `/cart?ajax=1&action=update&id_product=${product.id_product}` +
    `&id_product_attribute=${product.id_product_attribute}&token=${token}&qty=0`;
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    const body = await res.text();
    w.__bombadilCartAjaxProbes.push({ url, body });
  } catch {
    // a network-level failure isn't itself a server defect; nothing to record
  }
  if (w.__bombadilCartAjaxProbes.length > 20) {
    w.__bombadilCartAjaxProbes = w.__bombadilCartAjaxProbes.slice(-20);
  }
});

const cartAjaxProbeResults = extract((state) => {
  const w = state.window as unknown as { __bombadilCartAjaxProbes?: { url: string; body: string }[] };
  return w.__bombadilCartAjaxProbes ?? [];
});

export const cartAjaxNeverReportsSuccessWithSilentErrors = always(() => {
  return !cartAjaxProbeResults.current.some(({ body }) => {
    let parsed: any;
    try {
      parsed = JSON.parse(body);
    } catch {
      return false; // not a JSON cart-ajax response — nothing to check
    }
    const reportsSuccess = parsed?.success === true || parsed?.hasError === false;
    const hasNonEmptyError =
      (typeof parsed?.errors === "string" && parsed.errors.length > 0) ||
      (Array.isArray(parsed?.errors) && parsed.errors.length > 0) ||
      (typeof parsed?.updateOperationError === "string" && parsed.updateOperationError.length > 0);
    return reportsSuccess && hasNonEmptyError;
  });
});

// --- Action mix: default exploration plus the two probes above -------------------------------
//
// Weighted low relative to `defaultActions` so normal exploration dominates — these only need to
// fire occasionally, not on every step. Neither probe touches any global the page relies on.
export const actionMix = weighted([
  [30, defaultActions],
  [1, actions(() => [probeMalformedProductRequests()])],
  [1, actions(() => [probeCartAjaxContract()])],
]);
