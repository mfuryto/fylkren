# Independent-instance federation threat model

## Status, scope and security decision

This model covers the Enterprise federation protocol between two independently administered Fylkren installations. It supplements the [main threat model](SECURITY_THREAT_MODEL.md); it does not replace the browser, identity, site-authorization or deployment controls defined there.

Federated work delivery is available under `Production` but is persisted **disabled by default**. An entitled Platform Manager must explicitly enable it on each installation after the GUI/API readiness checks pass. While disabled, work/return routes return 404, the worker remains idle and remote recipient selection is absent; administrative setup remains available. Synthetic producer and answer-acceptance routes remain `FederationTest`-only. The 2026-09-27 production-routing baseline proved default-off isolation, activation through the production Platform Manager API and ordinary signed delivery between two databases. Complete the applicable ASVS/threat-model verification and authorized deployment checks; technical availability is not production risk acceptance. External penetration testing is optional when explicitly requested.

The protected flow includes signed peer discovery, bilateral local approval and key pinning, mutual proof, automatic top-level site catalog synchronization, explicit instance routing activation, assignment delivery, coarse progress, official answer, cancellation, signed receipts, durable retry and operator recovery. It excludes shared databases, database replication, remote user synchronization, remote organization synchronization and arbitrary remote API access.

## Security objectives

- Authenticate the exact sending and receiving installation for every protocol message.
- Accept new work only when both addressed sites are active top-level sites in the mutually authenticated instances' current catalogs.
- Prevent replay, duplicate local work, cross-site substitution and message-content substitution.
- Expose only top-level site identity, bounded assignment content, coarse progress, cancellation reason and the approved official response.
- Keep remote users, units, plans, execution details, subordinate reports, audit history and local identifiers out of the protocol.
- Preserve local operation and historical access while a peer is unavailable or the Enterprise entitlement is absent.
- Make queue failure visible and recoverable without exposing message payloads to Platform Manager.
- Fail closed for unsupported schema versions, message types, destinations and cryptographic state, while preserving existing classification markings.

## Assets and impact

| Asset | Impact if compromised |
| --- | --- |
| Federation signing private key | Forged messages and receipts as the installation until every peer revokes the pin |
| Pinned peer key and instance ID | Trust redirected to an attacker or cloned installation |
| Signed top-level site catalogs and instance routing state | Unauthorized discovery or work transfer between installations |
| Work envelope and correlation address | Cross-site task injection, answer substitution or loss of traceability |
| Official report and cancellation reason | Disclosure or alteration of operational content |
| Outbox, inbound receipts and nonce ledger | Duplicate work, suppressed delivery, replay or concealed failure |
| Federation audit events | Loss of operator and remote-peer accountability |
| Database and Data Protection key ring | Loss of history plus inability to use the protected federation private key |

## Actors and trust boundaries

Actors are an anonymous network client, an authenticated local user, a Site Manager, a Platform Manager, a legitimate peer, a compromised peer, an attacker holding a peer private key, a malicious or mistaken infrastructure operator, and an operator of a cloned/restored installation.

Trust boundaries are:

1. Platform Manager browser to local federation administration API.
2. Local API to the configured peer HTTPS origin.
3. Anonymous peer-facing HTTPS route to signature, address, time, nonce and authorization checks.
4. Signed envelope to locally owned task/report state.
5. Background worker and operator retry action to the durable outbox.
6. Database plus Data Protection key ring to the protected local signing private key.
7. One installation's site/content policy to the independently administered peer's retention and access policy.

TLS authenticates and encrypts the network endpoint. The pinned P-256 application key authenticates the installation and signed protocol object. Bilateral peer approval plus explicit routing activation authorizes work between active top-level sites; neither TLS nor a valid signature alone grants work access.

## Data minimization contract

`assignment.created` may contain the request kind, title, instruction, priority, deadline, request basis and bounded source/sender name snapshots. Existing classification markings in the task text are part of that signed content and cross unchanged. `assignment.progress` contains only one coarse phase and a sequence number. `assignment.answered` contains only the top-level site's approved official report, its existing structured classification abbreviation when present, and approval time. `assignment.cancelled` contains only the cancellation reason.

The protocol must not contain local person IDs, unit IDs, workflow definitions, plans, execution records, subordinate reports, local classification-definition IDs or names, documents, audit records, authentication data or database rows. It transports no classification-policy configuration and performs no cross-instance mapping or inference. The official report's bounded abbreviation is cryptographically bound to the message and stored with the answer at the origin. The Platform Manager delivery view returns only message ID/type, delivery state, attempts, timestamps and a bounded error code; it omits payload and work/site identifiers.

## Priority abuse cases and controls

| ID | Abuse case | Implemented controls | Remaining evidence or action |
| --- | --- | --- | --- |
| FT-01 | Forge a peer or alter a message | Out-of-band P-256 key pin; domain-separated signatures bind full addresses, IDs, nonce, time and exact payload hash; normal TLS validation | Independent protocol review and production certificate-chain tests |
| FT-02 | Replay a signed request | Five-minute time window; PostgreSQL nonce uniqueness per peer; durable `(peerInstanceId,messageId)` receipt; receipts are retained while their local work remains active and late assignment retries still fail closed against the durable origin work link after terminal-history expiry | The 2026-09-27 retention/load baseline covered the retention boundary and indexed replay lookup; repeat for the release candidate |
| FT-03 | Reuse a message ID with changed content | Receipt compares message type, complete routing/correlation address and SHA-256 payload hash | Maintain negative protocol tests |
| FT-04 | Send work to an unauthorized site | Receiver re-evaluates routing, Enterprise entitlement, active pinned peer, active local top-level destination and active source catalog snapshot for every new request | Repeat behind the supported production proxy topology |
| FT-05 | Substitute an answer/progress/cancellation onto other work | Exact peer/site/origin/counterpart link plus correlation and causation to delivered original assignment | Maintain cross-site and random-ID negative tests |
| FT-06 | Duplicate work during retry or replica race | Durable unique receipt and origin link; transaction; unique-violation handling; signed receipt returns original counterpart | Pair test already covers concurrent receiver replicas; repeat for release candidate |
| FT-07 | Reorder progress or answer | Monotonic progress sequence; stale progress acknowledged without rollback; immutable official answer wins | Maintain reordered-delivery test |
| FT-08 | Cancel after completion or race cancellation with answer | Conditional database update and transaction refuse closed/formally answered work; sender closes only after signed receipt; the pair test holds the receiver row, places answer and cancellation updates behind the same lock and verifies exactly one terminal outcome | Repeat for the release candidate and retain the run evidence |
| FT-09 | Expose receiver internals to sender | Coarse status and official top-level response only; local execution remains local | Passed in the 2026-09-27 production-like Chromium/network inspection |
| FT-10 | Leak payload through operator UI, API, log or error | Delivery API omits payload and work/site IDs; bounded error codes; HTTP bodies are not logged | Operator DOM payload-absence check passed; independent dynamic log review remains required |
| FT-11 | Abuse manual retry or create duplicate retries | Platform Manager role, antiforgery, Enterprise entitlement, active proved peer, failed-only conditional update and audit in one transaction | Pair test covers simultaneous retry; verify UI authorization directly |
| FT-12 | Exhaust receiver with bodies, signatures or nonce rows | Per-route body limits, fixed payload limits, rate limiting, bounded response buffering and seven-day nonce cleanup | The 2026-09-27 supported-proxy baseline passed every body limit, the exact 20-request window, request 21 rejection, forwarded-header spoof resistance, separate policy/client partitions and bounded response measurement; repeat for the release candidate |
| FT-13 | Redirect federation into an internal service | Platform Manager-only HTTPS base URL; no credentials/path/query/fragment; fixed protocol paths; no redirects; valid signed response required | Private addresses must remain supported for air-gapped LANs; treat Platform Manager as a network-configuration role and verify egress policy operationally |
| FT-14 | Continue new work after deactivation | Routing, peer and top-level site state are rechecked before queueing, before delivery and on receipt; site moves remove destinations from the signed catalog | Repeat the site-move race under representative proxy delay and load |
| FT-15 | Lose entitlement during active work | New selection/delivery stops; historical configuration, work, links, reports, audit and delivery state remain readable | Define and verify recovery procedure for queued in-flight returns |
| FT-16 | Restore/clone two live installations with one identity/key | Stable database identity and protected signing key are restored together; documentation forbids simultaneous clone use | The 2026-09-27 matched-restore baseline preserved identity and peer trust and resumed delivery; controlled audited re-key remains unimplemented and blocks independent-clone conversion |
| FT-17 | Signing-key compromise, loss or planned rotation | Planned rotation is signed by both old and new keys. If the old key is provably unusable, local recovery creates a replacement but each peer must directly discover it, independently compare the fingerprint and explicitly approve it; approval suspends that peer's catalog until a new connection test. Both sides audit recovery. | Repeat the recovery exercise with production backup custody and incident runbooks; compromise response still requires organizational investigation and peer coordination |
| FT-18 | Mixed-version incompatibility or downgrade | Signed, nonce-bound negotiation selects an overlapping protocol/work schema and exact message types before delivery; exact schema checks and strict payload decoders fail closed. The maintained pair test builds historical commit `152d0f2` separately, downgrades one populated node, delivers in both directions, upgrades it in place and delivers in both directions again. | Keep a designated supported predecessor fixture and repeat against each release candidate when protocol/schema support changes |
| FT-19 | Remove or substitute a task/report classification in transit | Task markings are part of the signed task text; the official report classification is a signed bounded field, persisted on the work link and copied to the origin report; the pair test verifies both preservation paths | Browser and rendered PDF checks passed with the classification at the top and bottom of every page; repeat for release candidate |
| FT-20 | Queue/history grows without bound | UI reads only newest 100; daily cleanup removes at most 10,000 rows per table, retains unresolved work, and applies a configurable 365–3,650-day window (2,555-day default) to terminal delivered outbox, terminal receipts and federation audit history | The 2026-09-27 retention/load baseline passed with 5,000 expired and 50,000 recent rows per category and verified operative indexes; repeat on release-candidate and production-sized hardware |
| FT-21 | Compromised legitimate peer sends harmful but valid content | Bounded strict contracts, React escaping, URL exclusion from the v1 return and local leader acceptance | A peer is a data-origin trust, not a content-trust bypass; complete stored-content injection tests |
| FT-22 | Database or host operator tampers with federation state | Application audit and relational constraints provide traceability but share the database trust boundary | External tamper-resistant audit is a deployment responsibility and residual risk |

## Cryptographic and key lifecycle requirements

- Each installation uses a dedicated P-256 federation key, separate from browser sessions and license signing.
- The private PKCS#8 material is protected by ASP.NET Data Protection and never returned by an API.
- Database and Data Protection keys must be backed up and restored from the same recovery point.
- Each node fetches a nonce-bound signed identity directly from the peer and its Platform Manager compares the SHA-256 SPKI fingerprint through an independent channel before local approval; the peer repeats this independently.
- Signature domains for discovery, probe, capability negotiation, catalog, work envelope and receipt must remain distinct.
- Clocks may differ by at most five minutes; the installation must obtain time from customer-controlled infrastructure when offline.
- Automatic trust-on-first-use, disabled certificate validation, redirects and silent key replacement are prohibited.

## Availability and failure behavior

Assignment creation commits local tracking state and an outbox record atomically; network delivery never occurs inside that transaction. A peer outage therefore does not roll back unrelated local work. Automatic attempts are bounded and become permanently failed. Platform Manager can inspect metadata and requeue a failed message after correcting the cause. The receiver deduplicates a retry with a fresh nonce and returns a newly signed receipt for the original local counterpart.

Failure is visible, but federation is not high availability and provides no delivery-time guarantee. A failed peer, lost signing key, revoked peer, expired entitlement or incompatible version can leave an in-flight request unresolved until operator action or policy resolution. Local users must retain historical access and be able to continue unrelated local work.

## Release and deployment gates

All of the following are required before an organization approves and activates production federation:

1. Repeat the implemented controlled lost-key recovery flow with production backup custody and incident procedures. Planned rotation has old/new-key proof and signed receipts; recovery is permitted only when the old protected key is unusable and requires direct discovery, independent fingerprint comparison, explicit approval and a new connection test at every peer.
2. Maintain the passing separate-binary upgrade/downgrade test and repeat it with the designated supported predecessor for the release candidate. The current fixture covers historical `152d0f2` against the current image in both directions before and after in-place upgrade.
3. Repeat the passing simultaneous answer/cancellation and site move/revocation delivery races on the release candidate behind the supported proxy topology.
4. Re-run the maintained production-like HTTPS/browser and production-routing gates for each release candidate; the 2026-09-27 baselines passed default-off isolation, GUI/API activation, ordinary signed delivery, federation state, notification status, dashboard counters, report headers, operator-DOM payload absence and absence of synthetic routes under `Production`.
5. Repeat the maintained supported-proxy security baseline for the release candidate. The 2026-09-27 run passed rate and body boundaries, partition isolation, forwarded-header spoof resistance and bounded-response load; the ordinary pair covers replay, invalid signatures and cross-site substitution through the same topology.
6. Repeat the maintained matched PostgreSQL/Data Protection restore for the release candidate and complete the production-custody exercise. The 2026-09-27 baseline proved that a database-only restore leaves the private key unusable, while the matched restore preserves identity, existing peer trust and delivery.
7. Repeat the maintained retention/query-load gate for the release candidate. The 2026-09-27 baseline proved bounded cleanup, unresolved-work preservation and indexed operational reads with 5,000 expired and 50,000 recent rows per history category.
8. Complete the [independent federation security review](FEDERATION_SECURITY_REVIEW_BRIEF.md) and close or accept findings under the main security release process.

## Residual risk

A fully compromised approved peer can send bounded content to active top-level sites while routing is enabled and can disclose data previously sent to it under its own access and retention policy. A compromised Docker host, database administrator, backup administrator, Data Protection key ring or federation private key is outside the protection of application signatures. Application audit stored in the same database is not tamper-resistant against that operator. Private-network federation intentionally permits customer-controlled internal HTTPS addresses, so egress segmentation and approval of Platform Managers are deployment controls.

Federation remains an at-least-once transport with idempotent processing, not a distributed transaction. Network partition, permanent revocation or incompatible software can leave the two installations showing different pending states until recovery. These limitations must be stated in operator documentation and accepted by the deploying organization.
