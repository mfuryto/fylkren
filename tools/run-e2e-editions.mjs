import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const project = 'fylkren-edition-e2e';
const fixture = JSON.parse(readFileSync(new URL('./e2e/license-fixture.json', import.meta.url), 'utf8'));
const env = {
  ...process.env,
  FYLKREN_DB_PASSWORD: 'synthetic-e2e-only',
  FYLKREN_HTTP_PORT: '127.0.0.1:18081',
  FYLKREN_PUBLIC_URL: 'http://localhost:18081',
  FYLKREN_MFA_ENABLED: 'false',
  FYLKREN_LICENSE_PUBLIC_KEY_SPKI: fixture.publicKeySpki,
  FYLKREN_E2E_BASE_URL: 'http://localhost:18081',
  FYLKREN_COMPOSE_PROJECT: project,
  FYLKREN_LOCAL_BACKUP_RETENTION_COUNT: '2',
};
if (process.argv.includes('--asvs-cookie-only') || process.argv.includes('--asvs-http-upgrade-only')) {
  env.FYLKREN_PUBLIC_URL = 'https://localhost:18081';
  env.FYLKREN_REQUIRE_HTTPS = 'true';
  env.FYLKREN_TRUST_FORWARDED_HEADERS = 'true';
}
if (process.argv.includes('--asvs-mfa-enforcement-only')) env.FYLKREN_MFA_ENABLED = 'true';
const backupRoot = mkdtempSync(join(tmpdir(), 'fylkren-backup-e2e-'));
const environmentPath = '.env';
const savedEnvironment = existsSync(environmentPath) ? readFileSync(environmentPath) : null;
if (savedEnvironment === null) writeFileSync(environmentPath, 'FYLKREN_DB_PASSWORD=synthetic-e2e-only\n', { mode: 0o600 });
const oldestBackup = join(backupRoot, 'fylkren-20000101T000000Z');
const retainedBackup = join(backupRoot, 'fylkren-20000102T000000Z');
const incompleteBackup = join(backupRoot, 'fylkren-20000103T000000Z');
for (const path of [oldestBackup, retainedBackup, incompleteBackup]) mkdirSync(path, { mode: 0o700 });
writeFileSync(join(oldestBackup, 'COMPLETE'), 'Synthetic completed set.\n');
writeFileSync(join(retainedBackup, 'COMPLETE'), 'Synthetic completed set.\n');
writeFileSync(join(incompleteBackup, 'INCOMPLETE'), 'Synthetic incomplete set.\n');
const backupMarkers = ['runtime/last-backup.timestamp', 'runtime/last-backup.json'];
const savedMarkers = new Map(backupMarkers.map(path => [path, existsSync(path) ? readFileSync(path) : null]));
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { env, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    spawnSync('docker', ['compose', '-p', project, 'logs', '--no-color', '--tail', '250', 'api'],
      { env, stdio: 'inherit' });
    throw new Error(`${command} exited with ${result.status}`);
  }
}
try {
  if (process.argv.includes('--no-build')) {
    if (!env.FYLKREN_E2E_API_IMAGE || !env.FYLKREN_E2E_WEB_IMAGE) throw new Error('Set candidate API and web image IDs for --no-build.');
    // The restore script deliberately uses the base compose file. Keep its
    // default project tags bound to the same candidate as the initial startup.
    run('docker', ['tag', env.FYLKREN_E2E_API_IMAGE, `${project}-api`]);
    run('docker', ['tag', env.FYLKREN_E2E_WEB_IMAGE, `${project}-web`]);
    env.COMPOSE_FILE = 'compose.yaml:tools/e2e/reuse-images.compose.yaml';
  }
  run('docker', ['compose', '-p', project, 'up', '-d', process.argv.includes('--no-build') ? '--no-build' : '--build', '--wait']);
  // A disposable, empty database only: bind the public test fixture to a reserved identity.
  run('docker', ['compose', '-p', project, 'exec', '-T', 'postgres', 'psql', '-U', 'fylkren', '-d', 'fylkren',
    '-c', `UPDATE instance_identity SET instance_id = '${fixture.instanceId}' WHERE key = 1`]);
  // Reapply the Site-content preservation migration to a simulated legacy database.
  if (process.argv.includes('--asvs-arithmetic-only') || process.argv.includes('--asvs-version-only') || process.argv.includes('--asvs-zip-only') || process.argv.includes('--asvs-counter-only') || process.argv.includes('--asvs-input-only') || process.argv.includes('--asvs-context-only') || process.argv.includes('--asvs-limits-only') || process.argv.includes('--asvs-reauth-limit-only') || process.argv.includes('--asvs-authentication-attacks-only') || process.argv.includes('--asvs-mfa-enforcement-only') || process.argv.includes('--asvs-password-length-only') || process.argv.includes('--asvs-password-change-only') || process.argv.includes('--asvs-password-blocklist-only') || process.argv.includes('--asvs-password-composition-only') || process.argv.includes('--asvs-password-maximum-only') || process.argv.includes('--asvs-password-context-only') || process.argv.includes('--asvs-breached-password-only') || process.argv.includes('--asvs-query-only') || process.argv.includes('--asvs-body-only') || process.argv.includes('--asvs-header-file-only') || process.argv.includes('--asvs-file-content-only') || process.argv.includes('--asvs-file-storage-only') || process.argv.includes('--asvs-file-download-only') || process.argv.includes('--asvs-sequence-only') || process.argv.includes('--asvs-business-limits-only') || process.argv.includes('--asvs-community-limit-only') || process.argv.includes('--asvs-locking-only') || process.argv.includes('--asvs-automation-only') || process.argv.includes('--asvs-content-context-only') || process.argv.includes('--asvs-cookie-only') || process.argv.includes('--asvs-browser-headers-only') || process.argv.includes('--asvs-csrf-only') || process.argv.includes('--asvs-media-types-only') || process.argv.includes('--asvs-http-upgrade-only')) {
    if (process.argv.includes('--asvs-mfa-enforcement-only')) run(process.execPath, ['tools/test-mfa-enforcement-assessment.mjs']);
    else if (process.argv.includes('--asvs-authentication-attacks-only')) run(process.execPath, ['tools/test-authentication-attack-runtime.mjs']);
    else if (process.argv.includes('--asvs-breached-password-only')) run(process.execPath, ['tools/test-breached-password-runtime.mjs']);
    else if (process.argv.includes('--asvs-password-context-only')) run(process.execPath, ['tools/test-password-context-runtime.mjs']);
    else if (process.argv.includes('--asvs-password-maximum-only')) run(process.execPath, ['tools/test-password-maximum-runtime.mjs']);
    else if (process.argv.includes('--asvs-password-composition-only')) run(process.execPath, ['tools/test-password-composition-runtime.mjs']);
    else if (process.argv.includes('--asvs-password-blocklist-only')) run(process.execPath, ['tools/test-password-blocklist-runtime.mjs']);
    else if (process.argv.includes('--asvs-password-change-only')) run(process.execPath, ['tools/test-password-change-runtime.mjs']);
    else if (process.argv.includes('--asvs-password-length-only')) run(process.execPath, ['tools/test-password-length-runtime.mjs']);
    else if (process.argv.includes('--asvs-reauth-limit-only')) run(process.execPath, ['tools/test-authenticated-reauth-rate-limit.mjs']);
    else if (process.argv.includes('--asvs-http-upgrade-only')) run(process.execPath, ['tools/test-http-upgrade-boundary.mjs']);
    else if (process.argv.includes('--asvs-media-types-only')) run(process.execPath, ['tools/test-response-media-types.mjs']);
    else if (process.argv.includes('--asvs-csrf-only')) run(process.execPath, ['tools/test-csrf-method-boundary.mjs']);
    else if (process.argv.includes('--asvs-browser-headers-only')) run(process.execPath, ['tools/test-browser-security-headers.mjs']);
    else if (process.argv.includes('--asvs-cookie-only')) run(process.execPath, ['tools/test-secure-cookies.mjs']);
    else run(process.execPath, ['tools/test-e2e-local.mjs', process.argv.includes('--asvs-content-context-only') ? '--asvs-content-context-only' : process.argv.includes('--asvs-automation-only') ? '--asvs-automation-only' : process.argv.includes('--asvs-locking-only') ? '--asvs-locking-only' : process.argv.includes('--asvs-community-limit-only') ? '--asvs-community-limit-only' : process.argv.includes('--asvs-business-limits-only') ? '--asvs-business-limits-only' : process.argv.includes('--asvs-sequence-only') ? '--asvs-sequence-only' : process.argv.includes('--asvs-file-download-only') ? '--asvs-file-download-only' : process.argv.includes('--asvs-file-storage-only') ? '--asvs-file-storage-only' : process.argv.includes('--asvs-file-content-only') ? '--asvs-file-content-only' : process.argv.includes('--asvs-header-file-only') ? '--asvs-header-file-only' : process.argv.includes('--asvs-body-only') ? '--asvs-body-only' : process.argv.includes('--asvs-query-only') ? '--asvs-query-only' : process.argv.includes('--asvs-limits-only') ? '--asvs-limits-only' : process.argv.includes('--asvs-context-only') ? '--asvs-context-only' : process.argv.includes('--asvs-input-only') ? '--asvs-input-only' : process.argv.includes('--asvs-counter-only') ? '--asvs-counter-only' : process.argv.includes('--asvs-zip-only') ? '--asvs-zip-only' : process.argv.includes('--asvs-version-only') ? '--asvs-version-only' : '--asvs-arithmetic-only']);
  } else {
  // Complete untouched defaults must be restored; customized Site data must remain byte-for-byte unchanged.
  const legacySiteId = '10000000-0000-4000-8000-000000000001';
  const customSiteId = '10000000-0000-4000-8000-000000000002';
  const legacyPlanningId = '20000000-0000-4000-8000-000000000001';
  const legacyExecutionId = '20000000-0000-4000-8000-000000000002';
  const customPlanningId = '20000000-0000-4000-8000-000000000003';
  run('docker', ['compose', '-p', project, 'stop', 'api']);
  run('docker', ['compose', '-p', project, 'exec', '-T', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'fylkren', '-d', 'fylkren', '-c', `
    INSERT INTO sites (id, name, normalized_name, is_active, created_at, final_report_template, overview_design, version)
    VALUES
      ('${legacySiteId}', 'Legacy defaults', 'LEGACY DEFAULTS', TRUE, '2026-09-01T00:00:00Z', '# Summary\\n\\n# Execution\\n\\n# Conclusion', 'classic', 1),
      ('${customSiteId}', 'Customized content', 'CUSTOMIZED CONTENT', TRUE, '2026-09-01T00:00:00Z', '# Customer report', 'classic', 1);
    INSERT INTO workflow_definitions (id, site_id, owner_unit_id, name, kind, is_system, is_active)
    VALUES
      ('${legacyPlanningId}', '${legacySiteId}', NULL, 'Standard', 'planning', FALSE, TRUE),
      ('${legacyExecutionId}', '${legacySiteId}', NULL, 'Standard', 'execution', FALSE, TRUE),
      ('${customPlanningId}', '${customSiteId}', NULL, 'Standard', 'planning', FALSE, TRUE);
    INSERT INTO workflow_steps (id, definition_id, template_id, name, sort_order, is_optional, allows_task_allocation, has_timeline)
    VALUES
      ('30000000-0000-4000-8000-000000000001', '${legacyPlanningId}', NULL, 'Analysis', 0, FALSE, FALSE, TRUE),
      ('30000000-0000-4000-8000-000000000002', '${legacyPlanningId}', NULL, 'Task', 1, FALSE, FALSE, FALSE),
      ('30000000-0000-4000-8000-000000000003', '${legacyPlanningId}', NULL, 'Intent', 2, FALSE, FALSE, FALSE),
      ('30000000-0000-4000-8000-000000000004', '${legacyPlanningId}', NULL, 'Plan', 3, FALSE, TRUE, FALSE),
      ('30000000-0000-4000-8000-000000000005', '${legacyExecutionId}', NULL, 'Preparation', 0, FALSE, FALSE, FALSE),
      ('30000000-0000-4000-8000-000000000006', '${legacyExecutionId}', NULL, 'Execution', 1, FALSE, FALSE, FALSE),
      ('30000000-0000-4000-8000-000000000007', '${legacyExecutionId}', NULL, 'Closure and follow-up', 2, FALSE, FALSE, FALSE),
      ('30000000-0000-4000-8000-000000000008', '${customPlanningId}', NULL, 'Analysis', 0, FALSE, FALSE, TRUE),
      ('30000000-0000-4000-8000-000000000009', '${customPlanningId}', NULL, 'Task', 1, FALSE, FALSE, FALSE),
      ('30000000-0000-4000-8000-000000000010', '${customPlanningId}', NULL, 'Customer intent', 2, FALSE, FALSE, FALSE),
      ('30000000-0000-4000-8000-000000000011', '${customPlanningId}', NULL, 'Plan', 3, FALSE, TRUE, FALSE);
    DELETE FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261002133000_PreserveSiteOwnedWorkContent';
  `]);
  run('docker', ['compose', '-p', project, 'up', '-d', '--wait', 'api']);
  run('docker', ['compose', '-p', project, 'exec', '-T', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'fylkren', '-d', 'fylkren', '-c', `
    DO \$\$
    DECLARE legacy_report text := convert_from(decode('IyBTYW1tZW5kcmFnCgojIEdqZW5ub21mw7hyaW5nCgojIEtvbmtsdXNqb24=', 'base64'), 'UTF8');
    BEGIN
      IF (SELECT final_report_template FROM sites WHERE id = '${legacySiteId}') <> legacy_report THEN RAISE EXCEPTION 'Legacy report default was not restored'; END IF;
      IF (SELECT final_report_template FROM sites WHERE id = '${customSiteId}') <> '# Customer report' THEN RAISE EXCEPTION 'Customized report template was changed'; END IF;
      IF (SELECT name FROM workflow_steps WHERE definition_id = '${legacyPlanningId}' AND sort_order = 0) <> convert_from(decode('QW5hbHlzZQ==', 'base64'), 'UTF8') THEN RAISE EXCEPTION 'Legacy planning defaults were not restored'; END IF;
      IF (SELECT name FROM workflow_steps WHERE definition_id = '${legacyExecutionId}' AND sort_order = 2) <> convert_from(decode('QXZzbHV0bmluZyBvZyBldHRlcmFyYmVpZA==', 'base64'), 'UTF8') THEN RAISE EXCEPTION 'Legacy execution defaults were not restored'; END IF;
      IF (SELECT name FROM workflow_steps WHERE definition_id = '${customPlanningId}' AND sort_order = 0) <> 'Analysis' THEN RAISE EXCEPTION 'Customized planning workflow was changed'; END IF;
    END \$\$;
    DELETE FROM workflow_definitions WHERE site_id IN ('${legacySiteId}', '${customSiteId}');
    DELETE FROM sites WHERE id IN ('${legacySiteId}', '${customSiteId}');
  `]);
  run('docker', ['compose', '-p', project, 'exec', '-T', 'api', 'sh', '-c', 'test ! -e /var/run/docker.sock']);
  run('docker', ['compose', '-p', project, 'exec', '-T', 'postgres', 'sh', '-c', 'test "$(id -u)" -ne 0']);
  run('docker', ['compose', '-p', project, 'exec', '-T', 'postgres', 'awk', '/^NoNewPrivs:/ { if ($2 != 1) exit 1; privileges = 1 } /^CapEff:/ { if ($2 != "0000000000000000") exit 1; capabilities = 1 } END { if (!privileges || !capabilities) exit 1 }', '/proc/self/status']);
  // Simulate unsafe CSS retained by an earlier version, only in this fresh lab.
  run('docker', ['compose', '-p', project, 'exec', '-T', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'fylkren', '-d', 'fylkren', '-c',
    `UPDATE branding_settings SET custom_css = '.panel { background: image-set("https://example.invalid/probe" 1x); }'`]);
  run(process.execPath, ['-e', `const r=await fetch('http://localhost:18081/api/branding');const b=await r.json();if(!r.ok||b.customCss!=='')throw new Error('Legacy unsafe CSS was exposed');console.log(JSON.stringify({legacyUnsafeCssSuppressed:true}));`]);
  run('docker', ['compose', '-p', project, 'exec', '-T', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'fylkren', '-d', 'fylkren', '-c',
    "UPDATE branding_settings SET custom_css = ''"]);
  run('./deploy/compose/backup.sh', [backupRoot]);
  if (existsSync(oldestBackup)) throw new Error('Oldest completed backup was not pruned');
  if (!existsSync(retainedBackup)) throw new Error('Newest previous completed backup was pruned');
  if (!existsSync(incompleteBackup)) throw new Error('Incomplete backup must never be pruned automatically');
  const backupSets = readdirSync(backupRoot).filter(name =>
    name.startsWith('fylkren-') && existsSync(join(backupRoot, name, 'manifest.json')));
  if (backupSets.length !== 1) throw new Error(`Expected one backup set, received ${backupSets.length}`);
  const backupSet = join(backupRoot, backupSets[0]);
  for (const artifact of ['fylkren.dump', 'env.backup', 'data-protection-keys.tar.gz', 'manifest.json', 'SHA256SUMS', 'COMPLETE']) {
    if (!statSync(join(backupSet, artifact)).isFile()) throw new Error(`Missing backup artifact: ${artifact}`);
  }
  if (existsSync(join(backupSet, 'INCOMPLETE'))) throw new Error('Completed backup retained its INCOMPLETE marker');
  run('sha256sum', ['-c', 'SHA256SUMS'], { cwd: backupSet });
  run('./deploy/compose/restore.sh', [backupSet, '--confirm-destructive-restore']);
  if (process.argv.includes('--no-build')) run(process.execPath, ['-e', `
    const {execFileSync}=await import('node:child_process');
    for(const service of ['api','web']) {
      const expected=process.env[service==='api'?'FYLKREN_E2E_API_IMAGE':'FYLKREN_E2E_WEB_IMAGE'];
      const actual=execFileSync('docker',['inspect','--format','{{.Image}}','${project}-'+service+'-1'],{encoding:'utf8'}).trim();
      const layers=ref=>execFileSync('docker',['image','inspect','--format','{{json .RootFS.Layers}}',ref],{encoding:'utf8'}).trim();
      if(layers(actual)!==layers(expected))throw new Error('Restore changed the candidate '+service+' image');
      console.log(JSON.stringify({restoredCandidateImage:service,image:actual}));
    }`]);
  run(process.execPath, ['-e', `const response=await fetch('http://localhost:18081/api/configuration/public');const body=await response.json();if(!response.ok||body.setupRequired!==true)throw new Error(JSON.stringify(body));`]);
  run(process.execPath, ['tools/test-e2e-local.mjs', ...['--asvs-input-only', '--workload-only'].filter(flag => process.argv.includes(flag))]);
  }
} finally {
  try {
    run('docker', ['compose', '-p', project, 'down', '-v']);
  } finally {
    rmSync(backupRoot, { recursive: true, force: true });
    if (savedEnvironment === null) rmSync(environmentPath, { force: true });
    for (const [path, content] of savedMarkers) {
      if (content === null) rmSync(path, { force: true });
      else writeFileSync(path, content);
    }
  }
}
