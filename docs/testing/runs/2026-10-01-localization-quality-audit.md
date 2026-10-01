# Localization quality audit — 2026-10-01

This run audited the fixed interface catalogs for `en-US`, `en-GB`, `nb-NO`,
`sv-SE`, `da-DK`, `fi-FI`, `de-DE`, `fr-FR`, `pl-PL`, `es-ES`, `it-IT`,
`uk-UA`, `nl-NL`, `pt-PT`, `cs-CZ`, `ro-RO`, `et-EE`, `lv-LV` and `lt-LT`.
The audit used the English source catalog, the maintained Fylkren term base,
deterministic catalog tests and a multilingual semantic review of high-risk
interface terms and detected anomalies.

## Findings corrected

- Core actions, identity labels, status words and measurement-system names were
  reviewed across all non-English catalogs. Incorrect meanings included
  Lithuanian *inactive* rendered as *illegal*, Lithuanian *probability* rendered
  as *toxicity*, German and Finnish *Imperial* rendered as a political or royal
  concept, and the Ukrainian API navigation label rendered as *audience*.
- Translation-tool artifacts and generated nonsense were removed, including
  `@ info: whatsthis` fragments, repeated punctuation, malformed Lithuanian task
  text and corrupted Ukrainian email-template help.
- Substantial English leakage in Spanish and Czech was translated. A regression
  check now rejects unchanged English interface messages of 18 or more
  characters unless the key is explicitly allowlisted as a protocol, product or
  language name whose spelling is intentionally shared.
- API paths, HTTP headers, permission scopes and protocol names were restored.
  The catalogs had altered examples such as `/api/v1/administration/sites`,
  `If-Match`, `Idempotency-Key`, `reports:read`, `classifications:read`,
  `classifications:write`, `STARTTLS`, `HTTPS`, `LDAP`, `OIDC`, `SAML`, `SMTP`,
  `UTC` and `WebAuthn`. Tests now require these tokens to remain byte-for-byte
  intact whenever they occur in the English source message.
- The product terms `Site`, `Sites` and `Site Managers` are locked for the core
  catalog keys, and the authoritative terminology document now explains why
  `Site` must not be translated as a website or physical place. A source-aware
  normalization layer now applies the invariant `Site`/`Sites` terms to every
  interface sentence, protects placeholders, API paths and role names while it
  does so, and is covered by an all-catalog regression test.
- A second anomaly pass removed visible placeholder text from 23 Lithuanian
  messages, corrected Italian local-account wording and mojibake, and corrected
  the complete Appearance/regional-settings block across the bundled language
  packs. The visual pass caught semantic errors that structural checks could
  not, including Ukrainian *Protection* used for *Appearance*, Swedish
  *Language language*, Danish *clock* mistranslation and several translations
  that treated *defaults* as defects or contractual default.
- A final source-to-target review replaced malformed or semantically unrelated
  `Site` sentences directly in the affected catalogs. This removed the need for
  an artificial `Site:` prefix fallback and caught additional draft artifacts,
  including repeated bullet characters and incorrect Lithuanian, Ukrainian,
  Estonian, German, Polish, Dutch, Czech and Romanian wording.
- The shared workspace now uses a 15-pixel Segoe UI base, compact controls, a
  208-pixel desktop navigation column and a page maximum of 1,560 pixels. This
  leaves 1,560 pixels of page width at a 1,920-pixel viewport and 1,057 pixels
  at a 1,280-pixel viewport while preserving the existing full-width mobile
  presentation.

## Automated evidence

The web test run completed with 30 test files and 100 tests passing. The catalog
suite verifies exact key parity, interpolation placeholders, locale
normalization, native language names, regional date/number/plural/sorting
behavior, 12/24-hour behavior, reviewed core terminology, translation-tool
artifacts, control characters, substantial English leakage, and protected
technical tokens.

The maintained Chromium layout run then changed the database-backed platform
default through all 19 supported locales. For every locale it rendered
Appearance at 1,920 × 1,080, Identity and Federation at 1,280 × 800, opened the
translated Federation help dialog, and rejected document overflow or clipped
buttons, navigation labels, field labels, status text and headings. It also
rendered mobile Appearance at 390 × 844 for English, German, Finnish,
Ukrainian and Lithuanian. Ten screenshots were inspected after the automated
checks. The clean result reported all 19 locale passes, the expected page widths
of 1,560 and 1,057 pixels, and zero browser errors.

Commands completed successfully:

```sh
pnpm --filter @fylkren/web test
pnpm --filter @fylkren/web typecheck
pnpm --filter @fylkren/web build
node tools/e2e/localization-layout-browser.mjs
```

The SHA-256 digest of the sorted per-file catalog checksums was
`5192c6582c601ce4f44a43939cf8cc41f9966288e1efab15a1c59ac3fb6d9f2f`.
The localization test source digest was
`bd3f3002c7e09fb98ce8c3d1b829e507216e90b49e51585142073a25949075a6`.
The reserved-term normalizer and browser-layout harness digests were
`6d6b583a4de4bc8c296e8af9e69afdd9c98dec2107cb72423ff13cca9fb6e272`
and `175db5e20634f024d8a54f5b320d593430dce5a51a4d6324ca2d3acdc40fef34`.
The shared layout theme digest was
`bf8ad30e3d64d7e8cd1612f7b835814aa201ed58aa244f6631218ce4cb691a56`.

Deterministic catalog checks, direct semantic review and rendered browser
coverage form the maintained acceptance basis for the bundled language packs.
Future wording corrections are handled as normal localization maintenance and
are not presented as a pending activation or review state in product material.
