# Localization and language packs

Fylkren separates repository language from product language. Source code, identifiers, tests, examples and maintained documentation are written in English. User-visible product text is resolved through bundled language catalogs and does not require an Internet service.

## Current language roster

| Locale | Language | Status |
| --- | --- | --- |
| `en-US` | English (United States) | Source catalog and mandatory fallback |
| `en-GB` | English (United Kingdom) | Bundled regional catalog |
| `nb-NO` | Norwegian Bokmal | Bundled catalog |
| `sv-SE` | Swedish | Bundled catalog |
| `da-DK` | Danish | Bundled catalog |
| `fi-FI` | Finnish | Bundled catalog |
| `de-DE` | German | Bundled catalog |
| `fr-FR` | French | Bundled catalog |
| `pl-PL` | Polish | Bundled catalog |
| `es-ES` | Spanish (Spain) | Bundled catalog |
| `it-IT` | Italian | Bundled catalog |
| `uk-UA` | Ukrainian | Bundled catalog |
| `nl-NL` | Dutch | Bundled catalog |
| `pt-PT` | Portuguese (Portugal) | Bundled catalog |
| `cs-CZ` | Czech | Bundled catalog |
| `ro-RO` | Romanian | Bundled catalog |
| `et-EE` | Estonian | Bundled catalog |
| `lv-LV` | Latvian | Bundled catalog |
| `lt-LT` | Lithuanian | Bundled catalog |

The legacy locale value `en` is treated as `en-US` and upgraded to that explicit value. No additional locale is considered supported until its complete bundled catalog, locale behavior, documentation and automated tests are delivered together.

## Translation phase after the English migration

The English migration gate passed and the product owner approved the following translation order. Every listed catalog is technically complete and selectable. Linguistic assurance follows the automated quality gate below rather than a requirement to recruit a reviewer for every language.

| Order | Locale | Language |
| ---: | --- | --- |
| 1 | `sv-SE` | Swedish |
| 2 | `da-DK` | Danish |
| 3 | `fi-FI` | Finnish |
| 4 | `de-DE` | German |
| 5 | `fr-FR` | French |
| 6 | `pl-PL` | Polish |
| 7 | `es-ES` | Spanish (Spain) |
| 8 | `it-IT` | Italian |
| 9 | `uk-UA` | Ukrainian |
| 10 | `nl-NL` | Dutch |
| 11 | `pt-PT` | Portuguese (Portugal) |
| 12 | `cs-CZ` | Czech |
| 13 | `ro-RO` | Romanian |
| 14 | `et-EE` | Estonian |
| 15 | `lv-LV` | Latvian |
| 16 | `lt-LT` | Lithuanian |

Icelandic was removed from the approved roster by the product owner. Regional variants such as Brazilian Portuguese, Canadian French or Latin American Spanish require an explicit product decision rather than silently reusing a region-specific pack.

## Mandatory change rule

Every change that adds, removes or changes user-visible text must update the English source catalog and every complete bundled language pack in the same commit. This includes navigation, controls, validation, errors, accessibility labels, help, email templates, reports, print/PDF output and authentication text. A feature is not complete when one supported language still shows an old label, a raw identifier or fallback text unintentionally.

The catalog registry is typed against the English source keys. Automated tests verify that every registered pack has exactly the source keys and the same interpolation placeholders. Adding a locale to the supported-language registry therefore requires a complete catalog rather than a partial runtime pack.

## Automated linguistic quality gate

Catalog completeness is not evidence that a translation is correct. Before a locale is described as linguistically verified, the fixed product interface catalog must pass a reproducible report containing:

1. terminology checks against a version-controlled term base for security, identity, federation, workflow, task, report and licensing concepts;
2. independent comparison with at least two maintained translation engines, using authenticated APIs rather than browser-page scraping;
3. back-translation and semantic disagreement flags for security-sensitive, destructive, entitlement, status and workflow-transition text;
4. spelling, grammar and style checks through a maintained language-specific engine where available, with dictionaries or another documented checker for languages it does not cover;
5. source-language leakage, wrong-language, untranslated-fragment, control-character, punctuation, placeholder and markup checks;
6. browser rendering at maintained desktop and mobile widths, including clipped controls, overflow, dialogs, email, reports and PDF output;
7. the existing locale behavior, catalog parity, typecheck, build and automated regression suites.

The report records catalog hashes, provider/model versions, date, findings and resolved exceptions. Translation provider credentials are never committed. Only fixed Fylkren interface text may be submitted; customer content, deployment configuration and operational data are out of scope. A provider suggestion is evidence for review, not an automatic overwrite. Material disagreement between engines blocks the locale until the term base or translation is corrected.

English and Norwegian may additionally be owner-reviewed, but public support for the remaining roster does not depend on recruiting individual native-language reviewers. Release notes state the automated assurance method without implying human certification that did not occur.

## Locale behavior

- American English (`en-US`) is used for unknown or unsupported locale values.
- Platform Manager selects the default GUI language, IANA time zone, 12/24-hour clock and measurement system under **Appearance**.
- Dates, times, numbers, plural forms and sorting use the configured locale behavior.
- Routes, API contracts, database identifiers, audit event types and permalinks remain language-neutral.
- Site names, personal names, customer content, historical snapshots and customer-managed classification definitions are not automatically translated.
- Every language resource ships with the application and remains available in air-gapped installations.

## Adding a language

Adding a supported language requires all of the following in one maintained change set:

1. a complete catalog registered under a valid BCP 47 locale;
2. a native-language name in the Platform Manager language selector;
3. matching placeholders and coverage for all English source keys;
4. locale-specific date, time, number, plural, sorting and layout tests;
5. review of longer labels, right-to-left layout where relevant, accessibility text, email, reports and PDF output;
6. a recorded automated linguistic-quality report with no unresolved blocking findings;
7. updated README language roster, user manual and release notes.

Language resources follow the maintained structure under `apps/web/src/localization/catalogs/<locale>/`. Shared localization code must not be mixed into a language directory, and a planned language must not be represented by a partial placeholder pack.

Machine-generated translation may assist drafting. Support requires the complete automated linguistic and technical acceptance suite, retained evidence and resolution of blocking findings; one engine's output alone is never sufficient.
