# Regional settings API

Platform Manager controls platform-wide presentation defaults through
`/api/platform/regional-settings`. The settings are stored in PostgreSQL and
take effect without restarting the application.

| Method | Route | Result |
| --- | --- | --- |
| `GET` | `/api/platform/regional-settings` | Returns the current language, IANA time zone, clock format and measurement system. |
| `PUT` | `/api/platform/regional-settings` | Validates and replaces the four settings atomically. Requires the normal session antiforgery token. |

The request and response contract is:

```json
{
  "defaultLanguage": "en-US",
  "timeZone": "UTC",
  "clockFormat": "24-hour",
  "measurementSystem": "metric"
}
```

Bundled language catalogs are available for `en-US`, `en-GB`, `nb-NO`, `sv-SE`,
`da-DK`, `fi-FI`, `de-DE`, `fr-FR`, `pl-PL`, `es-ES`,
`it-IT`, `uk-UA`, `nl-NL`, `pt-PT`, `cs-CZ`, `ro-RO`, `et-EE`, `lv-LV` and
`lt-LT`. American English is the source catalog and mandatory fallback. The legacy value `en` normalizes to
`en-US`. Clock format is `12-hour` or `24-hour`; measurement system
is `metric` or `imperial`. The time zone must be an IANA identifier available
inside the application container.

The public and authenticated configuration responses expose these presentation
defaults so the sign-in page and application render consistently. Timestamps
remain stored and exchanged in UTC. Federation signatures, audit timestamps and
API contracts do not change with presentation settings. Measurement conversion
is a display concern and never changes the meaning of persisted values.

An upgrade from the legacy environment-based configuration imports
`FYLKREN_DEFAULT_LANGUAGE` and `FYLKREN_TIME_ZONE` only if the database has no
regional-settings record. After that first import, PostgreSQL is authoritative.
Successful changes create a `regional-settings.updated` platform audit event.
