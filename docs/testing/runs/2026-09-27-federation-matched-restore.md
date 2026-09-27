# Federation matched database/key-ring restore - 2026-09-27

Run ID: `federation-matched-restore-2026-09-27`. The application base was commit `8781a9c`; the maintained `--restore-only` harness mode and this record were the uncommitted test-code revision under verification. Two disposable Enterprise installations established pinned peer identities, mutual proof, published sites, synchronized catalogs and reciprocal grants through the production-like TLS proxy -> web gateway -> API path.

With the receiver's API nodes stopped, the harness captured a PostgreSQL custom-format dump and a compressed archive of the receiver's actual named Data Protection volume. It then created a post-backup site marker. The receiver database was restored twice into the same disposable topology: first with a newly empty key volume, then from the matched database dump and key-volume archive. The sender database and key ring remained intact as the independent peer.

| Control | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| Backup boundary | No receiver API process writes while database and key ring are captured | TLS, web and both receiver API nodes stopped; PostgreSQL remained available for `pg_dump` | Pass; harness sequencing |
| Database-only negative case | Restored protected private key cannot open under a new key ring | Instance ID and public key remained, `keyUsable: false` | Pass; authenticated identity response |
| Stable installation identity | Matched restore retains the original Instance ID | Exact pre-backup UUID returned | Pass; harness assertion |
| Stable federation identity | Matched restore retains public key and fingerprint | Exact SPKI and SHA-256 fingerprint returned, `keyUsable: true` | Pass; harness assertion |
| Restore point | Data committed after the snapshot does not survive | Post-backup site marker count changed from one to zero | Pass; direct database assertion |
| Existing peer trust | Matched disaster-recovery replacement needs no key-recovery approval | Sender accepted the restored peer's signed probe with its existing pin | Pass; HTTP 200 and signed protocol validation |
| Reciprocal signing | Restored node can sign toward its existing peer | Receiver-to-sender probe returned HTTP 200 | Pass; signed protocol validation |
| Operational federation | Restored grants, identity and idempotency state support new traffic | New queued assignment received a signed receipt and one counterpart | Pass; outbox and receiver database assertions |
| Cleanup | No backup, key material or disposable state remains | Containers, networks, volumes and temporary directory removed | Pass; harness `finally` cleanup |

The first successful functional run emitted Compose warnings because the deliberately recreated key volume lacked Compose ownership labels, although final cleanup still removed it. The harness now recreates that disposable volume with the project and logical-volume labels, and the clean repeat passed without those warnings. No customer configuration or content was used. The synthetic `.env` configuration was unchanged across the exercise; production operators must restore their matching protected configuration as part of the same recovery point.

The exact maintained command is `node tools/run-federation-pair.mjs --restore-only`. The run proves the application-level federation identity and delivery behavior of a matched PostgreSQL/Data Protection restore. It does not validate a customer's backup product, storage custody, recovery-time objective, production TLS/DNS failover, simultaneous-original fencing or independent security review. A disaster-recovery replacement must never be connected alongside the original installation.
