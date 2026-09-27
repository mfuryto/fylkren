# Platform license API

This is a Platform Manager session API for an offline Enterprise license. It is **not** the machine administration API and does not accept an API-client token. All mutation requests require the normal session anti-forgery token. The API works without Internet access.

| Method | Route | Result |
| --- | --- | --- |
| `GET` | `/api/platform/license` | Current effective `status` and `trustedIssuerConfigured`. The status contains `edition`, `state`, `instanceId`, optional license metadata and active entitlement IDs. It never returns the signed envelope or private key. |
| `POST` | `/api/platform/license` | Import `{ "payload": "<base64>", "signature": "<base64>" }`. A valid signed, in-period license bound to this instance replaces the installed license and returns its effective status. Invalid imports return `400` and leave the existing license unchanged. The production public verification key is bundled. |
| `DELETE` | `/api/platform/license` | Remove the installed license; ordinary customer data and historical Enterprise configuration remain. Repeated removal is harmless. |

The stable instance ID from `GET` is the value an offline issuer signs. See [the license envelope and entitlement contract](../architecture/EDITION_ENTITLEMENTS.md). The current effective edition and active feature IDs are available to authenticated users through `GET /api/configuration` so the browser can hide unavailable creation controls. The anonymous `GET /api/configuration/public` contains only language, time zone, setup state and sign-in methods; it does not expose license state, version, entitlements or classifications. Protected Enterprise operations still check entitlement on the server and return `403` with `code: enterprise_entitlement_required` when absent.

Import and removal create platform audit events (`license.imported`, `license.removed`) without recording the raw signed envelope. The installed envelope is retained in the common database and revalidated against the bundled or optionally configured additional trust key, installation identity and current time on each protected action. A license is not a substitute for normal role authorization.
