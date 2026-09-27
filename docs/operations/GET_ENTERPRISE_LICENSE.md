# Get and import an Enterprise license

Fylkren Community runs without a license or Internet connection. Enterprise uses a signed JSON license file verified locally by the Fylkren API. **No Fylkren installation contacts the vendor to activate, verify or renew.** The customer's Platform Manager handles the import; an ordinary Site Manager does not administer license keys.

## Find the Instance ID

In Fylkren, sign in as Platform Manager and open **License** (`#/license`). Use **Copy Instance ID** and then **Open license portal**. The ID identifies this installation's database, not a site, domain, IP address, server, user or container. It persists through ordinary upgrades and restoration of the *same* installation. If several API containers share one database, they share one Instance ID and need one license. Each independent installation/database in a federated pair requires its own license with the instance-federation entitlement.

## Connected ordering

1. Visit [THUNOLD-OLSEN Licensing](https://license.thunold-olsen.no/) over HTTPS from a browser, register the organization, select Fylkren and choose the number of independent nodes. Supply exactly one unique Instance ID for each ordered node. The installations must therefore exist before ordering. Registration is a request, not immediate payment or activation.
2. After manual commercial follow-up, the issuer creates and signs one license file per Instance ID. The customer receives a private download link or another agreed delivery method.
3. The Platform Manager imports the matching JSON file on the **License** page. Confirm the displayed Enterprise edition, expiry date and active entitlements. Keep a copy of the file in the customer's protected records.

## Fully air-gapped ordering

The isolated Fylkren server does **not** need access to the portal or any external service. Copy the Instance ID from its License page and transfer that ID out by the organization's approved procedure. Place the order with all node IDs over HTTPS from a separate connected device. Receive the signed license file there, transfer it inward under the organization's removable-media and malware-control rules, and import it locally in Fylkren. The API verifies the signature, Instance ID and dates without Internet access. A trustworthy local clock is required for time-bound licenses.

The production issuer's **public** SPKI verification key is bundled with Fylkren, so normal installations need no license-key configuration. Its SHA-256 fingerprint is `9d52a2d724c72da913c9b87f2db2f8c8d4ac1f74cc1689ca14f6c0bf7b65e8fe`; compare it with the public-key fingerprint displayed in licensing administration before first real issuance. `FYLKREN_LICENSE_PUBLIC_KEY_SPKI` can add another trusted **public** key for controlled rotation or isolated tests; adding it requires an API restart, while importing a license does not. The original bundled key remains trusted so older signed licenses still verify. The issuer's **private** signing key must never be copied to a Fylkren server or customer repository. See [installation and upgrades](INSTALLATION_AND_UPGRADES.md) and [the license/API contract](../api/PLATFORM_LICENSE_API.md).

## Renewal, failure and customer data

An unchanged node renews with a new signed file for the same Instance ID. If the customer adds or removes independent nodes for the **next** term, the issuer creates a linked renewal order with the new set of IDs. Existing licenses and historical orders are not silently rewritten or revoked. A license for another ID, an invalid signature, incompatible schema, unsupported entitlement or invalid period is rejected without replacing a previously installed license. Expiry or removal returns the effective edition to Community and blocks new Enterprise-only operations, but does not delete customer-owned data or change the one-image/one-schema installation. Customer export and backup are separate from licensing. An isolated installation cannot be remotely deactivated by the issuer; there is no phone-home mechanism.

An Instance ID supplied in a web form is unverified order information, not proof of ownership. The issuer checks the order before signing. Never post a private license download code, customer data or signing key in a public issue or chat.
