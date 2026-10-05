# Cryptographic key management policy

Status: mandatory security policy for supported Fylkren installations.

This policy governs cryptographic keys, shared secrets, credentials used as key material, trust certificates and their backups. It uses the lifecycle concepts and separation-of-duty objectives of NIST SP 800-57 Part 1: creation, distribution, activation, operation, rotation or revocation, recovery, archival and destruction. The application remains responsible for the controls described here even when a deployment owner or external identity provider performs an operational step.

## Ownership and access

The installation owner assigns a named security owner and backup custodian. Platform Managers may initiate supported application key operations, but host administrators control the Data Protection volume, deployment configuration, TLS termination and backups. Access must follow least privilege and be auditable.

- A private key belongs to one installation or external issuer. It must never be copied to peers, application users, the source repository, logs, portable exports or support bundles.
- A shared secret may be held only by the two endpoints that use it. Examples are a TOTP secret shared with one authenticator and a webhook secret shared with one receiver. A separate secret is required for each user, client, subscription or connection.
- Public verification keys and certificates may be distributed to relying parties. Their fingerprints and ownership still require validation.
- Production, test and development key material must be distinct. Synthetic test keys and credentials must not be accepted by production.
- Raw secrets must not be returned after initial one-time presentation. Stored recoverable secrets use a purpose-specific Data Protection protector; verifiers use salted password hashing or a one-way digest as specified in the inventory.

## Lifecycle requirements

1. **Create and register.** Generate keys and unpredictable secrets with the platform cryptographic random generator or an approved external issuer. Record owner, purpose, algorithm, creation time, location and intended consumers in the inventory. Reject malformed or weak imported public keys before activation.
2. **Distribute and activate.** Transfer private or shared material only over the protected channel intended for that integration. Validate the relying party, exact purpose and fingerprint before activation. A new federation key requires proof of possession by both old and new keys before peers stage it.
3. **Operate and store.** Keep the Data Protection key ring in its dedicated API volume and mount it only in API containers that need it. Keep the database, environment file and backup set restricted to their operational owners. Do not expose secrets in browser responses, logs, audit metadata, activity events or exports.
4. **Rotate and replace.** Use the supported replacement path for each key type. Data Protection adds new keys while retaining keys required to decrypt live data. Federation uses staged, signed peer distribution before activation. Machine clients and webhooks rotate by creating a new credential/subscription, moving the consumer, then revoking the old one. External-provider, directory and SMTP secrets are replaced through Platform Manager. License issuer rotation adds a new trusted public key while old licenses remain verifiable during the approved overlap.
5. **Revoke and recover.** Revoke a suspected credential immediately and record the incident. A lost federation private key uses the explicit recovery flow, suspends prior trust and requires peers to approve the new fingerprint. Loss of the Data Protection ring requires restoration of the matching protected backup; creating an unrelated ring does not recover protected database fields.
6. **Back up and archive.** Back up PostgreSQL, `.env` and the matching Data Protection key ring as one restore point. Backup directories and key archives use owner-only permissions and approved off-host custody. Retain old decryption and verification keys for at least as long as protected live data, accepted tokens, signed records or recovery points require them.
7. **Destroy.** Destroy private or shared material only after its consumers are revoked, dependent data and recovery obligations have expired, and the information-lifecycle owner authorizes disposition. Destruction must include operational copies and expired backups under the applicable retention decision. This policy does not enable application data deletion or anonymisation.

## Cryptographic key and secret inventory

| Material | Owner and location | Purpose and permitted use | Creation and algorithm | Rotation, recovery and prohibited use |
|---|---|---|---|---|
| ASP.NET Data Protection key ring | Installation owner; dedicated `/var/lib/fylkren/keys` API volume and matched backup | Protect session/antiforgery state, TOTP and WebAuthn flow state, stored integration secrets, webhook secrets and the federation private key through separate purpose strings | Framework key generation; AES-256-CBC with HMAC-SHA-256; application discriminator `Fylkren` | Framework rotation retains decryption keys. Restore only with the matching database and environment. Never share between unrelated installations or use as a portable export key. |
| Federation signing identity | One Fylkren installation; public SPKI plus Data-Protection-protected private PKCS#8 in PostgreSQL | Sign federation probes, work, receipts, progress, answers, cancellation and key-rotation messages for that installation | CSPRNG-generated NIST P-256 ECDSA; SHA-256; IEEE P1363 signature encoding | Two-phase signed rotation; lost-key recovery generates a distinct identity and requires peer fingerprint approval. Never export the private key or reuse another installation's identity. |
| Pinned federation peer keys | Receiving installation; public SPKI in PostgreSQL | Verify messages from exactly one approved peer installation | Imported P-256 public key with SHA-256 fingerprint | Replace only through signed staged rotation or explicit recovery approval. A key cannot be pinned to another peer. |
| Enterprise license issuer keys | Issuer keeps private key outside Fylkren; application contains trusted public SPKI and may add one deployment public SPKI | Verify Fylkren Enterprise licenses for the installation ID | P-256 ECDSA with SHA-256/P1363 | Add a new public key for controlled overlap. Never place issuer private material on a customer server or in the repository. |
| TLS private keys and certificates | Deployment gateway or approved TLS service; outside application storage | Server authentication and transport protection for the public origin and approved outbound trust | Deployment policy; supported runtime requires TLS 1.2 or 1.3 at the public boundary | Rotate with the gateway/CA procedure and verify hostname, chain and expiry. Never store the private key in PostgreSQL or portable exports. |
| OIDC/SAML trust material and client secret | External IdP owns signing private keys; Fylkren stores configured metadata/trust and a Data-Protection-protected OIDC client secret | One configured issuer/entity and client; authentication only | Provider-generated signing keys; Fylkren OIDC accepts RS256; SAML requires at least RSA-SHA256 | Provider keys rotate through validated HTTPS metadata. Replace the client secret in Platform Manager. Do not accept token-supplied keys or reuse the client secret for another integration. |
| WebAuthn credential keys | Authenticator holds a credential private key; Fylkren stores its public credential key and RP-bound metadata | Verify assertions for the registered person and RP | Authenticator-generated key from the explicit COSE allowlist | Remove and re-register a credential to replace it. The private key must never reach Fylkren. |
| TOTP secret and recovery codes | Secret shared only by one user authenticator and Fylkren; protected secret and hashed recovery codes in PostgreSQL | TOTP authentication and one-time recovery for that account | 160-bit random TOTP secret; HMAC-SHA-1 per the TOTP interoperability profile; 128-bit random recovery codes stored as SHA-256 verifiers | Re-enrol TOTP to replace the secret; old recovery codes are invalidated. Never use the secret for encryption or another account. |
| Local passwords | User knows password; Fylkren stores only ASP.NET Identity password verifier in PostgreSQL | Local interactive authentication | Random salt and PBKDF2 through ASP.NET Identity v3, configured for 220,000 iterations | Password change/reset creates a new verifier and invalidates sessions through the security version. Never decrypt, export or log passwords/verifiers. |
| Machine API credentials | One machine client receives the secret once; Fylkren stores key ID, 128-bit salt and verifier | Scoped machine API authentication for one client | 256-bit random secret; PBKDF2-SHA-256, 210,000 iterations, 256-bit output | Create a replacement client credential, migrate, then deactivate the old client. Never reuse a credential across clients or expose the stored verifier. |
| Webhook signing secrets | One subscription and one receiver; protected in PostgreSQL and shown once on creation | HMAC authentication of deliveries for that subscription | 256-bit random secret; HMAC-SHA-256 over timestamp and body | Create and migrate to a new subscription, then deactivate the old one. Never reuse across subscriptions or send it in delivery payloads. |
| Password-reset grants | Fylkren sends a one-time code to the intended user channel; SHA-256 verifier in PostgreSQL | Short-lived, single-use password recovery grant | 128-bit random code; SHA-256 verifier | Consumed or expired grants cannot be reused. Never use as a general session, encryption key or long-lived credential. |

Hashes used only for file/package integrity, approval snapshots, public-key fingerprints or password blocklist lookup are not secret keys. They remain in the cryptographic algorithm inventory because changing their format affects compatibility and integrity checks.

## Algorithm and certificate inventory

| Primitive or certificate | Current use | Boundary and compatibility rule |
|---|---|---|
| AES-256-CBC plus HMAC-SHA-256 | ASP.NET Data Protection authenticated encryption | Only through the framework protector and a purpose-specific string. Ciphertext is installation-bound and is not a portable interchange format. |
| PBKDF2 through ASP.NET Identity v3, 220,000 iterations | Local password verifier | Password verification only. The framework's versioned format carries parameters so a later policy can rehash after successful authentication. |
| PBKDF2-HMAC-SHA-256, 210,000 iterations, 256-bit output | Machine API secret verifier | Machine credentials only; each verifier has its own 128-bit salt. |
| ECDSA NIST P-256 with SHA-256, IEEE P1363 | Federation signing and Enterprise license verification | Federation private keys are installation-owned; license private keys remain issuer-owned. Public SPKI is validated as P-256 before use. |
| HMAC-SHA-256 | Webhook delivery signature and Data Protection authentication | A webhook secret is scoped to one subscription. Data Protection manages its own derived keys; neither key is interchangeable. |
| HMAC-SHA-1 | Standards-compatible six-digit TOTP | TOTP only. The 160-bit random per-user secret must not be used for signatures, encryption or another account. |
| SHA-256 | Package/file integrity, approval snapshots, payload hashes, public-key fingerprints, recovery/reset-code verifiers and offline blocklist fingerprints | Unkeyed hashing only where authenticity is supplied separately or the input has at least 128 bits of entropy. It must not replace password hashing or message authentication. |
| OIDC RS256 | ID-token verification for the configured external issuer | Only keys from exact configured HTTPS metadata/JWKS; token headers cannot add trust. Other JWT signing algorithms are rejected. |
| SAML RSA-SHA256 or stronger known incoming algorithms | Assertion/response verification for the configured IdP | Trust comes from prepared configured metadata. Fylkren provisions no SAML SP signing private key. |
| WebAuthn COSE `EdDSA`, `ES256/384/512`, `RS256/384/512`, `PS256/384/512` | Registered public-key credential verification | One credential, person and RP binding. Private authenticator keys never enter application custody. |
| TLS 1.2 and 1.3 server certificate chain | Public gateway and protected external transports | Private key stays at the gateway/service owner. Hostname, chain, expiry and exact destination validation are required; application data does not use the certificate for at-rest encryption. |
| Operating-system CSPRNG | Session/protocol state through maintained frameworks; TOTP, recovery, reset, machine and webhook secrets; signing-key generation through platform crypto APIs | Required for unpredictable values. UUIDs identify records and must not be treated as secrets or authentication tokens. |

The source inventory test maintains an exact list of production files that directly invoke cryptographic primitives, Data Protection, password hashing or authentication/signature frameworks. Any added or removed cryptographic call fails that test until this policy, its purpose boundary and the traceability evidence are reviewed together.

## Implementation providers

Fylkren does not implement block ciphers, public-key arithmetic, signature primitives, MACs, password KDFs or random generators. Production uses these maintained providers:

| Provider | Operations delegated to it |
|---|---|
| .NET `System.Security.Cryptography` on the supported .NET runtime | CSPRNG, SHA-256, HMAC-SHA-1/SHA-256, PBKDF2-HMAC-SHA-256, fixed-time comparison, P-256 ECDSA key generation/import/sign/verify and secure zeroing |
| ASP.NET Core Data Protection and Identity | Authenticated encryption/key-ring management, cookie/antiforgery protection and versioned local-password hashing |
| Microsoft ASP.NET Core OpenID Connect handler | Authorization-code state/correlation and OIDC ID-token parsing, signature, issuer, audience, type, nonce and lifetime validation |
| Sustainsys SAML2 | SAML metadata, response/assertion parsing and XML signature/conditions validation |
| Fido2 and Fido2.AspNet | WebAuthn challenge, attestation and assertion verification using the application algorithm allowlist |
| Deployment TLS stack | TLS record protection, certificate-chain and hostname validation at the gateway and maintained HTTP clients |

Fylkren protocol code builds bounded canonical messages and calls these providers to sign, verify, protect, hash or compare them. Encoding, Base32 conversion, purpose separation and message canonicalisation are application protocol logic; they must not implement or replace a cryptographic primitive. Package/runtime versions are centrally pinned and remain subject to dependency scanning and supported-version updates.

## Crypto-agility assessment

| Area | Current replacement capability | Remaining migration boundary |
|---|---|---|
| Data Protection | Framework key-ring rotation and per-key algorithm descriptors preserve old decryptors while new keys become active | No application operation inventories and re-protects every persistent SMTP, identity-provider, TOTP, webhook and federation-private-key value under a new policy before retiring old keys |
| Local passwords | ASP.NET Identity's versioned verifier returns `SuccessRehashNeeded`; successful login writes a new hash. Password change/reset replaces the verifier | Work factor/format changes require an application release, which is acceptable because online opportunistic rehash exists |
| Machine API credentials | A new random credential can be issued and the old client deactivated | Stored verifier has no algorithm/version parameters; changing PBKDF2 algorithm, rounds or output requires coordinated client recreation or a schema/code migration |
| Federation signing | Two-phase key rotation and lost-key recovery replace P-256 keys without copying private material | Protocol v1 has no signed algorithm identifier or dual-algorithm negotiation; changing from P-256 requires a coordinated protocol and peer migration |
| License verification | Multiple trusted public keys permit issuer-key overlap | Payload/signature format has no algorithm identifier; a new signature family requires a versioned license format and code release |
| OIDC, SAML and WebAuthn | Maintained providers and explicit allowlists can be updated by release; external keys/certificates rotate through metadata or credential registration | Changing accepted algorithm families requires compatibility testing and a release; provider metadata cannot widen the allowlist by itself |
| Webhook, TOTP, reset and recovery secrets | New webhook/TOTP/recovery/reset material can replace old values through supported workflows | Algorithm changes are source-controlled; webhook receivers require an overlap/migration procedure and TOTP depends on authenticator compatibility |

SV-101 tracks the missing algorithm-version and persistent re-protection foundation. Until it is closed, algorithm changes must be treated as a coordinated migration with backup, compatibility, rollback and dependent-party steps rather than an ordinary configuration change.

## Minimum security-strength assessment

AES-256/HMAC-SHA-256, SHA-256 collision resistance, P-256 ECDSA, 256-bit webhook and machine secrets, 160-bit TOTP secrets, 128-bit reset/recovery codes and the non-RSA WebAuthn algorithms meet at least a 128-bit classical security target for their intended use. Password and machine-secret resistance additionally depends on their documented PBKDF2 work factors and input entropy.

SV-102 records the unresolved RSA boundary. OIDC accepts a configured provider's valid RS256 key without requiring RSA-3072; SAML enforces the signature algorithm but not a 3072-bit signing-key minimum; the WebAuthn allowlist includes RSA algorithms without an application key-size rule. RSA-2048 is therefore accepted and provides roughly 112-bit classical strength. Deployment guidance may require stronger provider keys, but that does not replace application enforcement for ASVS 11.2.3.

## Review, incident and evidence

Review this policy and inventory for every new cryptographic use, algorithm or storage location, and during each release security review. A code change that introduces cryptography must update the inventory, identify its owner and lifecycle, and add a requirement-linked test. The security owner records detected compromise, revocation, replacement and recovery in the security finding and operational incident records without copying secret material.

Release evidence must verify the implementation anchors, backup permissions, matched restore behavior and supported rotation/recovery paths. Production custody, off-host backup access and gateway certificate operation are deployment evidence and must be qualified separately from repository tests.
