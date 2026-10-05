import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const read = path => readFileSync(path, 'utf8');
const inventory = read('docs/security/DATA_PROTECTION_INVENTORY.md');
const program = read('apps/api/Program.cs');
const client = read('apps/web/src/api/client.ts');
const main = read('apps/web/src/main.tsx');

for (const level of ['Critical secret', 'Restricted personal/security', 'Restricted operational', 'Operational configuration', 'Public'])
  assert.match(inventory, new RegExp(`\\| ${level.replace('/', '\\/')} \\|`));
for (const family of ['attachments/references', 'activity', 'notifications', 'webhooks', 'federation payloads', 'backups', 'logs'])
  assert.match(inventory.toLowerCase(), new RegExp(family.replace('/', '\\/')));

assert.match(program, /StartsWithSegments\("\/api"\)[\s\S]{0,300}CacheControl = "no-store"/);
assert.match(program, /default-src 'none'/);
assert.match(client, /const getCache = new Map/);
assert.match(client, /export function clearApiGetCache\(\)/);
assert.match(main, /await endSession\(\);[\s\S]{0,300}setSession\(\{ authenticated: false/);

const webRoot = 'apps/web/src';
const files = [];
const walk = dir => { for (const name of readdirSync(dir, { withFileTypes: true })) name.isDirectory() ? walk(join(dir, name.name)) : name.name.endsWith('.ts') || name.name.endsWith('.tsx') ? files.push(join(dir, name.name)) : undefined; };
walk(webRoot);
const production = files.filter(path => !path.endsWith('.test.ts') && !path.endsWith('.test.tsx')).map(read).join('\n');
const localStorageUses = [...production.matchAll(/localStorage\.(?:getItem|setItem)\(([^\n]+)/g)];
assert.equal(localStorageUses.length, 2, 'only the documented layout preference may use localStorage');
assert.doesNotMatch(production, /sessionStorage|indexedDB|document\.cookie/);

console.log(JSON.stringify({
  dataProtectionInventory: 'passed',
  protectionLevels: 5,
  apiNoStore: true,
  thirdPartyOriginsAllowedByCsp: 0,
  sensitiveBrowserStorageUses: 0,
}));
