# Authorization and cross-site GUID-substitution run — 2026-09-27

Run ID: `authorization-guid-substitution-2026-09-27`. Base application commit: `b3e7c2d2106b06751d1bd695d3bdc543a15c0cef`; the authorization correction, expanded test and this record were the uncommitted revision under verification. The run used `pnpm test:e2e:local`, a freshly reset disposable PostgreSQL database and production-built API/web containers. The runner removed its containers, networks and volumes afterward.

This is maintained dynamic evidence for OWASP ASVS 5.0.0 requirements 8.2.1, 8.2.2, 8.3.1 and 8.4.1 and OWASP API authorization risks. It is a focused regression subset, not a completed endpoint inventory, independent penetration test or final ASVS certification.

## Finding and remediation

The first clean run found `SV-047`: a person with only a Site Manager assignment could call `GET /api/work/sites/{siteId}/items` and receive `200` with an empty paginated queue. The response disclosed no task rows or operational content, because item visibility still filtered the query, but the function-level contract requires Site Manager status alone to grant no access to Overview, Tasks, Planning, Execution or Reports. Returning a successful empty queue weakened that boundary and could mask later filtering regressions.

The API entry gate for task list, overview and execution queue now requires an active organizational-unit placement or active operational role in the requested site. Site Manager administration remains independent. Legitimate unit members without a work role remain authorized for their organizational execution scope, as required by the access matrix.

A subsequent test attempt expected the same synthetic Site Manager to be foreign to another site's organization endpoint. Inspection showed that earlier scenarios had legitimately assigned that person as Site Manager for both sites. The `200` response was correct and was not recorded as a product finding. The fixture was corrected to create a separate unadministered site; the authorization expectation stayed `403`.

## Final observed results

| Control | Expected | Observed | Result |
| --- | --- | --- | --- |
| Platform Manager operational access | No automatic task overview or creation | Direct calls returned `403` | Pass |
| Site Manager-only operational access | Task list/overview/details, planning, execution, report read/write denied | Direct calls returned `403`, including the formerly successful empty list | Pass; `SV-047` retest |
| Sibling and parent/child level isolation | No detail/status/report write outside exact authority | Direct calls returned `403` | Pass |
| Unrelated-site operational access | Overview, task, report, workload, planning, execution, workflow and template routes denied | Direct calls returned `403` | Pass |
| Foreign Site Manager administration | Organization and personnel/access routes for an unassigned site denied | Direct calls returned `403` | Pass |
| Cross-site object substitution | Foreign object under an authorized site route and local object under a foreign route concealed or denied | Each call returned `403` or `404`; no object body returned | Pass |
| Direct execution-history substitution | Unrelated user cannot use an item GUID to read execution history | Returned `403` or `404` | Pass |
| Planning/execution run substitution | Sibling leader cannot use run GUIDs to read candidates or RFI | Returned `403` or `404` | Pass |
| Positive regression | Legitimate operational, administrative, task, planning, execution, reporting, site-move, API and Enterprise flows remain usable | Complete disposable suite returned `authorizationBoundaries: passed`, `crossSiteGuidSubstitution: passed` and every other scenario flag `passed` | Pass |

The final run completed with exit code `0`. The API also built separately with zero warnings and zero errors. The web suite passed 28 files and 84 tests, and the production web build passed. The web checks additionally cover the correction that prevents ordinary overview clients from making predictably unauthorized descendant-workload calls; that client change occurred after the production container used for the API authorization run and is therefore not claimed as browser E2E evidence here.

## Scope limits

This run exercised representative high-risk operational and administration routes and direct GUID substitution using synthetic accounts. It did not enumerate every API endpoint or HTTP method, run a malicious proxy/fuzzer, test session lifecycle, inspect a production deployment, or constitute independent review. Those remain governed by the main security test plan and ASVS matrix.
