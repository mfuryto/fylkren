# E2E-01 keyboard dialog - 2026-09-27

Run ID: `e2e-01-keyboard-dialog-2026-09-27`. The application base was clean commit `3d75ad2`. The corrected modal component (SHA-256 `b6857d5245723d9e50095b2ab3f5e830513664d1ac68fb51ae1908095f839fef`), shared theme (`a01ff930f4eaae74390de9e1ea4bcdd24d44856d52ae8dc395d996f7f07b0ae0`), maintained Chromium script (`3aef0d8fbd779243a25d5d2cc4bfe37e74149b17da52522439a7bdcadc856206`) and keyboard helper (`246ee1bee5f67a72a17ad391ae684c9f407f4e913a5db598dbdbcb27df485add`) were the uncommitted revision under verification. Chrome 151.0.7922.109 ran against a production-built web image and fresh Community application, PostgreSQL and Data Protection volumes in the isolated `fylkren-browser-acceptance` project.

The clean command was `node tools/e2e/community-browser-smoke.mjs --task-flow --keyboard`. The task-registration opener received focus and was activated by a DevTools `Enter` key event. The harness then inspected the live accessibility tree and exercised focus with browser key events; it did not invoke the dialog controls through DOM `click()` during this control. After dismissal it reopened the dialog and completed the ordinary rendered E2E-01 lifecycle.

| Control | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| Keyboard activation | Focused task action opens without a pointer | `Enter` opened **Registrer oppgave** | Pass; DevTools key input |
| Dialog semantics | Assistive technology receives modal role and name | Accessibility tree contained a `dialog` named `Registrer oppgave`; DOM exposed `aria-modal=true` with a unique label reference | Pass; `accessibleDialogTree: true` |
| Initial focus | Opening does not leave focus behind the overlay | Focus moved to a visible control inside the dialog | Pass; active-element assertion |
| Reverse containment | `Shift+Tab` at the first control remains inside | Focus wrapped to the final dialog control | Pass; focus-index assertion |
| Forward containment | `Tab` at the final control remains inside | Focus wrapped to the first dialog control | Pass; `keyboardModalNavigation: true` |
| Visible focus | Keyboard location is perceptible | The next tab stop matched `:focus-visible` with an outline of at least two pixels | Pass; `visibleKeyboardFocus: true` |
| Dismissal | A dismissible dialog closes with `Escape` | Dialog closed without pointer input | Pass; DOM postcondition |
| Focus restoration | Context returns to the action that opened the dialog | The **Ny oppgave** button regained focus and could reopen the dialog with `Enter` | Pass; active-element and reopen assertions |
| Adjacent E2E-01 chain | Focus management does not break ordinary work | Registration, assessment, execution, report, archive, overview, workload, audit, notification, classification and separate-approver controls passed; zero browser errors | Pass; final JSON result |
| Disposable cleanup | No synthetic installation remains | Chromium, application, PostgreSQL, networks and volumes were removed after the run | Pass; cleanup output |

The review found that the shared modal already exposed `role=dialog`, `aria-modal` and a heading reference, but did not move, contain or restore focus and did not handle `Escape`. The product correction adds those behaviors, assigns a unique heading ID to each modal, and supplies a shared visible focus style for links, buttons, explicit tab stops and rich-text editors.

Two exploratory runs are not acceptance evidence. Both stopped at keyboard activation because the helper initially sent `Enter` as a raw scan-code event; adding its text payload was still insufficient. Matching Chromium's expected `keyDown` event for a text-producing `Enter` corrected the driver, after which the complete scenario was reset and passed. No application deviation occurred in those two runs because the registration dialog never opened.

This closes the focused modal keyboard and accessibility-tree control for the automated E2E-01 subset. It does **not** claim every page is operable by keyboard, a screen-reader usability audit, zoom/high-contrast conformance, multiple browser engines or formal WCAG certification. E2E-01 and roadmap gate 3 remain open.
