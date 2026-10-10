# Federation retention/load run - 2026-09-27

Run ID: `federation-retention-load-2026-09-27`. The application base was commit `24951a3`; the maintained `--retention-only` harness mode, schema migration and this record were the uncommitted revision under verification. The disposable Enterprise pair used two independent PostgreSQL 18 databases, persisted Data Protection key rings and current API containers. Synthetic identities, sites, grants, work and history were created only for this run.

The clean final command was `node tools/run-federation-pair.mjs --retention-only`. It exited zero, reported `federationRetention: passed`, and removed every test container, network and volume. The fixture contained 5,000 expired and 50,000 recent rows in each measured history category, in addition to real bilateral assignment traffic and explicit preservation controls. Timings are `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` execution time on this development host; they verify query shape and index selection, not a supported production capacity limit.

| Control | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| Expired delivered outbox | Remove delivered rows older than 2,555 days only when their local work is terminal | Exactly 5,000 removed | Pass; database count and harness assertion |
| Recent delivered outbox | Preserve rows inside the retention window | 50,002 retained | Pass; 50,000 synthetic plus two real deliveries |
| Unresolved outbox | Preserve old delivered work that remains active and all old failed/pending messages | All three controls retained | Pass; exact message-ID assertions |
| Expired inbound receipts | Remove rows older than 2,555 days only when local work is terminal | Exactly 5,000 removed | Pass; database count and harness assertion |
| Recent inbound receipts | Preserve rows inside the retention window | 50,002 retained | Pass; 50,000 synthetic plus two real receipts |
| Active receipt | Preserve an old receipt while its local work is active | Control retained | Pass; exact composite-key assertion |
| Expired federation audit | Remove federation-origin or federation-event rows older than 2,555 days | Exactly 5,000 removed | Pass; database count and harness assertion |
| Recent federation audit | Preserve rows inside the retention window | 50,000 retained | Pass; exact count assertion |
| Unrelated local audit | Never classify a local, non-federation event as federation history | Old control retained | Pass; exact event-ID assertion |
| Delivery status counts | Use the peer/status access path at 55,003+ outbox rows | `IX_federation_outbound_messages_peer_instance_id_status`, 14.752 ms | Pass; analyzed plan assertion |
| Newest 100 deliveries | Use the peer/created-time access path | `IX_federation_outbound_messages_peer_instance_id_created_at`, 0.175 ms | Pass; analyzed plan assertion |
| Receipt replay lookup | Use the durable composite receipt key | `PK_federation_inbound_receipts`, 0.151 ms | Pass; analyzed plan assertion |
| Newest federation audit | Use the stable newest-first audit cursor | `IX_audit_events_occurred_at_id`, 59.757 ms | Pass; analyzed plan assertion |

The worker ran after API restart, proving that the same hosted maintenance path used in deployment applied the configured policy. Cleanup is bounded to 10,000 rows per table per daily pass. The default retention is 2,555 days and startup rejects values outside 365–3,650 days. Operators shortening the period must archive any history required beyond the new window before restart; the next worker pass begins irreversible database deletion. Increasing the period does not restore rows already deleted.

This baseline closes the federation retention/query-load evidence item. Production routing remains disabled pending the other gates in the federation threat model, including release-candidate repetitions, production backup-custody rehearsal and independent security review. The run does not establish sustained delivery throughput, arbitrary peer-count capacity, production hardware sizing, tamper-resistant external audit or final 1.0 acceptance.
