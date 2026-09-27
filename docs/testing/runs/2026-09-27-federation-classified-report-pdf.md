# Federated classified report PDF run - 2026-09-27

Run ID: `federation-classified-report-pdf-2026-09-27`. The application base was commit `cf7af41`; the print-layout correction and focused regression test described here were the uncommitted test-code revision under verification. The normal production-like pair harness created an official `SECRET` answer through ordinary receiver report, approval and completion commands. The sender's ordinary report archive retained the receiver site-name snapshot and structured classification.

Headless Chromium 149 authenticated as the synthetic sender site leader over the TLS proxy and built web/Nginx gateway. The report screen showed `Synthetic Root b`, `Synthetic Secret`, the `(SECRET)` task marking and the official answer. The application’s own **Eksporter som PDF** action built its print iframe; Chrome DevTools `Page.printToPDF` captured that exact printable document as [the retained one-page evidence PDF](../../../output/pdf/federation-official-report.pdf).

| Control | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| Screen marking | Classification name is visible with the federated report | `Synthetic Secret` rendered with remote site header and answer | Pass; Chromium DOM assertion |
| Official header | Receiver site snapshot remains the report heading | `Synthetic Root b` rendered as H1 | Pass; DOM and PDF text |
| Structured task marking | Signed task marking remains visible | `(SECRET) Operational queued federated work` rendered | Pass; DOM and PDF text |
| PDF format | A4, readable, no clipping or unexpected pages | 1 A4 page after correction; 24,038 bytes; no forms, encryption or JavaScript | Pass; `pdfinfo`, `pdftotext`, Poppler render |
| Per-page classification | Classification repeats at top and bottom | Short report has two marks; six-page stress export has 12 marks and all six rendered pages show both | Pass; text count and visual page inspection |
| Regression | Print calculation and complete federation chain remain green | 81 web tests passed; production web build passed; pair ended `federationPair: passed` | Pass |

The first rendered export contained an empty second page. The final-page spacer filled the printable table body exactly to Chromium's rounded page boundary, pushing an otherwise empty fragment onto another page. The implementation now reserves a two-millimetre layout safety gap, with focused single- and multi-page calculation tests. The second export was one page and visually clean. The six-page synthetic stress export was an intermediate verification artifact and was removed after all pages were inspected.

This is synthetic browser/PDF evidence, not customer content. It does not enable production routing or replace representative load testing, retained-data policy, matched database/key-ring restore, external SMTP/STARTTLS delivery or independent security review. The disposable pair, browser container and volumes were removed after the full harness completed successfully.
