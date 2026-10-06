import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const read = path => readFileSync(path, 'utf8');
const inventory = read('docs/security/SECRETS_AND_SECURITY_LOGGING.md');
const middleware = read('apps/api/Platform/SecurityEventMiddleware.cs');
const registration = read('apps/api/ServiceRegistration.cs');
const program = read('apps/api/Program.cs');

for (const layer of ['Gateway/container', 'API technical', 'Security audit', 'Domain activity', 'External delivery']) assert.match(inventory, new RegExp(`\\| ${layer.replace('/', '\\/')} \\|`));
for (const finding of ['SV-107', 'SV-108']) assert.match(inventory, new RegExp(finding));
assert.match(middleware, /EventId\(4101, "AccessRejected"\)/);
assert.match(middleware, /Method.*Route.*StatusCode.*ActorPersonId.*TraceId/s);
assert.match(middleware, /statusCode == StatusCodes\.Status401Unauthorized[\s\S]*actorPersonId == "anonymous"[\s\S]*HttpMethods\.IsGet[\s\S]*HttpMethods\.IsHead/,
  'routine anonymous reads must remain structured without becoming operational warnings');
assert.match(middleware, /routineAnonymousRead \? LogLevel\.Information : LogLevel\.Warning/,
  'authenticated denials and anonymous mutations must remain warnings');
assert.match(registration, /EventId\(4100, "AuthenticationSucceeded"\)/);
assert.match(program, /UseExceptionHandler\(\)/);

const files = [];
const walk = dir => { for (const item of readdirSync(dir, { withFileTypes: true })) item.isDirectory() ? (item.name !== 'Migrations' && walk(join(dir, item.name))) : item.name.endsWith('.cs') && files.push(join(dir, item.name)); };
walk('apps/api');
const source = files.map(read).join('\n');
assert.match(source, /Sanitize|LogSanitizer/);
assert.doesNotMatch(source, /FileLogger|AddFile|WriteAllText\([^\n]*log/i);

console.log(JSON.stringify({
  securityLoggingInventory: 'assessed',
  documentedLayers: 5,
  structuredAccessDenials: true,
  centralSanitizer: true,
  findings: ['SV-107', 'SV-108'],
}));
