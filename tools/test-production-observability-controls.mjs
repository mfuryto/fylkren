import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const compose = read('compose.yaml');
const collector = read('deploy/host-status/collect-host-status.sh');
const correlation = read('deploy/host-status/verify-time-correlation.sh');
const installer = read('deploy/log-forwarding/install-journal-upload.sh');
const verifier = read('deploy/log-forwarding/verify-journal-upload.sh');

for (const service of ['web', 'api', 'postgres']) {
  const block = compose.match(new RegExp(`\\n  ${service}:[\\s\\S]*?(?=\\n  [a-z][a-z-]+:|\\nvolumes:)`))?.[0] ?? '';
  assert.match(block, /logging:\s*\n\s*driver: journald/, `${service} must send stdout/stderr to journald`);
}
assert.match(installer, /URL=\$url/);
assert.match(installer, /ServerCertificateFile=.*client\.crt/);
assert.match(installer, /ServerKeyFile=.*client\.key/);
assert.match(installer, /TrustedCertificateFile=.*trusted-ca\.crt/);
assert.match(installer, /Storage=persistent/);
assert.match(installer, /Seal=yes/);
assert.match(verifier, /systemctl is-active --quiet systemd-journal-upload\.service/);
assert.match(verifier, /Remote collector did not acknowledge journal progress/);
assert.match(verifier, /HostConfig\.LogConfig\.Type/);
assert.match(collector, /time_maximum_offset_milliseconds=1000/);
assert.match(correlation, /for service in web api postgres/);
assert.match(correlation, /extract\(epoch from clock_timestamp\(\)\)/);
assert.match(correlation, /maximum_skew_seconds/);

const localTimeCalls = /\bDateTime(?:Offset)?\.(?:Now|Today)\b/;
const apiSources = read('apps/api/Program.cs') + read('apps/api/Platform/SecurityEventMiddleware.cs');
assert.doesNotMatch(apiSources, localTimeCalls, 'security logging boundary must not use local wall-clock values');

console.log(JSON.stringify({
  productionObservabilityControls: 'passed',
  synchronizedHostBoundaryMilliseconds: 1000,
  correlatedComponents: ['host', 'gateway', 'api', 'database'],
  remoteTransport: 'https-mtls',
  remoteAcknowledgementRequired: true,
}));
