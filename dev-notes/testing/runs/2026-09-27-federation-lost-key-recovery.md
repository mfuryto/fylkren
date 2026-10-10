# Federation lost-key recovery — 2026-09-27

## Scope and control design

The maintained two-instance HTTPS harness simulates loss of the receiver installation's protected federation private key after the ordinary bilateral federation sequence. The recovery API is deliberately unavailable while the existing key can still be opened and matched to its public identity; a healthy installation must use planned two-phase rotation instead.

After simulated loss, the installation reports the key as unusable and refuses planned rotation. A Platform Manager can generate a replacement P-256 key while preserving the stable instance ID. No peer pin is updated automatically. A Platform Manager at each peer must fetch a fresh nonce-bound identity proof directly from the already configured HTTPS address, compare the new fingerprint independently and submit that exact fingerprint again during approval.

Peer approval replaces the pin, clears any incomplete rotation state, and suspends cached remote sites and every directional grant for that peer. Catalog state and grants require explicit review and reactivation. Local generation and remote approval create separate platform audit events. Ordinary probes and work APIs never accept a changed key implicitly.

## Executable assertions

The pair runner asserts rejection of recovery while the key is healthy, detection of an unreadable protected key, rejection of planned rotation after loss, generation of a distinct replacement key, rejection of a changed confirmation fingerprint, successful direct rediscovery and explicit peer approval, and suspension of catalog/grant state. It also asserts both recovery audit events and the complete pre-existing federation regression sequence.

Two clean attempts reached an unrelated existing outage-and-move scenario before this new recovery section and received HTTP 429 from the test rate limiter immediately after an API restart; the outer administrative endpoint mapped it to HTTP 502 and the harness expected an immediate HTTP 200. No recovery assertion had run. The harness now waits within a bounded 70-second interval for this rate-limited catalog synchronization, while still failing on other status codes.

The next attempts reached recovery but its fixture first ran after the pre-existing catalog-defense scenario had suspended the remote site, then found that a prior site-move scenario had correctly left the local publication inactive. The recovery setup was moved before catalog defense and now explicitly republishes the restored top-level local site before activating the grant. No application behavior was changed for these fixture-order and prerequisite defects.

The final clean run passed the complete maintained sequence and reported both `federationPair: passed` and `controlledLostKeyRecovery: true`. It also retained the existing passing key-rotation, capability-negotiation, delivery, return, classification, replay, move and concurrency assertions. Disposable containers, databases, signing keys and volumes were removed afterward.

## Boundary

This is isolated synthetic API/database evidence. It does not replace a restore drill using retained production-format database and Data Protection key-ring backups, a real incident-response exercise, independent fingerprint coordination, browser usability verification or security review. Federation work routing remains confined to `FederationTest`.
