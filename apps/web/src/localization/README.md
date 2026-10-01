# Localization source layout

The public localization API stays in this directory:

- `index.ts` registers complete language packs, normalizes locale identifiers and provides translation helpers;
- `LocalizationProvider.tsx` connects the active locale to React;
- `localization.test.ts` enforces complete keys and matching interpolation placeholders;
- `catalogs/<locale>/` contains one BCP 47 language pack per directory.

`catalogs/en-US/` is the source and fallback catalogue. Its larger functional areas are kept in `sections/`. `catalogs/en-GB/` contains only reviewed wording differences and inherits all other source messages. Other languages own a complete catalogue in their locale directory. A planned language must not receive an empty or partial directory and must not be registered until the complete pack passes the localization tests.
