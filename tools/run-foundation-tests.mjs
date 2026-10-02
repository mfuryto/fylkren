import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const name = `fylkren-foundations-${randomUUID().slice(0, 8)}`;
const run = (command, args, options = {}) => execFileSync(command, args, { stdio: 'inherit', ...options });
try {
  run('docker', ['run', '-d', '--name', name, '-e', 'POSTGRES_DB=fylkren_foundation_test', '-e', 'POSTGRES_USER=fylkren',
    '-e', 'POSTGRES_PASSWORD=synthetic-foundation-only', '-p', '127.0.0.1::5432', 'postgres:18-alpine']);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { execFileSync('docker', ['exec', name, 'pg_isready', '-U', 'fylkren'], { stdio: 'ignore' }); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  if (!ready) throw new Error('Disposable foundation database did not become ready.');
  const address = execFileSync('docker', ['port', name, '5432/tcp'], { encoding: 'utf8' }).trim();
  const port = Number(address.split(':').at(-1));
  run('dotnet', ['run', '--project', 'tests/foundations/Fylkren.FoundationTests.csproj'], { env: { ...process.env,
    FYLKREN_FOUNDATION_TEST_DATABASE: `Host=127.0.0.1;Port=${port};Database=fylkren_foundation_test;Username=fylkren;Password=synthetic-foundation-only` } });
} finally { run('docker', ['rm', '-f', '-v', name]); }
