import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readZip, writeZip } from './zip.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');

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
  assert.equal(manifest.format, 'fylkren-portable-export');
  assert.equal(manifest.formatVersion, '1.0');
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
  const noApply = await platform.request(`/api/portability/sites/${siteId}/imports/apply`, { method: 'POST' });
  assert.equal(noApply.status, 404, 'Import-apply endpoint unexpectedly exists');
  return { portableExportId: manifest.exportId, portableDatasetCount: manifest.datasets.length };
}
