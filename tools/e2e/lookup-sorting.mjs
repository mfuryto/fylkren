import assert from 'node:assert/strict';

export async function testLookupSorting({ manager, reader, siteId }) {
  const collator = new Intl.Collator('en-US', { sensitivity: 'base' });
  let taskTypeId;
  for (const path of ['types', 'lookups/source-type', 'lookups/sender']) {
    const created = [];
    for (const [index, name] of ['Exercise', 'Aachen', 'Beta', 'Alpha'].entries()) {
      const abbreviation = `${name.slice(0, 3).toUpperCase()}${index}`;
      const response = await manager.post(`/api/work/sites/${siteId}/${path}`, path === 'types' ? { name, abbreviation } : { name });
      assert.equal(response.status, 201, `${path}: ${JSON.stringify(response.body)}`);
      created.push({ id: response.body.id, name, abbreviation });
      if (path === 'types' && name === 'Exercise') taskTypeId = response.body.id;
    }
    const inactive = created.find(value => value.name === 'Alpha');
    const deactivated = await manager.put(`/api/work/sites/${siteId}/${path}/${inactive.id}`, path === 'types'
      ? { name: inactive.name, abbreviation: inactive.abbreviation, isActive: false }
      : { name: inactive.name, isActive: false });
    assert.equal(deactivated.status, 204, `${path}: ${JSON.stringify(deactivated.body)}`);

    const listed = await reader.request(`/api/work/sites/${siteId}/${path}`);
    assert.equal(listed.status, 200, `${path}: ${JSON.stringify(listed.body)}`);
    const names = listed.body.map(value => value.name);
    if (path === 'types') {
      assert.deepEqual(names.slice(0, created.length), [...created].reverse().map(value => value.name), 'Task types were not newest first');
    } else {
      assert.deepEqual(names, [...names].sort(collator.compare), `${path} was not alphabetic in English order`);
    }
    assert.equal(listed.body.find(value => value.id === inactive.id)?.isActive, false);
    const activeNames = listed.body.filter(value => value.isActive).map(value => value.name);
    if (path !== 'types') assert.deepEqual(activeNames, [...activeNames].sort(collator.compare), `${path} select options were not alphabetic`);
  }
  return { taskTypeId };
}
