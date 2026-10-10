# Federation proxy/load run - 2026-09-27

Run ID: `federation-proxy-load-2026-09-27`. The application base was commit `24951a3`; the maintained `--load-only` harness mode and this record were the uncommitted test-code revision under verification. The disposable Enterprise receiver used PostgreSQL 18, its persisted Data Protection key ring and the same production-like path as the pair test: TLS Nginx proxy -> built web Nginx gateway -> API, with exactly two trusted forwarded-header hops. All identities, license material and request data were generated for the run.

The clean final command was `node tools/run-federation-pair.mjs --load-only`. It exited zero, reported `federationProxyLoad: passed`, and removed every test container, network and volume. The latency sample consists of the complete allowed fixed window: 20 simultaneous signed identity-discovery responses from one client partition. It is a security-control baseline on this development host, not a supported production capacity claim.

| Control | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| Cancellation body | More than 16,384 bytes is rejected through both proxies | HTTP 413 | Pass; harness assertion |
| Official-answer body | More than 150,000 bytes is rejected through both proxies | HTTP 413 | Pass; harness assertion |
| Work body | More than 300,000 bytes is rejected through both proxies | HTTP 413 | Pass; harness assertion |
| Global body | More than 3 MiB is rejected through both proxies | HTTP 413 | Pass; harness assertion |
| Allowed rate window | First 20 requests in one client/minute partition succeed concurrently | 20/20 HTTP 200 | Pass; harness assertion |
| Rate boundary | Request 21 is refused without queueing | HTTP 429 | Pass; harness assertion |
| Forwarded-header spoof | Caller cannot escape an exhausted partition with its own `X-Forwarded-For` | HTTP 429 | Pass; outer proxy overwrote the supplied value |
| Policy separation | Capability negotiation has a separate partition | HTTP 409 contract response, not 429 | Pass; harness assertion |
| Client partitioning | Other originating addresses retain independent budgets | Two container-source requests each returned HTTP 200 | Pass; API saw the address surviving both supported proxy hops |
| Bounded response | Successful discovery response remains small | Maximum 430 bytes | Pass; measured serialized response |
| Latency at limit | Record p50/p95/p99 for the allowed concurrent window | 642/693/699 ms | Pass; monotonic client-side measurement |

Three exploratory executions failed before the clean result and were fully cleaned up. The first used plural rather than implemented singular cancel/answer paths and received 404. The second incorrectly assumed route-size rejection consumed no permits. The third established the actual middleware ordering: the three endpoint-specific 413 responses consume route permits, while the global Kestrel rejection occurs before that limiter. The final harness isolates body and rate measurements with a controlled API restart, preserving the initialized database and key ring while resetting only in-memory limiter state.

The ordinary pair harness already checks replay, invalid signatures, cross-site substitution and concurrent duplicate receipt handling through this proxy topology. Combined with this focused run, the federation resource-exhaustion proxy gate has a maintained baseline. Production routing remains disabled. This run does not establish sustained worker throughput, retained-history query performance, production hardware capacity, matched database/key-ring restore, real SMTP delivery or independent security-review evidence.
