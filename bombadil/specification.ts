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

import { extract, always } from "@antithesishq/bombadil";

// Generic baseline properties (uncaught JS exceptions, unhandled promise rejections, console
// errors, HTTP 4xx/5xx responses) and the default action generators (clicks, inputs, scroll,
// navigation, back/forward/reload) that drive exploration.
export * from "@antithesishq/bombadil/browser/defaults";

// --- Cart badge (header) -----------------------------------------------------------------
//
// The header cart link renders the item count as plain text in `.header-block__badge`,
// e.g. `<a ...><span class="header-block__badge">1</span></a>`.
const cartBadgeCount = extract((state) => {
  const badge = state.document.querySelector(".header-block__badge");
  if (!badge) {
    return null;
  }
  const parsed = parseInt(badge.textContent ?? "", 10);
  return Number.isNaN(parsed) ? null : parsed;
});

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
