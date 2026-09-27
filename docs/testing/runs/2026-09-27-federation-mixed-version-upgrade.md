# Federation mixed-version downgrade and upgrade — 2026-09-27

## Scope and binaries

The maintained two-instance HTTPS harness built the current working tree as `fylkren-federation-pair-test-api:local`. It independently exported Git commit `152d0f2`—the revision that introduced signed federation capability negotiation—and built that source tree as `fylkren-federation-pair-test-api:mixed-152d0f2`. These are separate compiled API images, not simulated version headers or two configurations of one binary.

Both installations were initialized on the current image with independent PostgreSQL databases, Data Protection key volumes, signing identities, Enterprise entitlements, peers, published sites, catalogs and reciprocal directional grants. Planned key rotation completed before the binary transition.

## Transition sequence and results

The receiver API and its second replica were stopped and replaced with the historical image while retaining the populated database and key volume. The TLS proxy was recreated against those containers. A current sender negotiated v1 capabilities with and delivered a signed assignment to the historical receiver. The historical sender then negotiated with and delivered to the current receiver. Both directions persisted exactly one local counterpart and the signed receipt completed the originating outbox record.

The historical node and replica were then replaced in place with the current image, again retaining database, installation identity, protected signing key, grants, work links and delivery history. Delivery succeeded from the upgraded node to the unchanged current node and from the unchanged node back to the upgraded node. The remainder of the complete federation pair sequence passed afterward.

The final summary reported `federationPair: passed`, `liveCapabilityNegotiation: true` and `realMixedVersionUpgradeDowngrade: true`, together with the existing replay, deduplication, rotation, lost-key recovery, classification, move, return and concurrency assertions. All disposable containers and volumes were removed.

## Test-harness deviation

The first attempt built and started both images correctly but the Node test client attempted to reuse an HTTP keep-alive socket owned by the TLS proxy that had just been replaced. The connection closed before a version assertion ran. The harness now sends its synthetic control requests with `Connection: close`, ensuring that calls after a proxy replacement connect to the new process. The subsequent complete clean run passed.

## Boundary

This verifies the current v1 overlap against one concrete historical commit and a populated in-place database transition. It does not promise compatibility with arbitrary commits, future protocol versions or database downgrades that remove schema. A supported release must designate its predecessor, retain the corresponding fixture and repeat this sequence for the release candidate. Federation work routing remains confined to `FederationTest` pending the remaining production-enablement gates.
