# Host status integration - 2026-09-28

Run ID: `host-status-integration-2026-09-28`. The host integration was first
verified as an uncommitted revision based on commit `0230c02`; the complete
backup extension was verified against its successor `4c23d8e`. Together they
replace the Platform Manager placeholder with a bounded read-only snapshot for
runtime-host disk, recorded backup time, container health and restart counts.

| Control | Observed result | Result / evidence |
| --- | --- | --- |
| Collector output | The maintained shell collector produced schema version 1 with filesystem capacity and web/API/PostgreSQL container state | Pass; direct collector run and clean Compose run |
| Positive API/UI contract | Platform operations returned a fresh snapshot, positive free capacity, all three healthy containers and integer restart counts | Pass; full local E2E assertions |
| Stale snapshot | A timestamp from 2000 remained identifiable but every host-derived service became `unknown` | Pass; full local E2E assertion |
| Oversized snapshot | A file larger than 64 KiB was rejected with `invalid-file` and no host data was returned | Pass; full local E2E assertion |
| Invalid numeric range | Available bytes greater than total bytes was rejected with `invalid-content` | Pass; full local E2E assertion |
| Docker isolation | `/var/run/docker.sock` was absent inside the API container | Pass; Compose execution assertion |
| Complete backup | The maintained command created a PostgreSQL custom dump, protected environment copy, matching key archive, manifest, SHA-256 file and `COMPLETE` marker, then collected and published its UTC completion time immediately | Pass; disposable Compose run and full local E2E assertion |
| External registration validation | An empty externally supplied artifact was rejected | Pass; direct script check |
| API and web | API compiled with zero warnings/errors; typecheck, production web build and all web tests passed | Pass |
| Full regression | All reported edition, workflow, authorization, API, webhook, portability and federation-candidate scenarios passed | Pass; `pnpm test:e2e:local`, exit zero |
| Cleanup | Disposable containers, networks and volumes were removed | Pass; suite cleanup output |

The first full test attempt sampled the web container while its health check was
still `starting` and correctly rendered that state as degraded. The harness was
corrected to wait for all Compose health checks before collecting the positive
baseline. A later backup-harness run correctly rejected the absent production
`.env`; the harness was supplied a dedicated synthetic configuration file. The
final clean run above used both deterministic boundaries. No product status or
backup precondition was weakened to obtain the pass.

This run did not install the systemd unit on a production Linux host and did not
execute the Windows Server/Hyper-V acceptance checklist. Those remain deployment
acceptance gates. A registered backup timestamp is also not evidence of an
off-host copy or successful restore; the documented restore rehearsal remains
mandatory.
