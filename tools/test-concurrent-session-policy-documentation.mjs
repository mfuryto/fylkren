import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const access = readFileSync('docs/administration/ACCESS_AND_IDENTITY.md', 'utf8');
const identity = readdirSync('apps/api/Identity')
  .filter((name) => name.endsWith('.cs'))
  .map((name) => readFileSync(`apps/api/Identity/${name}`, 'utf8'))
  .join('\n');
const context = readFileSync('apps/api/Persistence/FylkrenDbContext.cs', 'utf8');

assert.match(access, /permits multiple concurrent browser sessions/);
assert.match(access, /applies no numeric count limit/);
assert.match(access, /never evicts an older session merely because another browser signs in/);
assert.match(access, /invalidates every earlier session at its next request/);
assert.match(access, /no per-session list, selective termination or oldest-session eviction/);
assert.match(identity, /SecurityVersion/);
assert.doesNotMatch(context, /DbSet<[^>]*(?:BrowserSession|UserSession|LoginSession)/i);

process.stdout.write(`${JSON.stringify({ concurrentSessionPolicyDocumentation: 'passed',
  numericMaximum: null, concurrentSessionsAllowed: true, loginEviction: false,
  perSessionRegistry: false, globalRevocationMechanism: 'security-version',
  selectiveTermination: false })}\n`);
