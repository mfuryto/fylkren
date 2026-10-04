import assert from 'node:assert/strict';

// Maintained directory lab: fixed administrator-selected service targets, not a
// new general outbound URL API. Inspect only synthetic connection/message counts.
export async function testServiceTransportBoundaries({ manager, configuration, compose }) {
  const inspect = () => JSON.parse(compose(['exec', '-T', 'api', 'curl', '--fail', '--silent',
    'http://transport-sink:2526/messages']));
  const smtp = { enabled: true, host: 'transport-sink', port: 2525, security: 'none',
    username: null, password: null, clearPassword: true,
    fromAddress: 'sender@example.invalid', fromName: 'Synthetic transport sender' };
  const rejected = [];
  const original = {};
  for (const path of ['/api/platform/smtp/', '/api/platform/identity/providers/ldap', '/api/platform/identity/providers/ad'])
    original[path] = (await manager.request(path)).body;
  const unsafeHosts = ['https://transport-sink', 'ldap://ldap', 'ldap transport-sink',
    'ldap;transport-sink', 'user@ldap', 'ldap:636', 'ldap/path', 'ldap?x=y',
    'ldap#fragment', 'ldap\ntransport-sink', '169.254.169.254', '::ffff:169.254.169.254'];
  for (const host of unsafeHosts) {
    const response = await manager.put('/api/platform/smtp/', { ...smtp, host });
    rejected.push({ transport: 'smtp', host, status: response.status });
  }
  for (const provider of ['ldap', 'ad']) {
    for (const server of unsafeHosts) {
      const response = await manager.put(`/api/platform/identity/providers/${provider}`, {
        enabled: false, clearSecret: false, configuration: { ...configuration, server },
      });
      rejected.push({ transport: provider, host: server, status: response.status });
    }
  }
  process.stdout.write(`${JSON.stringify({ serviceTargetValidation: rejected })}\n`);
  assert.ok(rejected.every(value => value.status === 400), 'Malformed service destinations were saved');
  for (const [path, snapshot] of Object.entries(original))
    assert.deepEqual((await manager.request(path)).body, snapshot, 'Rejected destination changed saved configuration');
  assert.equal(inspect().smtpConnections, 0, 'Configuration validation contacted the SMTP receiver');
  for (const port of [0, -1, 65536, 2147483647]) {
    assert.equal((await manager.put('/api/platform/smtp/', { ...smtp, port })).status, 400);
    assert.equal((await manager.put('/api/platform/identity/providers/ldap', { enabled: false,
      clearSecret: false, configuration: { ...configuration, port } })).status, 400);
  }
  for (const security of ['https', 'ldaps', 'ssl', 'starttls\nnone'])
    assert.equal((await manager.put('/api/platform/smtp/', { ...smtp, security })).status, 400);
  for (const security of ['none', 'https', 'ldap', 'ldaps\nstarttls'])
    assert.equal((await manager.put('/api/platform/identity/providers/ldap', { enabled: false,
      clearSecret: false, configuration: { ...configuration, security } })).status, 400);
  for (const [path, snapshot] of Object.entries(original))
    assert.deepEqual((await manager.request(path)).body, snapshot, 'Rejected port/protocol changed saved configuration');

  assert.equal((await manager.put('/api/platform/smtp/', smtp)).status, 204);
  assert.equal((await manager.post('/api/platform/smtp/test', { recipient: 'recipient@example.invalid' })).status, 204);
  assert.equal(inspect().count, 1, 'SMTP did not use its explicit relay independently of recipient domain');
  // Exercise the existing delivery worker with one synthetic queued obligation,
  // without rerunning unrelated task/planning/report/browser workflows.
  const sql = query => compose(['exec', '-T', 'postgres', 'psql', '-U', 'fylkren', '-d', 'fylkren', '-tA', '-v', 'ON_ERROR_STOP=1', '-c', query]);
  sql(`INSERT INTO notification_outbox (id,audit_event_id,site_id,work_item_id,recipient_person_id,
    recipient_email,recipient_name,subject,body,from_name,status,attempts,next_attempt_at,created_at)
    VALUES (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),
    'worker@example.invalid','Synthetic worker','SERVICE_TRANSPORT_WORKER','Synthetic queued delivery',
    'Synthetic','pending',0,now(),now())`);
  for (let attempt = 0; attempt < 30 && inspect().count < 2; attempt++)
    await new Promise(resolve => setTimeout(resolve, 1000));
  assert.equal(inspect().count, 2, 'Existing notification worker failed the shared SMTP transport');
  assert.equal(sql("SELECT status FROM notification_outbox WHERE subject='SERVICE_TRANSPORT_WORKER'"), 'sent');
  assert.equal((await manager.put('/api/platform/smtp/', { ...smtp, security: 'starttls' })).status, 204);
  assert.equal((await manager.post('/api/platform/smtp/test', { recipient: 'recipient@example.invalid' })).status, 502);
  assert.equal(inspect().count, 2, 'Required StartTLS silently downgraded to plaintext');
  assert.equal((await manager.put('/api/platform/smtp/', { ...smtp, port: 2527 })).status, 204);
  const began = performance.now();
  assert.equal((await manager.post('/api/platform/smtp/test', { recipient: 'recipient@example.invalid' })).status, 502);
  const deadlineMs = Math.round(performance.now() - began);
  assert.ok(deadlineMs >= 9000 && deadlineMs < 15000, `SMTP test deadline not enforced: ${deadlineMs} ms`);
  assert.equal(inspect().stallConnections, 1, 'Stalled relay was not exercised');
  assert.equal((await manager.put('/api/platform/smtp/', { ...smtp, enabled: false })).status, 204);

  const save = async configuration => assert.equal((await manager.put('/api/platform/identity/providers/ldap', {
    enabled: false, clearSecret: false, configuration,
  })).status, 204);
  for (const value of [configuration, { ...configuration, port: 389, security: 'starttls' }]) {
    await save(value);
    if (value.security === 'starttls') compose(['exec', '-T', 'ldap', 'sh', '-c',
      'LDAPTLS_CACERT=/container/service/slapd/assets/certs/ca.crt LDAPTLS_REQCERT=demand ldapsearch -x -ZZ -H ldap://ldap:389 -D cn=admin,dc=example,dc=test -w "$LDAP_ADMIN_PASSWORD" -b dc=example,dc=test -s base dn']);
    const result = await manager.post('/api/platform/identity/providers/ldap/test', {});
    assert.equal(result.status, 204, `Valid ${value.security} connection failed: ${JSON.stringify(result.body)}`);
  }
  for (const value of [{ ...configuration, server: 'ldap-wrong-name' },
    { ...configuration, server: 'missing.invalid' }, { ...configuration, port: 2525, server: 'transport-sink' }]) {
    await save(value);
    assert.equal((await manager.post('/api/platform/identity/providers/ldap/test', {})).status, 502,
      'Wrong certificate name/DNS/protocol endpoint passed the directory connection test');
  }
  // Prove the canary is reachable from the API, then zero its synthetic counter.
  compose(['exec', '-T', 'api', 'curl', '--fail', '--silent', 'http://transport-sink:1389/']);
  assert.equal(inspect().canaryConnections, 1, 'Referral canary was not reachable');
  compose(['exec', '-T', 'api', 'curl', '--fail', '--silent', '-X', 'POST', 'http://transport-sink:2526/canary-reset']);
  await save({ ...configuration, baseDn: 'ou=referral,dc=example,dc=test' });
  assert.equal((await manager.post('/api/platform/identity/providers/ldap/test', {})).status, 502,
    'Referral-only directory response passed the connection test');
  assert.equal(inspect().canaryConnections, 0, 'LDAP followed a remote referral outside its configured server');
  await save(configuration);
  assert.equal((await manager.post('/api/platform/identity/providers/ldap/test', {})).status, 204);
  process.stdout.write(`${JSON.stringify({ nonHttpTransportBoundaries: 'passed', unsafeHostsRejected: rejected.length,
    portAndProtocolBounds: 'passed', smtpFixedRelay: 'passed', smtpDeliveryWorker: 'passed', smtpStartTlsNoDowngrade: 'passed', smtpDeadlineMs: deadlineMs,
    ldapLdapsAndStartTls: 'passed', ldapCertificateDnsProtocolNegatives: 'passed', referralCanaryRequests: 0 })}\n`);
}
