import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// Real application pages with isolated synthetic fetch fixtures; no production API is contacted.
const endpoint = process.env.FYLKREN_BROWSER_CDP_URL ?? 'http://127.0.0.1:19224';
const base = process.env.FYLKREN_DOCUMENTATION_PREVIEW_URL ?? 'http://127.0.0.1:19226/test-fixtures/documentation-preview.html';
const output = process.env.FYLKREN_DOCUMENTATION_EVIDENCE ?? 'output/documentation-preview';
await mkdir(output, { recursive: true });
const evidence = [];
for (const page of ['Overview', 'Tasks', 'Planning', 'Execution', 'Reports']) {
  const target = await (await fetch(`${endpoint}/json/new?${encodeURIComponent(`${base}?page=${page}`)}`, { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', event => {
    const value = JSON.parse(event.data);
    if (value.id && pending.has(value.id)) { const { resolve, reject } = pending.get(value.id); pending.delete(value.id); value.error ? reject(value.error) : resolve(value.result); }
    if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.text);
    if (value.method === 'Log.entryAdded' && value.params.entry.level === 'error') errors.push(value.params.entry.text);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  async function evaluate(expression) {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function wait(expression) {
    for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw new Error(`Timed out on ${page}: ${expression}`);
  }
  async function screenshot(name) { await writeFile(`${output}/${name}.png`, Buffer.from((await call('Page.captureScreenshot', { format: 'png' })).data, 'base64')); }
  try {
    await call('Runtime.enable'); await call('Page.enable'); await call('Log.enable');
    await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
    const ready = {
      Overview: 'document.querySelectorAll(".overview-unit-card").length === 3 && !document.querySelector("[aria-busy=true]")',
      Tasks: 'document.querySelectorAll(".task-card, .task-table tbody tr").length >= 5',
      Planning: 'document.querySelectorAll(".timeline-point").length === 5',
      Execution: 'document.querySelector(".execution-workflow") !== null',
      Reports: 'document.body.textContent.includes("Autumn communication exercise")',
    };
    await wait(ready[page]);
    await evaluate('document.fonts.ready');
    await new Promise(resolve => setTimeout(resolve, 400));
    assert.equal(await evaluate('document.querySelector(".error-message")?.textContent ?? ""'), '', `${page} page error`);
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `${page} horizontal overflow`);
    if (page === 'Planning') assert.ok(await evaluate('document.querySelector(".timeline-ruler").getBoundingClientRect().bottom < innerHeight'), 'Timeline must be visible in screenshot');
    await screenshot(page.toLowerCase());
    if (page === 'Reports') {
      await evaluate('document.querySelector(".report-heading-button").click()');
      await wait('document.querySelector("#printable-report") !== null');
      assert.ok(await evaluate('document.querySelector("#printable-report").textContent.includes("OPS-000106")'));
      await screenshot('report-document');
    }
    assert.deepEqual(errors, [], `${page} browser errors`);
    evidence.push({ page, browserErrors: 0, requests: await evaluate('window.documentationRequests') });
  } finally { socket.close(); await fetch(`${endpoint}/json/close/${target.id}`); }
}
await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ output, pages: evidence.map(value => value.page), browserErrors: 0 }));
