# Bugs found so far

Touring (home → search → category → product → add to cart → cart → admin login → admin dashboard) against a fresh install. "Bug" here means anything that might bug a user.

## Placeholder / default content

1. Homepage hero banner and "Custom Text Block" still show default Lorem-ipsum placeholder copy ("SAMPLE 1", "EXCEPTEUR OCCAECAT", "Lorem ipsum sit amet conse ctetu...") instead of real content.
2. Product page, cart page, and checkout sidebar all display unedited "Security policy / Delivery policy / Return policy (edit with the Customer Reassurance Module)" placeholder text, visible to real shoppers.
3. Store name ("my store") and contact email (`demo@prestashop.com`) are still the untouched installer defaults.
4. Fresh install already contains fixture/demo order data (5 fake orders for "John DOE" with statuses like "Payment error", "Canceled") mixed into the live admin dashboard, which could be mistaken for real orders.

## Security

5. Admin back office logs in successfully with the well-known default demo credentials (`demo@prestashop.com` / `prestashop_demo`) — installer never forces a credential change.
6. Entire site, including the admin login form, is served over plain HTTP, so admin credentials and session cookies travel unencrypted.
7. Predictable-once-known admin path + default credentials + no 2FA/forced reset = full store takeover for anyone who's seen this Docker image before.

## Broken / rendering bugs

8. Reassurance icons (security/carrier/parcel SVGs) fail to load — browser console shows `net::ERR_NAME_NOT_RESOLVED` for a malformed URL (`http://modules/blockreassurance/...`, missing the actual host). ([#41961](https://github.com/PrestaShop/PrestaShop/issues/41961))
9. Admin dashboard's right-hand news/marketplace panels are visually clipped/overflowing ("Pr Ne...", "Lear Grov your busi...") — text cut off outside its container.
10. Dashboard "Sales" graph Y-axis shows duplicate/nonsensical tick labels (1, 1, 0, 0, 0, 0, -1, -1, -1) instead of a clean scale.
11. Shopping Cart page breadcrumb shows only "Home" with no separator or current-page label, inconsistent with breadcrumbs on other pages.

## Session & cookies

12. Homepage response sets the same `PrestaShop-<hash>` session cookie twice with two different values in a single response — redundant/conflicting `Set-Cookie` header.
13. `PHPSESSID` cookie is issued with a ~65-year expiry (`expires=2083`, `Max-Age=1788458201`) instead of a normal session/short-lived cookie.

## Locale & data mismatches

14. Store country is set to United Kingdom but the storefront currency defaults to EUR, not GBP — locale mismatch.
15. Searching "shirt" returns only the t-shirt, not the near-identical "Hummingbird printed sweater" of the same design — search matches literal name substrings only, no related-product awareness.

## Admin UX / noise

16. On first login, the dashboard immediately shows a "your store encounters an issue... Verify your store" warning with no explanation of what's actually wrong.
17. Notification bell shows 7 unread items on a brand-new, never-used install.
18. Admin dashboard emits `[Vue warn]` console warnings ("Vue received a Component that was made a reactive object...") — dev-grade noise leaking into the admin UI.

## Backend errors

19. BO > Team > Add new employee: submitting the form after changing the Profile field (which triggers an AJAX refresh of the dependent "Default page" dropdown) without waiting for that refresh throws an uncaught `TypeError` and a 500, instead of a normal "this field is required" validation message (`AbstractEmployeeHandler::assertHomepageIsAccessible(): Argument #1 ($tabId) must be of type int, null given`, logged in `var/logs/prod-*.log`). Found incidentally while scripting a regression test in `tests/regression-bugs.spec.js`; not filed upstream.
