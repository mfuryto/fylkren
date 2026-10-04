import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readZip, writeZip } from './zip.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');

export async function testPortableFileContent({ platform, siteManager, siteId }) {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const profile = new FormData(); profile.append('image', new Blob([png], { type: 'image/png' }), 'profile.png');
  assert.equal((await siteManager.request('/api/profile/image', { method: 'PUT', body: profile })).status, 204);
  const exported = await siteManager.request(`/api/portability/sites/${siteId}/export`, { method: 'POST', binary: true });
  assert.equal(exported.status, 200, JSON.stringify(exported.body));
  const entries = readZip(exported.body), manifest = JSON.parse(entries.get('manifest.json').toString('utf8'));
  assert.ok(manifest.attachments.length > 0, 'Profile image was absent from the Site portability package');
  const endpoint = `/api/portability/sites/${siteId}/imports/validate`;
  async function upload(bytes, type = 'application/zip', name = 'portable.zip', expectedStatus = 200) {
    const form = new FormData(); form.append('package', new Blob([bytes], { type }), name);
    const response = await platform.request(endpoint, { method: 'POST', body: form });
    assert.equal(response.status, expectedStatus, `${name}/${type} returned ${response.status}`);
    return response.body;
  }
  assert.equal((await upload(exported.body)).valid, true, 'Untouched package failed content validation');
  await upload(exported.body, 'application/zip', 'portable.txt', 400);
  await upload(exported.body, 'application/octet-stream', 'portable.zip', 400);
  async function reject(edit, label) {
    const copy = new Map(entries), metadata = structuredClone(manifest);
    edit(copy, metadata);
    copy.set('manifest.json', Buffer.from(JSON.stringify(metadata)));
    assert.equal((await upload(writeZip(copy))).valid, false, `${label} was accepted`);
  }
  await reject((_files, metadata) => { metadata.datasets[0].mediaType = 'text/plain'; }, 'Dataset media-type mismatch');
  await reject((_files, metadata) => { metadata.attachments[0].mediaType = 'image/jpeg'; }, 'Attachment media-type mismatch');
  await reject((files, metadata) => {
    const descriptor = metadata.attachments[0], oldPath = descriptor.path;
    descriptor.path = oldPath.replace(/\.png$/i, '.jpg');
    files.set(descriptor.path, files.get(oldPath)); files.delete(oldPath);
  }, 'Attachment extension/content mismatch');
  await reject((files, metadata) => {
    const descriptor = metadata.attachments[0];
    const disguised = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('<script>synthetic()</script>')]);
    files.set(descriptor.path, disguised); descriptor.bytes = disguised.length; descriptor.sha256 = digest(disguised);
  }, 'Signature-only active attachment');
  return { portableFileContent: 'passed', outerPackageTypeRejections: 2,
    rejectedInternalTypeCases: 4, decodedAttachmentTypes: ['png', 'jpeg', 'webp'] };
}

export async function testPortableParserBoundaries({ platform, siteManager, siteId, entries, manifest }) {
  if (!entries) {
    const exported = await siteManager.request(`/api/portability/sites/${siteId}/export`, { method: 'POST', binary: true });
    assert.equal(exported.status, 200);
    entries = readZip(exported.body);
    manifest = JSON.parse(entries.get('manifest.json').toString('utf8'));
  }
  async function validate(edit) {
    const copy = new Map(entries), metadata = structuredClone(manifest);
    edit(metadata);
    copy.set('manifest.json', Buffer.from(JSON.stringify(metadata)));
    const form = new FormData();
    form.append('package', new Blob([writeZip(copy)], { type: 'application/zip' }), 'synthetic-parser.zip');
    const response = await platform.request(`/api/portability/sites/${siteId}/imports/validate`, { method: 'POST', body: form });
    assert.equal(response.status, 200, 'Malformed portable metadata must produce a bounded validation result');
    return response.body;
  }
  assert.equal((await validate(() => {})).valid, true, 'Unchanged Site export must validate');
  for (const siteName of ['&lt;script&gt;synthetic()&lt;/script&gt;', '%253Cscript%253E', String.raw`\u003cscript\u003e`]) {
    const result = await validate(value => { value.site.name = siteName; });
    assert.equal(result.valid, true); assert.equal(result.siteName, siteName, 'Import metadata was decoded again');
  }
  const typed = await validate(value => { value.$type = 'Synthetic.UntrustedType, Synthetic'; value.site.$type = 'Synthetic.OtherType'; });
  assert.equal(typed.valid, true, 'Unknown type metadata must not select a runtime type');
  const invalid = [
    ['snapshot missing', value => { value.snapshot = null; }],
    ['duplicate dataset name', value => { value.datasets[1].name = value.datasets[0].name; }],
    ['site null', value => { value.site = null; }],
    ['datasets null', value => { value.datasets = null; }],
    ['attachments null', value => { value.attachments = null; }],
    ['exclusions null', value => { value.exclusions = null; }],
    ['dataset null', value => { value.datasets[0] = null; }],
    ['dataset name null', value => { value.datasets[0].name = null; }],
    ['dataset path null', value => { value.datasets[0].path = null; }],
    ['attachment null', value => { value.attachments.push(null); }],
    ['attachment path null', value => { value.attachments.push({ path: null, bytes: 0 }); }],
    ['record count overflow', value => { value.datasets[0].recordCount = 2147483648; }],
    ['byte count overflow', value => { value.datasets[0].bytes = 1e30; }],
    ['negative record count', value => { value.datasets[0].recordCount = -1; }],
    ['negative byte count', value => { value.datasets[0].bytes = -1; }],
    ['record count limit', value => { value.datasets[0].recordCount = 1_000_001; }],
    ['byte count limit', value => { value.datasets[0].bytes = 16 * 1024 * 1024 + 1; }],
    ['descriptor count limit', value => { value.datasets = Array.from({ length: 251 }, () => value.datasets[0]); }],
    ['metadata text limit', value => { value.site.name = 'a'.repeat(513); }],
    ['encoded site ID', value => { value.site.id = `%25${siteId}`; }],
  ];
  for (const [label, edit] of invalid) {
    const result = await validate(edit);
    assert.equal(result.valid, false, `Unsafe manifest accepted: ${label}`);
    assert.doesNotMatch(JSON.stringify(result), /NullReferenceException|stack trace|System\.Runtime/i);
  }
  return { portableParserBoundaries: 'passed', literalMetadataCases: 3, rejectedManifestCases: invalid.length, clientTypeMetadataIgnored: true };
}

export async function testPortability({ platform, siteManager, leader, siteId, otherSiteId, taskId, decisionId, riskId }) {
  const endpoint = `/api/portability/sites/${siteId}`;
  const denied = await leader.request(`${endpoint}/export`, { method: 'POST' });
  assert.equal(denied.status, 403, 'Operational leader exported site without administrative authority');
  const exportResult = await siteManager.request(`${endpoint}/export`, { method: 'POST', binary: true });
  assert.equal(exportResult.status, 200, `Portable export status ${exportResult.status}`);
  assert.match(exportResult.contentType, /application\/zip/);
  const entries = readZip(exportResult.body);
  assert.ok(entries.has('manifest.json') && entries.has('README.txt'));
  const manifest = JSON.parse(entries.get('manifest.json').toString('utf8'));
  const parserBoundaries = await testPortableParserBoundaries({ platform, siteManager, siteId, entries, manifest });
  assert.equal(manifest.format, 'fylkren-portable-export');
  assert.equal(manifest.formatVersion, '1.1');
  assert.equal(manifest.site.id, siteId);
  assert.equal(manifest.integrityAlgorithm, 'SHA-256');
  for (const dataset of manifest.datasets) {
    const content = entries.get(dataset.path);
    assert.ok(content, `Missing dataset ${dataset.path}`);
    assert.equal(content.length, dataset.bytes, `Size mismatch ${dataset.path}`);
    assert.equal(digest(content), dataset.sha256, `SHA-256 mismatch ${dataset.path}`);
    assert.equal(content.toString('utf8').split('\n').filter(Boolean).length, dataset.recordCount);
  }
  for (const [name, id] of [['work-items', taskId], ['decisions', decisionId], ['risks', riskId]]) {
    const lines = entries.get(`data/${name}.jsonl`).toString('utf8').split('\n').filter(Boolean).map(JSON.parse);
    assert.ok(lines.some(value => value.id === id), `Export lacks ${name} ID ${id}`);
  }
  const comments = entries.get('data/work-item-comments.jsonl').toString('utf8').split('\n').filter(Boolean).map(JSON.parse);
  assert.ok(comments.some(value => value.work_item_id === taskId), 'Export lacks task comments');
  const learning = entries.get('data/learning-lessons.jsonl').toString('utf8').split('\n').filter(Boolean).map(JSON.parse);
  const learningEntries = entries.get('data/learning-entries.jsonl').toString('utf8').split('\n').filter(Boolean).map(JSON.parse);
  assert.ok(learning.some(value => value.work_item_id === taskId), 'Full Site export lacks internal learning');
  assert.ok(learningEntries.length > 0, 'Learning treatment history missing from export');
  const people = new Set(entries.get('data/people.jsonl').toString('utf8').split('\n').filter(Boolean).map(line => JSON.parse(line).id));
  for (const lesson of learning) { assert.ok(people.has(lesson.author_person_id)); if (lesson.owner_person_id) assert.ok(people.has(lesson.owner_person_id)); }
  for (const entry of learningEntries) assert.ok(people.has(entry.author_person_id));
  for (const comment of comments) assert.ok(people.has(comment.author_person_id), 'Comment author missing from export');
  assert.ok(![...entries.keys()].some(value => /password|reset-grant|session|secret/i.test(value)),
    'Authentication secrets included as package entries');

  async function validate(bytes, targetSiteId = siteId) {
    const form = new FormData();
    form.append('package', new Blob([bytes], { type: 'application/zip' }), 'synthetic.zip');
    const result = await platform.request(`/api/portability/sites/${targetSiteId}/imports/validate`, {
      method: 'POST', body: form,
    });
    assert.equal(result.status, 200, `Validation status: ${JSON.stringify(result.body)}`);
    return result.body;
  }
  const valid = await validate(exportResult.body);
  assert.equal(valid.valid, true, `Original package rejected: ${JSON.stringify(valid.errors)}`);
  assert.equal(valid.siteId, siteId);
  const wrongSite = await validate(exportResult.body, otherSiteId);
  assert.equal(wrongSite.valid, false, 'Package validated against different site');
  function editedPackage(edit) {
    const copy = new Map(entries);
    const metadata = structuredClone(manifest);
    edit(copy, metadata);
    copy.set('manifest.json', Buffer.from(JSON.stringify(metadata)));
    return writeZip(copy);
  }
  const legacy = await validate(editedPackage((_files, metadata) => { metadata.formatVersion = '1.0'; delete metadata.snapshot; }));
  assert.equal(legacy.valid, true); assert.ok(legacy.warnings.some(w => /Legacy format/.test(w)));
  const incompatible = await validate(editedPackage((_files, metadata) => { metadata.formatVersion = '99.0'; }));
  assert.equal(incompatible.valid, false, 'Unsupported version accepted');
  const missing = await validate(editedPackage((files) => { files.delete('data/work-items.jsonl'); }));
  assert.equal(missing.valid, false, 'Missing declared relationship dataset accepted');
  const tampered = await validate(editedPackage((files) => {
    const file = Buffer.from(files.get('data/work-items.jsonl'));
    const original = Buffer.from('Synthetic');
    const position = file.indexOf(original);
    assert.ok(position >= 0);
    file[position] = 'X'.charCodeAt(0);
    files.set('data/work-items.jsonl', file);
  }));
  assert.equal(tampered.valid, false, 'Changed content with stale SHA-256 accepted');
  function changedWorkItem(edit) {
    return editedPackage((files, metadata) => {
      const path = 'data/work-items.jsonl';
      const records = files.get(path).toString('utf8').split('\n').filter(Boolean).map(JSON.parse);
      edit(records);
      const data = Buffer.from(`${records.map(value => JSON.stringify(value)).join('\n')}\n`);
      files.set(path, data);
      const descriptor = metadata.datasets.find(value => value.path === path);
      descriptor.bytes = data.length;
      descriptor.sha256 = digest(data);
    });
  }
  const malformed = await validate(changedWorkItem(records => { records[0].id = 'not-a-uuid'; }));
  assert.equal(malformed.valid, false, 'Malformed ID accepted');
  const crossing = await validate(changedWorkItem(records => { records[0].site_id = otherSiteId; }));
  assert.equal(crossing.valid, false, 'Cross-site row accepted');
  const missingReference = await validate(changedWorkItem(records => { records[0].created_by_person_id = '00000000-0000-4000-8000-000000000001'; }));
  assert.equal(missingReference.valid, false, 'Missing person relationship accepted');
  function changedLifecycle(edit) {
    return editedPackage((files, metadata) => {
      const path = 'data/information-lifecycle.jsonl';
      const records = files.get(path).toString('utf8').split('\n').filter(Boolean).map(JSON.parse);
      assert.ok(records.length > 0);
      edit(records[0]);
      const data = Buffer.from(`${records.map(JSON.stringify).join('\n')}\n`);
      files.set(path, data);
      const descriptor = metadata.datasets.find(d => d.path === path);
      descriptor.bytes = data.length; descriptor.sha256 = digest(data);
    });
  }
  for (const [label, edit] of [
    ['foreign lifecycle owner', row => { row.owner_site_id = otherSiteId; }],
    ['numeric lifecycle owner', row => { row.owner_site_id = 42; }],
    ['missing immutable policy', row => { row.policy_id = '00000000-0000-4000-8000-000000000001'; row.policy_version = 1; }],
    ['string policy version', row => { row.policy_id = '00000000-0000-4000-8000-000000000001'; row.policy_version = '1'; }],
    ['unpaired policy version', row => { row.policy_id = null; row.policy_version = 1; }],
  ]) assert.equal((await validate(changedLifecycle(edit))).valid, false, label);
  assert.equal((await validate(editedPackage((_files, metadata) => { metadata.datasets = metadata.datasets.filter(d => d.name !== 'lifecycle-holds'); }))).valid, false, 'Missing 1.1 foundation dataset accepted');
  const noApply = await platform.request(`/api/portability/sites/${siteId}/imports/apply`, { method: 'POST' });
  assert.equal(noApply.status, 404, 'Import-apply endpoint unexpectedly exists');
  return { portableExportId: manifest.exportId, portableDatasetCount: manifest.datasets.length, ...parserBoundaries };
}

export async function testZipLengthArithmetic({ platform, siteManager, siteId }) {
  const endpoint = `/api/portability/sites/${siteId}/imports/validate`;
  const empty = new Map([['a', Buffer.alloc(0)], ['b', Buffer.alloc(0)]]);
  const maximum = 16n * 1024n * 1024n;
  const cases = [
    ['long sum overflow', new Map([['a', 9223372036854775807n], ['b', 9223372036854775807n]]), true],
    ['single unsigned maximum', new Map([['a', 18446744073709551615n]]), true],
    ['aggregate size exceeds limit', new Map([['a', maximum / 2n], ['b', maximum / 2n + 1n]]), true],
    ['exact aggregate limit', new Map([['a', maximum / 2n], ['b', maximum / 2n]]), false],
    ['zero lengths', new Map([['a', 0n], ['b', 0n]]), false],
  ];
  for (const [label, lengths, tooLarge] of cases) {
    const bytes = writeZip(empty, lengths);
    assert.ok(bytes.length < 512, 'Synthetic declared lengths must never allocate their claimed data');
    const form = new FormData();
    form.append('package', new Blob([bytes], { type: 'application/zip' }), 'synthetic-zip64.zip');
    const response = await platform.request(endpoint, { method: 'POST', body: form });
    assert.equal(response.status, 200, `${label} must return bounded validation`);
    assert.equal(response.body.valid, false);
    const output = JSON.stringify(response.body);
    if (tooLarge && label !== 'single unsigned maximum') assert.match(output, /size|16 MiB/i);
    if (!tooLarge) assert.match(output, /missing manifest/i, 'Admissible size must proceed to manifest validation');
    assert.doesNotMatch(output, /OverflowException|stack trace|System\.Runtime/i);
  }
  return { zipLengthArithmetic: 'passed', zip64BoundaryCases: cases.length, ...(await testPortableParserBoundaries({ platform, siteManager, siteId })) };
}
