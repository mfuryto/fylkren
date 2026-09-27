# Federation production-like HTTPS/browser run — 2026-09-27

Run ID: `federation-production-like-browser-2026-09-27`. The application base was commit `88a5037`; the topology, inspection-mode and documentation changes described here were the uncommitted test-code revision under verification. The disposable two-instance harness served the built React SPA through each image's Nginx gateway behind the TLS proxy. Requests therefore followed TLS proxy → web gateway → API rather than bypassing the production web layer. The API was configured for the two explicit forwarded-header hops. Both databases, key rings, licenses, users, sites and work items were freshly generated synthetic data.

The maintained pair run passed in full after the topology change, including real historical/current binary replacement, retries, cancellation idempotency, reports, site moves, rotation, recovery and populated migration. Its final result was `federationPair: passed`, with all reported checks true except the intentionally disabled `routable` production flag.

A temporary headless Chromium 149 container then used the live HTTPS pair at the stable inspection point. It authenticated as the synthetic Platform Manager and both synthetic site leaders and verified:

- the Federation page rendered peer state, delivery counters and delivered state;
- task titles and official report bodies were absent from the Federation page DOM;
- the E-mail page rendered SMTP and notification delivery status;
- sender and receiver overviews rendered their site names, annual statistics and sent/received request categories;
- both report archives rendered the ordinary-work official answer; and
- the sender archive retained `Synthetic Root b` as the official remote report header.

| Control | Expected | Observed | Result / evidence |
| --- | --- | --- | --- |
| Production-like path | SPA and API requests traverse TLS and the built web gateway | TLS proxy → per-instance Nginx → API; gateway security headers present | Pass; Compose topology and live HTTPS response |
| Federation operator state | Peer and delivery state render without operational payload | Peer sections, delivery queue and delivered state rendered | Pass; Chromium DOM assertion |
| Payload absence | Task title and official answer are absent from operator DOM | Both synthetic payload markers absent | Pass; Chromium negative DOM assertion |
| Notification status | Platform Manager can inspect notification transport and queue surface | E-mail, SMTP and delivery-status surface rendered | Pass; Chromium DOM assertion |
| Sender dashboard | Sender site and sent-request counters/categories render | `Synthetic Root a`, sent requests and annual statistics rendered | Pass; Chromium DOM assertion |
| Receiver dashboard | Receiver site and received-request counters/categories render | `Synthetic Root b`, received requests and annual statistics rendered | Pass; Chromium DOM assertion |
| Official report presentation | Both archives show the ordinary official answer and correct site header | Answer rendered at both sites; sender retained `Synthetic Root b` | Pass; Chromium DOM assertion and pair API assertions |
| Pair regression | Existing protocol, mixed-version and recovery controls remain green | Final JSON reported `federationPair: passed` | Pass; `node tools/run-federation-pair.mjs` exit 0 |

The exact maintained commands were `node --check tools/run-federation-pair.mjs`, Compose configuration validation, `git diff --check`, `node tools/run-federation-pair.mjs --inspect` for fixture preparation and `node tools/run-federation-pair.mjs` for the clean regression. The browser driver used Chrome DevTools Protocol against an ephemeral Chromium 149 Alpine container on the disposable Compose network; no customer or ordinary deployment was contacted.

The first corrected attempt exposed two test-environment issues. The web healthcheck initially proxied to an HTTPS-required API without a forwarded scheme; it now checks the SPA root while the API retains its own healthcheck. The additional reverse-proxy hop initially collapsed federation rate-limit partitions onto the TLS proxy and caused a duplicate cancellation request to receive HTTP 429; setting the supported forwarded-header limit to two restored the originating peer address. One inspection attempt also exited when non-interactive stdin reached EOF; inspection mode now retains an event-loop handle until the operator resumes it. A later clean non-browser run passed and removed its containers and volumes. Raw API/container logs and screenshots were not retained; the executable harness assertions, observed final JSON and this results record are the evidence references.

This run does not enable production routing. It does not replace representative load/latency testing, retained-data evidence, matched PostgreSQL/Data Protection restore, real SMTP/STARTTLS delivery or independent security review. Classified PDF presentation was verified in the subsequent [federated report PDF run](2026-09-27-federation-classified-report-pdf.md). Synthetic SMTP transport evidence remains in the testing overview; this browser run verifies the notification status surface, not an external mailbox.
