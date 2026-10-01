# Localization and language packs

Fylkren separates repository language from product language. Source code, identifiers, tests, examples and maintained documentation are written in English. User-visible product text is resolved through bundled language catalogs and does not require an Internet service.

## Current language roster

| Locale | Language | Status |
| --- | --- | --- |
| `en` | English | Source catalog and mandatory fallback; migration of legacy hard-coded UI text is in progress |
| `nb-NO` | Norwegian Bokmal | Complete bundled language pack; migration of legacy hard-coded UI text is in progress |

No additional locale is considered supported until its complete bundled catalog, locale behavior, documentation and automated tests are delivered together. The previously discussed roster of additional planned translations was not preserved in the repository or the available project-conversation history. The product owner must reconfirm that roster before those locales are presented as planned or supported.

## Mandatory change rule

Every change that adds, removes or changes user-visible text must update the English source catalog and every complete bundled language pack in the same commit. This includes navigation, controls, validation, errors, accessibility labels, help, email templates, reports, print/PDF output and authentication text. A feature is not complete when one supported language still shows an old label, a raw identifier or fallback text unintentionally.

The catalog registry is typed against the English source keys. Automated tests verify that every registered pack has exactly the source keys and the same interpolation placeholders. Adding a locale to the supported-language registry therefore requires a complete catalog rather than a partial runtime pack.

## Locale behavior

- English is used for unknown or unsupported locale values.
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

Machine-generated translation may assist drafting but does not establish support. A human language review and the complete acceptance suite are required before a locale is marked supported.
