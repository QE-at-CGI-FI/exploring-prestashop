# order-message-lost-on-premature-reload

## Lens

Independently surfaced by two property-discovery lenses — **Lifecycle Transitions** (this file's
original author, which fully validated the mechanism against the primary GitHub source — see
below) and **Idempotency and Replay** (which framed it as a durability regression: pre-9.x
autosave used to make "type a message, then reload" safe, and no longer does — see "Idempotency
framing" below). Two independent lenses landing on the same property from different angles is a
confidence signal per `references/property-discovery.md` synthesis guidance. The Idempotency
lens's own evidence file (`order-message-not-lost-on-premature-reload.md`) was merged into this
one and removed to avoid a duplicate catalog entry.

One of the two "documented but not scripted" back-office lifecycle bugs the Lifecycle lens brief
pointed at directly (`tests/regression-bugs.spec.js` bottom-of-file note on `#39389`). Validated
against the actual upstream GitHub issue and its maintainer discussion (per
`references/validating-claims.md`), not just the repo's one-line paraphrase.

### Idempotency framing (from the merged lens)

Reload is a browser-native replay action hitting unsaved, in-progress state that a *previous*
version of this exact feature protected against losing (autosave via AJAX, pre-9.x) and no longer
does. That reframes this from "a missing write" (Lifecycle's framing) to also being a durability
*regression* — the system used to make this sequence safe and stopped. Both framings point at the
same fix target; the Idempotency lens adds the "or the UI must warn before discarding" alternative
to the invariant (see Property row below), which the original Lifecycle framing didn't include.

## Validation against primary evidence (not just the headline)

The repo's own comment (`tests/regression-bugs.spec.js:152-153`) reads: *"the 'Order message' field
only persists once 'Create order' is clicked; refreshing beforehand loses it (used to autosave via AJAX
pre-9.x)."* That's a lead, not yet a validated fact. I read the actual issue:

`gh api repos/PrestaShop/PrestaShop/issues/39389` — title *"Order creation (BO, 8.2.1): 'Order message'
not saved unless order is created"*. This is **not** a weak, uncommented single-reporter issue — it
carries labels `Bug`, `Regression`, `Ready`, `Verified`, has 6 comments, and:

- A PrestaShop maintainer (`paulnoelcholot`) explicitly reproduced it: *"I reproduce the issue with
  PrestaShop version 8.2.x, I'll add this to the backlog so it can be fixed."*
- A second reporter (`axel-paillaud`) confirmed it still reproduces in PS 9, with a second symptom
  (emailing the cart to the customer also drops the message).
- A third commenter (`boo-code`), who opened a follow-up issue `#42191` against 9.1.x, supplied the
  **actual root-cause mechanism** rather than just re-reporting symptoms: *"The read side already
  expects the message to be on the cart. `GetCartForOrderCreationHandler` fills the summary from
  `Message::getMessageByCartId()`, and `summary-renderer.ts` writes that value into the textarea. So a
  message attached to the cart would be displayed — nothing ever wrote one, which is why the field was
  always empty on return. The fix is the missing write rather than a new place to keep it: the message
  is stored against the cart in `ps_message`, which is where the reader already looks."*

This is the discriminating detail `validating-claims.md` asks for: it is not "the reporter's config" or
a misunderstanding — the **read path exists and is correctly wired** (`GetCartForOrderCreationHandler`
reads `Message::getMessageByCartId()`), but **nothing on the write path ever persists a message to the
cart** during the order-creation workflow prior to the final "Create order" submit. The bug is a missing
write, confirmed by someone who read the actual handler code, not a guess about symptoms. I located the
two files named in that comment in the current `develop` tree via `gh api
repos/PrestaShop/PrestaShop/git/trees/develop?recursive=1`:

- `src/Adapter/Cart/QueryHandler/GetCartForOrderCreationHandler.php` (the read side)
- `admin-dev/themes/new-theme/js/pages/order/create/summary-renderer.ts` (renders the textarea from that
  read)

I did not re-fetch and read the full bodies of these two files line-by-line (out of scope for discovery
per `property-catalog.md`'s "don't do additional deep research for the evidence file" guidance, and the
maintainer-adjacent comment already names the exact mechanism) — see Open Questions for what a follow-up
pass should confirm.

## Property

| | |
|---|---|
| **Type** | Safety |
| **Property** | An order message typed into the "Order message" field during back-office order creation is not silently discarded by a page reload, a shared/re-opened order-creation link, or emailing the cart to the customer before "Create order" is clicked — it either persists across that operation or the admin is warned it won't. |
| **Invariant** | `AlwaysOrUnreachable`: on the workload path that (1) opens BO order creation, selects a customer and cart, (2) types text into the order-message field, then (3) reloads the page or navigates away and back before clicking "Create order" — if that path executes, the message must still be present afterward (or, short of a fix, the field must have been visibly cleared with the admin warned, not silently emptied). `AlwaysOrUnreachable` fits because this is a workload-dependent scenario (typing-then-reloading is a specific scripted sequence, not something that happens on every order-creation flow) — "never executed" is fine, but if executed, the invariant must hold. |
| **Antithesis Angle** | This isn't really a *timing* race in the concurrency sense — it's a pure ordering/lifecycle gap: the write that should make the field durable across a reload was simply never implemented for the AJAX-driven flow (unlike the legacy 1.7.x controller, which autosaved). Antithesis's role here is less about fault injection and more about the *reload* action (a default Bombadil action generator, once back-office driving exists) reliably landing between "type message" and "click Create order" often enough to surface a bug that a fixed script might otherwise only check once. It's a good instance of the "an admin form save that assumes a preceding tab's/action's data is already persisted" pattern named in the lens brief. |
| **Why It Matters** | Confirmed real workflow impact from the issue thread: admins pre-fill an order message before sending a payment link to a customer over the phone (`thomasDelaporte`'s comment) — exactly the "reload/share the link" step in the repro — and the message is silently gone, breaking that workflow with no error shown. Maintainer-reproduced and still open as of the last comment (2026-08-06 for PS9), i.e., not yet fixed. |

**Open Questions:**

- This property requires Bombadil to authenticate into `/admin-dev/` and drive BO order creation (select customer, select cart, type order message, reload) — currently entirely out of reach for the anonymous-storefront-only Bombadil workload. **Blocked**, same as `employee-creation-no-crash-on-race`, on the open back-office-workload question in `sut-analysis.md`. `(needs human input)`
- I have not confirmed whether this reproduces on the specific `prestashop/prestashop:latest` tag this project vendors (the issue's most recent confirmation, `axel-paillaud`, is against "PrestaShop 9" generically, not a specific patch version, and this repo's own regression-bugs file records PS 9.1.4 as of 2026-08-14) — worth a quick manual repro against the running container before fully trusting this for a future scripted test, per the version-drift caveat in `sut-analysis.md`. `(partial: confirmed open/reproducing on PS 9 generically as of 2026-08-06; not confirmed on this project's exact pinned/floating tag)`
- Whether the "fix" (per `boo-code`'s analysis) is a small, already-drafted PR is unknown — I did not check for a linked PR against `#39389` or `#42191`. If a fix has landed since 2026-08-06, this property should be re-validated against the currently-vendored image before being treated as an active regression target rather than a general "field survives reload" hardening property.
