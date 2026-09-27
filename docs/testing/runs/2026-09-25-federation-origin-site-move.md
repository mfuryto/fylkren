# In-flight federated work across origin-site moves — 2026-09-25

## Scenario

A top-level site sent a synthetic assignment to a different installation. After the destination acknowledged the work, the origin site was moved under one parent site and then another on its own installation. The destination synced the changed catalog. The receiving site completed its official response and sent it back using the original instance/site/work identity. The origin site's leader accepted the answer, and both sites retained their reports. The origin site was then restored to top level without automatically republishing it.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Two parent moves | Pass | `node tools/run-federation-pair.mjs`; the origin's parent unit changed twice while the work link retained its original addresses |
| New-work publication | Pass | Moving the origin below a parent suspended its top-level publication; the peer's refreshed catalog showed the origin inactive |
| In-flight return | Pass | The signed official answer was delivered and accepted despite the moved origin and suspended new-work grant; sender and receiver report archives passed their existing checks |
| Return to top level | Pass | Restoring the origin site to root did not silently reactivate publication |
| Full regression | Pass | `federationPair: passed`, including grant, retry, progress, answer, cancellation, report and populated-schema-upgrade scenarios |

The runner removed its disposable containers and volumes. This proves only the **origin-site move** path in the isolated test environment. Destination-site moves with active work, broader reassignment policy, operator recovery and normal UI workflows remain unverified. No production federation routes were enabled.
