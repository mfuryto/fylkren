# Stored content and mail-header injection — 2026-09-27

Run ID: `stored-content-mail-header-injection-2026-09-27`. The application base was commit `d6f5e77`; the maintained browser and SMTP assertions described here were the uncommitted test revision under verification. Chrome 151.0.7922.109 ran against a freshly migrated Community installation, PostgreSQL 18, a synthetic SMTP sink and new database/Data Protection volumes in the isolated `fylkren-browser-security` Compose project.

The clean command was `node tools/e2e/community-browser-smoke.mjs --task-flow --smtp` with the disposable DevTools, application and mailbox endpoints supplied through the documented environment variables. The ordinary rendered task form stored an HTML/script/event-handler payload in the task description. Chromium then opened the description and required the literal payload text while rejecting any corresponding DOM element, executable script or global marker. Before valid SMTP configuration, the same run sent a CRLF/Bcc display-name payload and required HTTP 400. No payload body, session material or credentials were retained.

| Control | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| Stored active content | HTML, script and event-handler syntax remains inert | Literal payload was visible; no injected element, script or marker existed | Pass; `storedContentInjection: true` |
| Mail-header boundary | CRLF/Bcc display name is rejected before settings change | Configuration returned HTTP 400 | Pass; `smtpHeaderInjectionRejected: true` |
| Rich-text rendering unit boundary | Stored markup is encoded in server-rendered React output | Script and image tags were emitted only as escaped text | Pass; frontend test suite, 83 tests |
| Adjacent task lifecycle | Security payload does not break ordinary work | Registration, assessment, execution, report, archive, workload and audit passed | Pass; `topLevelTaskBrowserFlow: passed` |
| SMTP behavior | Valid configuration still retries and delivers normally | Transient failure, retry, mailbox receipt and recipient boundary passed | Pass; SMTP flags true |
| Browser health | Expected rejected request does not hide unrelated errors | Expected 400 was accounted for; final browser error count was zero | Pass; `browserErrors: 0` |
| Disposable cleanup | Synthetic state does not remain | Browser, application, SMTP sink, networks and volumes were removed | Pass; cleanup output |

Two exploratory attempts preceded the clean run. The first assertion searched only visible body text while the description disclosure was still collapsed; the stored value was intact and inert, but the harness had not opened the documented content. The harness was corrected to open the disclosure and wait for the literal marker. The next complete application flow passed both security controls, but the generic browser-error collector treated the deliberately rejected SMTP request as an unexpected 400. Expected rejection handling was made explicit and narrow, after which a new reset fixture passed the entire chain with zero remaining browser errors.

This run covers representative stored HTML/script/event-handler input and one SMTP display-name header-injection boundary. It does not claim complete injection, WYSIWYG paste/drop, custom-CSS, LDAP, SQL, template, all mail fields, all browser engines or penetration-test coverage. Those remain governed by the security test plan and ASVS matrix.
