# Federation administration

This is the operational guide for connecting two independent Fylkren installations through the Platform Manager GUI. It describes current production behavior. The protocol and trust boundaries are specified separately in [Independent-instance federation](../architecture/INSTANCE_FEDERATION.md), and server prerequisites are maintained in [Server setup](../operations/SERVER_SETUP.md#production-federation-prerequisites).

## What federation does

Federation lets active top-level sites in two approved Enterprise installations exchange ordinary requests. Each installation keeps its own database, users, organization, workflows, tasks, reports, audit and backup. Federation does not merge installations, synchronize personnel or provide failover.

Once two installations have approved and tested each other and **Oppdragsrouting** is active, their active top-level sites become available in ordinary request recipient searches. This is automatic and bilateral. There is no additional site publication, site-pair permission or direction approval. Child sites and internal units are not exposed as independent federated recipients.

The receiving installation owns all internal assessment, planning, delegation and execution. The sender receives only coarse progress, cancellation handling and the approved official top-level response. Internal organization, people, plans, execution details and subordinate reports do not cross the boundary.

The signed assignment includes the sender's display reference. The receiver allocates its own local root reference and shows the sender's value separately as **Origin reference**. Neither value is assumed globally unique: the signed origin instance/resource identity remains the protocol and idempotency boundary. The receiver's local child assignments extend its local reference family normally. Returned reports preserve the reference of the task that authored them.

## Responsibility and prerequisites

Platform Manager performs all application setup on **Federation**. Site Managers do not configure federation. The menu and complete page remain visible without Enterprise, but a single **Requires an Enterprise license** notice disables mutations.

Before activation, both installations need:

- a valid Enterprise license; older valid Enterprise licenses also include federation;
- a final public HTTPS origin in `FYLKREN_PUBLIC_URL`;
- the supported HTTPS/reverse-proxy settings, a certificate trusted by the other API container, DNS and outbound TCP reachability;
- clocks within five minutes;
- distinct databases, Instance IDs, Data Protection key rings and Platform Manager accounts; and
- a rehearsed backup that restores PostgreSQL and the matching Data Protection key volume together.

These are deployment properties, not hidden federation configuration. All remaining setup, approval, testing and activation is performed in the GUI. Never create a peer by cloning a live database: the clone would share the original Instance ID and signing identity.

## Connect two installations in the GUI

Perform the following on installation A and repeat it independently on installation B.

1. Sign in as Platform Manager and open **Federation**.
2. Under **This instance**, select **Create federation key**. Fylkren creates a dedicated P-256 signing key. The private key remains protected on the server; no PNG, certificate file or private-key file is created for manual exchange.
3. Record the displayed **Instance ID** and **Public key fingerprint** through the organization's approved independent channel. The fingerprint is visible on the same page whenever the key is usable.
4. Under **Add peer**, enter a recognizable local name and the other installation's final public HTTPS origin, for example `https://fylkren.example.no`. Do not add a path, query, fragment or credentials.
5. Select **Retrieve signed identity**. The Fylkren server contacts the entered address directly and verifies a nonce-bound signed identity proof. Nothing is uploaded in the browser.
6. Compare **Key fingerprint** with the value obtained independently from the other Platform Manager. Do not use only the newly discovered value as its own confirmation. Select the confirmation checkbox and then **Approve peer on this instance**.
7. Under **Peers and connection**, select the peer and choose **Test connection**. A successful test proves possession of the pinned key and fetches the peer's signed active top-level-site catalog.
8. Confirm that **Sites received from the peer** contains the expected active top-level sites. **Local top-level sites** shows what this installation exposes automatically. Use **Refresh site catalog** after a peer-site change when an immediate refresh is needed.

The relationship is intentionally bilateral. Completing A → B does not authorize B → A by itself; the other Platform Manager must complete the same identity check and approval on B. This bilateral peer approval is the only reciprocal setup. It must not be confused with per-site or per-direction permissions, which do not exist.

## Activate and verify routing

The **Work routing** panel lists any unresolved technical condition. The activation button is enabled only when the current installation has a valid Enterprise entitlement, secure HTTPS/proxy configuration, a usable federation key and at least one active peer with a successful connection test.

After both Platform Managers have compared fingerprints and tested the connection:

1. Select **I confirm that the peer and fingerprint have been verified**.
2. Select **Enable work routing** on each installation. Activation is immediate, persisted and audited; it requires no restart.
3. From an operational task that has completed initial leader assessment, select **Send request**, search for one of the peer's top-level sites and send a synthetic acceptance request.
4. Confirm that the sender shows a sent request, the receiver gets a normal received task, and **Delivery queue** shows the signed protocol message as delivered.
5. Complete the task on the receiver and approve its top-level final report. Confirm that only the official response and classification return to the sender, and that both report archives retain their own record.

A subordinate local unit or child site may initiate work, but the federation address and official response still cross through the applicable top-level site. Classification text is preserved as customer-defined task/report data; federation does not create classification types.

## Normal operation

**Delivery queue** shows the newest 100 protocol-message records for the selected peer, without task or report body content. `Pending` and `Retrying` are handled automatically with bounded retry. A permanently failed message remains visible with a safe error code. Correct the cause before selecting **Retry**.

Turning routing off removes remote recipients, pauses outbound delivery and closes the work-message receive routes. It does not delete peers, catalogs, tasks, reports, queued messages or audit history. Re-enabling routing resumes only after the readiness controls still pass.

Moving an active top-level site below another site, deactivating it or withdrawing it from the signed catalog prevents new federated work to that site. Existing accepted work retains its durable return path so cancellation and an approved official answer can still complete safely. Returning a site to the top level makes it available after catalog refresh; no site-pair permission has to be recreated.

Platform Audit records identity, peer, connection, routing, recovery and retry administration. The operations view and container logs provide technical failures. The in-application technical log is a bounded in-memory view, not a durable SIEM or security-reporting service.

## Key rotation, loss and restore

Use **Start key rotation** for planned rotation while the current private key is usable. Fylkren proves the old and new keys to every active peer, stages the new pins, activates only after signed receipts and retries temporary failures automatically. Do not exchange private keys manually.

If the key is reported unusable, first restore the matching database and Data Protection key ring. **Recover with a new key** is only for confirmed key loss. After recovery, every peer must use **Check recovered key**, independently compare the new fingerprint, explicitly approve it and run **Test connection** again. Ordinary probes and deliveries never accept a changed key silently.

A disaster-recovery replacement of the same installation must preserve its Instance ID, database and signing key, and the original must be fenced before the replacement receives traffic. Never run the original and a restored copy simultaneously.

## Troubleshooting

If **Retrieve signed identity** fails, verify the exact HTTPS origin, DNS, outbound reachability from the API container, certificate trust and that the peer is healthy. Redirects, certificate-validation bypasses and URLs containing credentials or paths are rejected deliberately.

If **Test connection** fails, compare the currently displayed peer fingerprint, check both clocks and confirm the peer still has a usable key. A changed fingerprint requires the explicit lost-key recovery flow; editing a URL or rerunning a normal test cannot replace a pin.

If routing cannot be activated, use the concrete list under **This remains before activation**. Server HTTPS, proxy, public URL and clock issues are corrected by the operator; key, peer and test conditions are completed on this page. No database edit is a supported setup step.

If an expected site is missing, confirm that it is active and top-level on the peer, then select **Refresh site catalog**. Child sites and internal units are intentionally absent.

If delivery fails, leave the local task intact, inspect **Delivery queue**, Platform Audit and sanitized API logs, correct connectivity/license/peer/routing state, and retry only a permanently failed message. Do not delete queue rows or create a replacement task as a recovery shortcut.

## Security and acceptance boundary

Federation uses certificate-validated HTTPS plus application-level P-256 signatures, pinned fingerprints, instance/site addressing, domain-separated signatures, bounded payloads, nonce replay protection, idempotent message IDs and audited default-off activation. Those controls do not make an approved peer harmless: a compromised legitimate peer remains a trusted data origin for bounded content.

Before an organization enables production federation, repeat the release-candidate federation baselines, matched database/key-ring restore, supported-proxy tests and lost-key exercise, then complete the [independent federation security review](../security/FEDERATION_SECURITY_REVIEW_BRIEF.md). Maintained project tests are regression evidence; they are not an independent penetration test or certification.
