import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const endpoint = process.env.FYLKREN_BROWSER_CDP_URL ?? 'http://127.0.0.1:19224';
const url = process.env.FYLKREN_LEARNING_PREVIEW_URL ?? 'http://127.0.0.1:19226/test-fixtures/learning-preview.html';
const output = process.env.FYLKREN_LEARNING_EVIDENCE ?? 'output/learning-preview';
const target = await (await fetch(`${endpoint}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', event => {
  const value = JSON.parse(event.data);
  if (value.id && pending.has(value.id)) { const { resolve, reject } = pending.get(value.id); pending.delete(value.id); value.error ? reject(value.error) : resolve(value.result); }
  if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.text);
});
const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
async function evaluate(expression) { const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(expression) { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(100); } throw new Error(`Timed out: ${expression}`); }
async function click(selector) {
  const p = await evaluate(`(() => { const element=document.querySelector(${JSON.stringify(selector)}); element.scrollIntoView({block:'center'}); const r=element.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, button: 'left', clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...p, button: 'left', clickCount: 1 }); await pause(100);
}
async function setInput(selector, value) {
  await evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await pause(100);
}
async function screenshot(name) { await writeFile(`${output}/${name}.png`, Buffer.from((await call('Page.captureScreenshot', { format: 'png' })).data, 'base64')); }
try {
  await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1360, height: 1000, deviceScaleFactor: 1, mobile: false });
  await wait('document.querySelectorAll(".learning-table tbody tr").length === 2');
  assert.equal(await evaluate('document.querySelector(".learning-table tbody tr:first-child td:nth-child(3) .learning-kind-positive").getAttribute("role")'), 'img');
  assert.ok(await evaluate('document.querySelector(".learning-kind-improvement").getAttribute("aria-label").length > 0'));
  assert.equal(await evaluate('document.querySelector(".learning-table tbody tr:first-child td:nth-child(4) small") === null'), true, 'Category question must not be repeated below the point');
  await wait('document.querySelector("nav a[href$=learning]").textContent.includes("(2)")');
  await evaluate('document.querySelector("#preview-report").hidden = true');
  await mkdir(output, { recursive: true }); await screenshot('desktop-list');
  await click('.learning-status-action');
  assert.ok(await evaluate('document.querySelector(".learning-text").textContent.includes("Shared status")'), 'Status opens only its own point');
  await setInput('#lesson-status', 'in_progress');
  assert.equal(await evaluate('document.querySelector(".learning-review button").disabled'), true);
  await setInput('#lesson-plan', 'Publish the useful practice in the local handbook');
  await setInput('#lesson-due', '2026-11-01');
  assert.equal(await evaluate('document.querySelector(".learning-review button").disabled'), false);
  await setInput('#lesson-comment', 'Concrete internal feedback');
  await evaluate('document.querySelector("#lesson-comment").closest("form").requestSubmit()');
  await wait('document.querySelector(".learning-history").textContent.includes("Concrete internal feedback")');
  await screenshot('desktop-treatment');
  await evaluate('document.querySelector(".learning-review").requestSubmit()');
  await wait('document.querySelector(".modal-card") === null');
  assert.equal(await evaluate('document.querySelectorAll(".learning-table tbody tr")[1].querySelector(".learning-status-action").textContent.trim()'), new URL(url).searchParams.get('language') === 'en-US' ? 'New ▾' : '\u004e\u0079\u0065 ▾', 'Treating one point leaves the other point unchanged');
  assert.ok(await evaluate('document.querySelector("nav a[href$=learning]").textContent.includes("(2)")'));
  await click('.learning-point-title');
  await setInput('#lesson-status', 'implemented');
  assert.equal(await evaluate('document.querySelector(".learning-review button").disabled'), true);
  await setInput('#lesson-note', 'Practice added to the local handbook');
  await evaluate('document.querySelector(".learning-review").requestSubmit()');
  await wait('document.querySelectorAll(".learning-table tbody tr").length === 1');
  await wait('document.querySelector("nav a[href$=learning]").textContent.includes("(1)")');
  await setInput('#learning-view', 'closed');
  await wait('document.querySelector(".learning-point-title").textContent.includes("Shared status")');
  await evaluate('document.querySelector("#preview-report").hidden = false');
  await click('#preview-report');
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".learning-saved-points li"), e => e.value)'), [1, 1], 'Each saved category starts at one');
  await click('.learning-report-points fieldset:first-of-type > button');
  await click('.learning-report-points fieldset:last-of-type > button');
  await click('.learning-report-points fieldset:first-of-type > button');
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".learning-report-points fieldset"), field => Array.from(field.querySelectorAll(".learning-draft-points li"), e => e.value))'), [[2, 3], [2]], 'Interleaved additions continue only within their own category');
  await click('.learning-report-points fieldset:first-of-type .learning-draft-points li:first-child button');
  assert.equal(await evaluate('document.querySelector(".learning-report-points fieldset:first-of-type .learning-draft-points li").value'), 2, 'Removing a draft renumbers its category');
  await click('.learning-report-points fieldset:last-of-type .learning-draft-points li button');
  await setInput('.learning-report-points fieldset:first-of-type textarea', 'PRIVATE_BROWSER_LEARNING_SENTINEL');
  await screenshot('desktop-report');
  await evaluate('document.querySelector(".learning-report-points").closest("form").requestSubmit()');
  await wait('window.testReportPayload !== null');
  assert.ok(!(await evaluate('window.testReportPayload.content')).includes('PRIVATE_BROWSER_LEARNING_SENTINEL'));
  assert.equal(await evaluate('window.testReportPayload.lessons[0].text'), 'PRIVATE_BROWSER_LEARNING_SENTINEL');
  await wait('document.querySelector("nav a[href$=learning]").textContent.includes("(2)")');
  await setInput('#learning-view', 'active');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await pause(300);
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile document overflow');
  assert.ok(await evaluate('document.querySelector(".learning-table-scroll").scrollWidth > document.querySelector(".learning-table-scroll").clientWidth'), 'Learning table should scroll internally');
  await screenshot('mobile-list');
  await click('.learning-point-title');
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile treatment overflow');
  await screenshot('mobile-treatment');
  const readerUrl = new URL(url); readerUrl.searchParams.set('role', 'reader');
  await call('Page.navigate', { url: readerUrl.toString() });
  await wait('document.querySelectorAll(".learning-table tbody tr").length === 2');
  assert.equal(await evaluate('document.querySelector(".learning-status-action") === null'), true, 'Readers cannot edit status');
  await click('.learning-point-title');
  await wait('document.querySelector(".learning-current-review") !== null');
  assert.equal(await evaluate('document.querySelector("#lesson-status") === null'), true);
  assert.ok(await evaluate('document.querySelector(".learning-current-review > p").textContent.length > 0'), 'Readers see an access explanation');
  assert.ok(await evaluate('document.querySelector("#lesson-comment") !== null'), 'Readers retain individual comments');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ learningList: 'passed', treatmentValidation: 'passed', commentHistory: 'passed', closureAndCounter: 'passed', reportSeparation: 'passed', mobileLayout: 'passed', browserErrors: 0, output }));
} finally { socket.close(); await fetch(`${endpoint}/json/close/${target.id}`); }
