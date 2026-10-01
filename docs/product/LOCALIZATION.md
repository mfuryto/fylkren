# Localization and language packs

Fylkren separates repository language from product language. Source code, identifiers, tests, examples and maintained documentation are written in English. User-visible product text is resolved through bundled language catalogs and does not require an Internet service.

## Current language roster

| Locale | Language | Status |
| --- | --- | --- |
| `en-US` | English (United States) | Complete source catalog and mandatory fallback |
| `en-GB` | English (United Kingdom) | Complete bundled regional variant with reviewed British wording |
| `nb-NO` | Norwegian Bokmal | Complete bundled language pack |

The legacy locale value `en` is treated as `en-US` and upgraded to that explicit value. No additional locale is considered supported until its complete bundled catalog, locale behavior, documentation and automated tests are delivered together.

## Approved translation phase after the English migration

The complete migration of repository-facing material and hard-coded product text to English is a mandatory stopping point. When that gate passes, stop implementation and obtain explicit product-owner approval before creating the next language packs. The approved translation-phase roster is:

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
| 17 | `is-IS` | Icelandic |

These are planned packs, not current supported languages. The first nine are the initial translation phase; Dutch and Portuguese are the next priority, followed by Czech, Romanian and the Baltic languages. Icelandic completes the planned Nordic coverage at the final priority. They must not appear in the Platform Manager selector until each pack independently meets the completeness and acceptance requirements below. Regional variants such as Brazilian Portuguese, Canadian French or Latin American Spanish require an explicit product decision rather than silently reusing a region-specific pack.

## Mandatory change rule

Every change that adds, removes or changes user-visible text must update the English source catalog and every complete bundled language pack in the same commit. This includes navigation, controls, validation, errors, accessibility labels, help, email templates, reports, print/PDF output and authentication text. A feature is not complete when one supported language still shows an old label, a raw identifier or fallback text unintentionally.

The catalog registry is typed against the English source keys. Automated tests verify that every registered pack has exactly the source keys and the same interpolation placeholders. Adding a locale to the supported-language registry therefore requires a complete catalog rather than a partial runtime pack.

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
6. updated README language roster, user manual and release notes.

Language resources follow the maintained structure under `apps/web/src/localization/catalogs/<locale>/`. Shared localization code must not be mixed into a language directory, and a planned language must not be represented by a partial placeholder pack.

Machine-generated translation may assist drafting but does not establish support. A human language review and the complete acceptance suite are required before a locale is marked supported.
