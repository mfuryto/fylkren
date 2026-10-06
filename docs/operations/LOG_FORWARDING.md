# Remote security-log forwarding

Fylkren's supported production topology sends container stdout/stderr to the host system journal and forwards that journal to a logically separate collector. The collector must provide analysis, detection, alerting, escalation, access control and retention independently of the Fylkren host. Keeping a second container or volume on the same host does not satisfy this boundary.

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

Run both verifiers after upgrades, credential or collector changes, and during release qualification. A failed verifier means the installation has lost its qualified ASVS 16.2.2 or 16.4.3 deployment boundary even if Fylkren remains available.

## Rotation and failure

Issue a new client credential, rerun the installer with the new certificate/key and verify acknowledged progress before revoking the old credential. Rotate the collector CA only with an overlap that lets the host trust the new endpoint before the old trust is removed.

If upload stops, preserve the local journal, restore connectivity or credentials, and confirm that the durable cursor resumes. Treat unexplained gaps, rejected client authentication and deletion of local or remote evidence as security incidents. Do not place application credentials, request bodies or identity secrets in forwarding configuration or test messages.
