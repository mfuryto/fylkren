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
  `Site` must not be translated as a website or physical place.

## Automated evidence

The web test run completed with 30 test files and 99 tests passing. The catalog
suite verifies exact key parity, interpolation placeholders, locale
normalization, native language names, regional date/number/plural/sorting
behavior, 12/24-hour behavior, reviewed core terminology, translation-tool
artifacts, control characters, substantial English leakage, and protected
technical tokens.

Commands completed successfully:

```sh
pnpm --filter @fylkren/web test
pnpm --filter @fylkren/web typecheck
pnpm --filter @fylkren/web build
```

The SHA-256 digest of the sorted per-file catalog checksums was
`c3a99d98e87385a28124386bbf65e91fc2fdd905ca85f7aad2c756bf390f0821`.
The localization test source digest was
`0002da0ebadf5aed8abf4db0765f8778892a6d4b056e3bb3c624658b952f480a`.

This run is a maintained internal quality pass, not a claim that every sentence
has been certified by a native-language human reviewer. No browser translation
page was scraped. The independent authenticated-engine comparison described in
the localization policy remains a separate release-assurance run and must record
provider and model versions before any locale is described as linguistically
verified.
