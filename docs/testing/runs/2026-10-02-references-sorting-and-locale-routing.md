# References, sorting and locale routing - 2026-10-02

Run ID: `references-sorting-locale-routing-2026-10-02`.

## Scope

This run covers installation-wide human-readable task references, child reference
allocation, propagation through operational views, list sorting, reference
administration, backup/restore compatibility and translation-catalog selection
when a clock-format Unicode locale extension is active.

## Results

- The web suite passed 33 files and 108 tests, including complete catalog parity,
  clock-format locale normalization, Swedish/Danish body-text regression cases
  and final-report coverage for local plus external reference metadata.
- The production web build passed with all 19 registered regional language packs.
- The API build passed with zero warnings and zero errors.
- The isolated Compose E2E suite passed on a fresh PostgreSQL database after a
  complete backup and destructive restore rehearsal.
- Concurrent root creation produced unique task-type references from the shared
  installation sequence. Reference sorting was verified against the complete
  result page.
- Delegation produced `ROOT-1` and deeper `ROOT-1-1` references while preserving
  the same reference through Tasks, Planning, Execution, final report and report
  search.
- Operational first columns contain only the installation's local reference.
  Federated origin references remain separate provenance metadata and both values
  are included in on-screen, printed/PDF, archived and machine-API final reports.
- Community/Enterprise transitions, authentication boundaries, multi-level and
  cross-Site workflows, request/response/cancellation, authorization, dependencies,
  decisions, risks, webhooks, portability and federation candidate controls passed.
- Full repository-language, source-structure, documentation-link and version
  consistency checks passed.

## Defects found and resolved during the run

The run found and resolved three integration defects before delivery: a correlated
reference-administration query that failed after restore, response rows that lost
the selected reference sort order after projection, and a PostgreSQL `xmin` system
column omitted by the locked parent-reference query. The runner now prints recent
API logs automatically when an isolated E2E command fails.

The configured clock format creates locales such as `sv-SE-u-hc-h23`. Catalog
selection now resolves the locale base name before lookup, so the selected language
applies to the complete interface instead of only the navigation.

A rendered-registration follow-up found that an older list response could be
compared with a newly requested task permalink. Registration now activates the ID
returned by the creation endpoint, ignores superseded list responses and waits for
the exact current Site/scope/filter/search response before declaring a task missing.

The upgrade harness also replays the Site-content preservation migration against
synthetic pre-translation Sites. It requires complete legacy report/planning/execution
defaults to be restored, literal newline escapes to become real line breaks, a partly
customized workflow and customized report template to remain unchanged, and new
Sites to own stored English copies of every default.
