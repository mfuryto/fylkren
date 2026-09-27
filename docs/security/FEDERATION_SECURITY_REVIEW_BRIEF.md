# Independent federation security review brief

## Purpose and decision authority

This brief is the handoff contract for an independent security review of Fylkren's instance-federation implementation. It does not constitute a review result, authorize production federation or replace the main [security test plan](SECURITY_TEST_PLAN.md). The reviewer must select and operate their own attack tooling, retain evidence outside the repository when it may contain sensitive data, and report findings without relying on implementation-team assertions as proof.

Operational work routing is available in `Production` but disabled by default through persisted, audited Platform Manager state. The review must assess the disabled boundary, readiness/activation authorization, enabled transport and the separate `FederationTest`-only synthetic routes. Only the designated security authority may accept residual risk and authorize deployment after independent findings and retests are complete.

## Review target record

Freeze these fields before testing. Do not combine evidence from different revisions into one result.

| Field | Required value |
| --- | --- |
| Source commit and clean-tree state | Exact full Git commit; record any reviewer patch separately |
| Displayed application version | Value returned by the tested build |
| API, web and PostgreSQL images | Immutable digest for each image |
| Review dates and reviewer | Organization and named tester(s) |
| Deployment topology | Host/runtime, TLS termination, proxy hops and network isolation |
| Configuration | Sanitized effective settings, including retention and forwarded-header trust |
| Test data | Synthetic fixture identifier only; no credentials or personal data |
| Evidence store | Controlled external reference and retention period |

Review two independently administered installations with distinct PostgreSQL databases, Data Protection key rings, instance identities, federation signing keys and Platform Manager accounts. Put both behind the supported TLS proxy and built web/Nginx gateway. Direct origin access should be blocked for the production-topology portion. Also provide a controlled malicious-peer client whose private key and requests are owned by the reviewer, not copied from either legitimate installation.

## In-scope surfaces

Peer-facing routes are anonymous at the browser-authentication layer and must establish their own protocol trust:

| Route | Purpose |
| --- | --- |
| `POST /api/federation/v1/identity/discover` | Nonce-bound installation identity proof |
| `POST /api/federation/v1/probe` | Bilateral pinned-key proof and replay check |
| `POST /api/federation/v1/capabilities` | Signed protocol/schema negotiation |
| `POST /api/federation/v1/key-rotation/stage` | Old/new-key rotation proof |
| `POST /api/federation/v1/key-rotation/complete` | New-key activation proof |
| `POST /api/federation/v1/catalog` | Published top-level site catalog |
| `POST /api/federation/v1/work` | Assignment delivery; 404 while routing is disabled |
| `POST /api/federation/v1/progress` | Coarse progress return; 404 while routing is disabled |
| `POST /api/federation/v1/answer` | Official answer return; 404 while routing is disabled |
| `POST /api/federation/v1/cancel` | Cancellation delivery; 404 while routing is disabled |

The authenticated Platform Manager surface under `/api/platform/federation` is also in scope: identity creation/recovery/rotation, peer discovery/approval/update/deactivation/probe, automatic top-level site catalog synchronization, routing readiness/activation/deactivation, delivery metadata and failed-message retry. Review the ordinary task/request commands and browser recipient selection that create federation work, not only the synthetic test producers. Test licensing, role authorization, antiforgery, disabled-state isolation and absence of synthetic routes in `Production` independently.

Persistence and background processing in scope include installation identity, protected signing material, peer pins and rotation state, remote catalog snapshots, routing state, probe nonces, work links, inbound receipts, outbound messages, federation audit events, key-rotation delivery, work delivery, retry and retention cleanup. The supported proxy, certificate validation, outbound HTTP behavior, database/key-ring backup and restore, logging and operator UI are part of the boundary.

Shared database federation, database replication, remote user or organization synchronization, arbitrary remote APIs, attachments and detailed receiver execution data are unsupported. Confirm they cannot be reached through the implemented protocol; do not silently exclude attempts to cross those boundaries.

## Required independent attack coverage

Use the [federation threat model](FEDERATION_THREAT_MODEL.md) as the minimum abuse-case list, not as a test script. At minimum, independently exercise:

1. Signature canonicalization, payload/address substitution, malformed keys/signatures, cross-domain signature reuse and algorithm/key-confusion attempts.
2. Replay before, at and after clock boundaries; concurrent replay across receiver replicas; message-ID reuse with altered content; behavior after terminal receipt expiry.
3. Source/destination instance and site substitution, stale catalogs, deactivated peers/sites and routing or hierarchy changes racing a blocked send.
4. BOLA/IDOR and vertical escalation across every Platform Manager route, delivery metadata, retry action, ordinary recipient selection and task/report correlation.
5. Lost-key recovery and planned rotation under interruption, overlap, stale proof, malicious replacement, unavailable peer and restored/cloned installation conditions.
6. Unsupported versions, schemas, message types, duplicate or omitted fields, numeric/string boundary values, reordering and downgrade attempts.
7. Stored/reflected content injection through every transported text field and snapshot, including browser, audit, notification, print and PDF sinks.
8. Request-body, response, concurrency, rate, nonce, queue, catalog and retained-history exhaustion through the supported proxy topology and direct-origin attempts.
9. SSRF and redirect behavior for public and private peer addresses, URL parsing ambiguities, DNS/certificate/host changes and proxy-header spoofing.
10. Leakage of payloads, correlation identifiers, keys, credentials or internal errors through APIs, operator DOM, URLs, logs, audit, metrics and failure responses.
11. Database-only and matched database/key-ring restore, simultaneous-clone hazards, backup custody assumptions and deletion after the configured retention boundary.
12. License loss, peer outage, partial commits, process termination and retry recovery without duplicate work or unauthorized continuation.

The reviewer should add tests when source analysis reveals attack paths not represented above. A passing maintained harness is not grounds to omit adversarial variations.

## Maintained starting points

Run these only against the disposable pair project. The harness generates synthetic credentials and keys in memory, refuses ordinary deployment data and removes its containers, network and volumes on completion.

```bash
dotnet run --project tools/federation-protocol-check/FederationProtocolCheck.csproj -c Release
node tools/run-federation-pair.mjs
node tools/run-federation-pair.mjs --load-only
node tools/run-federation-pair.mjs --restore-only
node tools/run-federation-pair.mjs --retention-only
```

The default command is the production-boundary pair run. `--production-boundary-only` remains an equivalent explicit alias for automation. The previous full site-grant regression described in older run records is historical and is not a maintained entry point after removal of site publications and directional grants.

For a separately deployed review target, also run the applicable public-surface and TLS checks from the [security test plan](SECURITY_TEST_PLAN.md). Treat implementation-maintained assertions as regression evidence only. The independent report must distinguish reproduced project tests from reviewer-designed tests.

The primary evidence index is [acceptance run records](../testing/runs/README.md). The most recent focused baselines cover the production-like browser path, the ordinary-production route boundary, classified report PDFs, proxy/resource controls, concurrency races, lost-key recovery, real mixed-version upgrade/downgrade, matched database/key-ring restore and retention/query load. Records state their own exclusions and must not be generalized beyond them.

## Finding and evidence requirements

Give every finding the next unused `SV-*` identifier from [Security verification](SECURITY_VERIFICATION.md) and include:

- affected route, protocol object, requirement and `FT-*` threat-model reference;
- tested commit/images, topology and sanitized reproduction steps;
- realistic preconditions, impact, severity rationale and affected data boundary;
- raw-evidence reference outside Git, without secrets in the report;
- remediation owner and decision: fix, accepted residual risk or documented non-applicability;
- remediation commit/release and a negative regression test;
- independent retest date and outcome.

Record inconclusive tests and environment limitations explicitly. Keep credentials, cookies, private keys, license signing material, customer data and unredacted logs out of Git. Do not weaken TLS, authentication, authorization or production guards merely to make a test convenient; reviewer instrumentation must be a separately recorded patch or isolated proxy/client.

## Completion and release handoff

The federation review gate is complete only when:

- the frozen target and complete scope above were tested by a party independent of the implementation;
- all `FT-*` cases have evidence or a reviewer-approved rationale;
- every Critical and High finding is closed and independently retested;
- residual Medium risks have an explicit owner acceptance;
- the final report states scope, methods, limitations, findings and deployment assumptions;
- the responsible security authority signs the release decision; and
- maintained regression coverage and the ASVS/security verification records are updated without erasing failed evidence.

Even after that decision, routing must remain disabled on each installation until its release-candidate, backup-custody and operational gates in the threat model are complete. Activation is a deliberate, audited Platform Manager action on each node, never an automatic consequence of receiving a penetration-test report.
