# employee-creation-no-crash-on-race

## Lens

Lifecycle Transitions (parallel property-discovery ensemble). This is the seed example named
directly in `sut-analysis.md`'s "Confirmed defect used as a regression-target property" section —
turning it into a precise, checkable property is goal (a) of this lens; goal (b) is looking for the
same *shape* of bug elsewhere (see the other four evidence files in this batch).

## The bug, restated as a lifecycle-ordering problem

The add-employee back-office form has an implicit ordering assumption: the "Default page" `<select>`
is repopulated by a profile-scoped AJAX call (`GET /employees/tabs`) every time the "Profile" dropdown
changes, restricting the options to pages that profile may access. The form does not disable its Save
button while that AJAX call is in flight, and does not re-validate that the AJAX call has completed
before serializing and submitting the form. If the user (or a scripted/automated actor) changes the
profile and clicks Save before the tabs response lands, `default_page` submits empty/missing.

## Confirmed mechanism (already validated in sut-analysis.md, restated here for the evidence trail)

- `AddEmployeeCommand::__construct()` (`src/Core/Domain/Employee/Command/AddEmployeeCommand.php`)
  stores `$defaultPageId` with no type hint and no cast: `$this->defaultPageId = $defaultPageId;`.
- `AddEmployeeHandler::handle()` (`AddEmployeeHandler.php:74`) calls
  `assertHomepageIsAccessible($command->getDefaultPageId(), $command->getProfileId())`.
- `AbstractEmployeeHandler::assertHomepageIsAccessible(int $tabId, int $profileId): void`
  (`src/Adapter/Profile/Employee/CommandHandler/AbstractEmployeeHandler.php`) declares `$tabId` as a
  non-nullable `int`. A `null` (from the empty/missing form field) is not silently coercible by PHP
  into a non-nullable typed parameter -> uncaught `TypeError` -> HTTP 500, instead of a normal
  validation-error response.
- Contrast: `EmployeeFormDataHandler` (the **edit** path) explicitly does
  `->setDefaultPageId((int) $data['default_page'])` before building its command — the *add* path is
  the one missing the cast. This asymmetry between add/edit is the discriminating detail that makes
  this a real, narrow code defect rather than a form-validation gap that also exists on edit.
- Locally reproduced in `tests/regression-bugs.spec.js` (see the comment above the `#32186` test and
  the "documented but not scripted" preamble) while building the `#32186` Salesman-login regression
  test — the test explicitly `await tabsResponse` before selecting `default_page` specifically to
  avoid this crash.

## Property

| | |
|---|---|
| **Type** | Safety |
| **Property** | Submitting the add-employee form never produces an uncaught server error (HTTP 500 / rendered `TypeError`); a missing or stale `default_page` value is surfaced as a normal form validation error instead. |
| **Invariant** | `Always`: after any add-employee form submission (`POST` to the employee "new" controller action), the response is never an HTTP 5xx and the rendered page never matches the existing `noPhpFatalErrorRendered` fatal-error text patterns (`Fatal error`, `Uncaught (Error\|Exception\|TypeError\|ValueError)`, etc.) or a raw stack trace — it's either a success redirect or a rendered form with a field-level validation message. `Always` fits because this must hold on *every* submission of this form, not just the racy one; the raced path is one way to reach the failing input, not a precondition that gates whether the check applies. |
| **Antithesis Angle** | This is a client-side timing race, not a server concurrency race: the defect is reachable purely by controlling the *delay* between two sequential actions in one browser session (change profile -> submit) relative to one in-flight AJAX call. Antithesis's network-fault injection (added latency, a delayed/dropped response to `GET /employees/tabs`) directly widens or guarantees the window that today only shows up by accident (as it did while writing `regression-bugs.spec.js`). This is exactly the "submit-before-dependent-load-resolves" pattern the Lifecycle Transitions lens is scoped to find. |
| **Why It Matters** | A form field that's normally validated (missing default page) currently degrades to an unhandled 500 instead of a validation message — a real, narrow input-validation gap. It also blocks a whole employee-creation attempt with a confusing crash page rather than telling the admin what to fix. Not filed upstream as of this analysis (see `tests/regression-bugs.spec.js` header comment: "a real bug, just not one of the 30 in scope here, and not filed anywhere"). |

**Open Questions:**

- This property requires Bombadil to authenticate into `/admin-dev/` and drive the add-employee form — currently out of scope for the anonymous-storefront-only Bombadil workload. **Blocked** until the open question in `sut-analysis.md` ("Should the Bombadil workload be extended to also drive the authenticated back office?") is resolved. `(needs human input)`
- Is this reachable in `prestashop/prestashop:latest` as currently pinned/floating, or only confirmed against `develop`? The mechanism was read from `develop` (2026-09-29) and *locally reproduced* against the running image while building `regression-bugs.spec.js`, so this one is stronger than a pure source-read — but the version-drift caveat in `sut-analysis.md` still applies to future re-runs.

## What changes if the back-office question resolves "yes"

If Bombadil is extended to log in and drive `/admin-dev/`, this becomes directly actionable: a workload
action sequence of (open add-employee form, change Profile, immediately submit without waiting for
`/employees/tabs`) plus the `Always` assertion above is a near-literal transcription of the existing
Playwright repro into a continuously-fuzzed Bombadil property, and Antithesis's fault injection can push
the timing window further than a fixed script can.
