# Remote security-log forwarding

Fylkren sends container stdout/stderr to the host system journal. Forwarding that journal to a logically separate collector is an optional security enhancement. When enabled, the collector must provide analysis, detection, alerting, escalation, access control and retention independently of the Fylkren host. Keeping a second container or volume on the same host does not satisfy this boundary.

An installation can operate and be approved for production without remote forwarding. The deployment owner must then record an explicit risk exception with scope, reason, accountable approver and review date. The decision must acknowledge that compromise or loss of the application host can also remove local technical logs and delay detection. Persistent sealed local journals, restricted host access, monitored local storage, protected backups and an incident-handling procedure are the minimum compensating controls.

An installation without a separate collector cannot claim conformance with ASVS 16.4.3. This deployment choice does not change Fylkren's audit or activity stores and does not reopen the implementation finding: the forwarding capability and its verifier remain delivered and tested.

## Prerequisites

- A separate collector that accepts the systemd journal upload protocol over HTTPS.
- A collector trust CA plus a dedicated client certificate and private key for this Fylkren host. The collector must validate the client certificate and authorize only ingestion for this installation.
- `systemd-journal-upload`, `openssl`, Docker Compose and persistent systemd journal storage on the Fylkren host.
- Monitoring that alerts when `systemd-journal-upload.service` is inactive or the receiver stops accepting entries.

The uploader configuration follows the maintained systemd `URL`, `ServerCertificateFile`, `ServerKeyFile` and `TrustedCertificateFile` contract. Fylkren copies the supplied credentials into `/etc/fylkren/log-forwarding`, stores the private key with mode `0600`, enables persistent sealed journal files and starts the uploader.

## Install and qualify

Run from the repository after the remote collector and client credential exist:

```bash
cd /data/docker/fylkren
sudo ./deploy/log-forwarding/install-journal-upload.sh \
  https://logs.example.invalid:19532 \
  /absolute/path/fylkren-client.crt \
  /absolute/path/fylkren-client.key \
  /absolute/path/collector-ca.crt

sudo ./deploy/log-forwarding/verify-journal-upload.sh /data/docker/fylkren
sudo ./deploy/host-status/verify-time-correlation.sh /data/docker/fylkren
```

The first verifier checks HTTPS/mTLS configuration, key permissions, enabled and active upload service, the `journald` driver on web, API and PostgreSQL, and receiver-acknowledged journal cursor progress after a unique canary. The second requires healthy host NTP status and correlates host, gateway, API and database UTC clocks within two seconds. Save both JSON results in the deployment's security evidence.

Always run the time-correlation verifier during release qualification. Run the journal-upload verifier when remote forwarding is enabled and after credential or collector changes. A failed time verifier means the installation has lost its qualified ASVS 16.2.2 boundary. A failed upload verifier means it cannot claim ASVS 16.4.3, even though Fylkren remains available; either restore forwarding or approve and record the exception described above.

## Rotation and failure

Issue a new client credential, rerun the installer with the new certificate/key and verify acknowledged progress before revoking the old credential. Rotate the collector CA only with an overlap that lets the host trust the new endpoint before the old trust is removed.

If upload stops, preserve the local journal, restore connectivity or credentials, and confirm that the durable cursor resumes. Treat unexplained gaps, rejected client authentication and deletion of local or remote evidence as security incidents. Do not place application credentials, request bodies or identity secrets in forwarding configuration or test messages.
