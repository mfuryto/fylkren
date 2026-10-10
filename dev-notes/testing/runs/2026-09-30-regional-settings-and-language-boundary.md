# Regional settings and repository language boundary - 2026-09-30

Run ID: `regional-settings-language-2026-09-30`. The change set was tested before
commit against base revision `079c1c2` and development version `0.70.0-dev.1`.
All fixtures and containers were disposable. Raw command logs were not retained.

| Control | Observed result | Result / evidence |
| --- | --- | --- |
| Fresh-install defaults | Public configuration returned English, UTC, a 24-hour clock and metric units | Pass; local Compose E2E assertion |
| Protected administration | Platform Manager could read and atomically update all four settings | Pass; authenticated E2E requests with antiforgery protection |
| Invalid time zone | `Invalid/Zone` was rejected and did not replace the stored settings | Pass; negative E2E assertion |
| Public configuration | A saved Norwegian/Oslo/12-hour/imperial selection appeared immediately in the anonymous sign-in configuration | Pass; E2E assertion |
| Return to source defaults | The same API restored English/UTC/24-hour/metric without a restart | Pass; E2E assertion |
| Persistence and recovery | The complete database/configuration/key backup was verified and restored; the application returned healthy | Pass; full local E2E restore scenario |
| Web localization contract | English lookup, Norwegian lookup, normalization and missing-language fallback tests passed | Pass; 30 test files and 89 web tests |
| Repository language boundary | New repository-facing files must be English; localized text is allowed only in dedicated non-English locale catalogs. Existing legacy markers cannot increase | Pass; `pnpm check:language` |
| Documentation and structure | Documentation links, source-size limits, language baseline and version consistency passed | Pass; maintained repository checks |
| Full regression | Authentication, session security, authorization, work routing, reporting, portability, backup/restore and federation-candidate scenarios passed | Pass; `pnpm test:e2e:local`, exit zero |
| Cleanup | Disposable containers, networks and volumes were removed | Pass; suite cleanup output |

The E2E source SHA-256 was
`01ab02f4fae3e1e5c483f6265ab3249bbb2602208b4ebe485ad447ca1aa2a8e1`.
The repository-language check SHA-256 was
`6eabb110195e93cce6fb614a76188ba7060e2e299f860123844c8abaf23ba0e9`.

This run establishes the storage, API and first localized Platform Manager page.
It does not claim that all legacy hard-coded GUI text has already moved into the
catalogs. The strict `pnpm check:language:full` gate remains intentionally open
until every legacy source and documentation marker has been removed. The
baseline check prevents that debt from growing while the migration proceeds.
