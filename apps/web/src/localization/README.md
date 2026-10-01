# Localization source layout

The public localization API stays in this directory:

- `index.ts` registers complete language packs, normalizes locale identifiers and provides translation helpers;
- `LocalizationProvider.tsx` connects the active locale to React;
- `localization.test.ts` enforces complete keys and matching interpolation placeholders;
- `reservedTerms.ts` keeps product terms such as `Site` invariant even when a draft catalog contains a generic translated synonym;
- `catalogs/<locale>/` contains one BCP 47 language pack per directory.

`catalogs/en-US/` is the source and fallback catalogue. Complete catalogues mirror its functional `sections/` layout so domain wording remains easy to review. `catalogs/en-GB/` contains only reviewed wording differences and inherits all other source messages. A planned language must not receive an empty or partial directory and must not be registered until the complete pack passes the localization tests.
