import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const endpoint = process.env.FYLKREN_BROWSER_CDP_URL ?? 'http://127.0.0.1:19224';
const url = process.env.FYLKREN_RISK_PREVIEW_URL ?? 'http://127.0.0.1:19226/test-fixtures/risk-workspace-preview.html';
const output = process.env.FYLKREN_RISK_EVIDENCE ?? 'output/risk-workspace';
const target = await (await fetch(`${endpoint}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl.replace('localhost:19224', new URL(endpoint).host));
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
let sequence = 0;
const pending = new Map(), errors = [];
socket.addEventListener('message', event => {
  const value = JSON.parse(event.data);
  if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.text);
  if (!value.id) return;
  const request = pending.get(value.id); pending.delete(value.id);
  if (value.error) request.reject(new Error(JSON.stringify(value.error))); else request.resolve(value.result);
});
function call(method, params = {}) { const id = ++sequence; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); }
async function evaluate(expression) { const value = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (value.exceptionDetails) throw new Error(value.exceptionDetails.text); return value.result.value; }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(expression) { for (let i = 0; i < 80; i++) { if (await evaluate(expression)) return; await pause(100); } throw new Error(`Timed out: ${expression}`); }
async function position(selector, scroll = true) { return evaluate(`(() => { const element=document.querySelector(${JSON.stringify(selector)}); if (${JSON.stringify(scroll)}) element.scrollIntoView({block:'center'}); const r=element.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`); }
async function click(selector) { const p = await position(selector); await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, button: 'left', clickCount: 1 }); await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...p, button: 'left', clickCount: 1 }); await pause(100); }
async function screenshot(name) { const shot = await call('Page.captureScreenshot', { format: 'png' }); await writeFile(`${output}/${name}.png`, Buffer.from(shot.data, 'base64')); }
try {
  await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1360, height: 1000, deviceScaleFactor: 1, mobile: false });
  await wait('document.querySelectorAll(".risk-register tbody tr").length === 2');
  await mkdir(output, { recursive: true });
  await screenshot('desktop-register');
  await click('.risk-register tbody tr:first-child .risk-row-number');
  await wait('document.querySelector(".risk-editor") !== null');
  await click('.risk-cell:nth-child(12)'); // Probability 3, impact 2.
  assert.deepEqual(await evaluate('[Number(document.querySelector("#risk-probability").value),Number(document.querySelector("#risk-impact").value)]'), [3, 2]);
  await click('.risk-editor fieldset:nth-of-type(3) legend button');
  await click('.risk-cell:nth-child(21)'); // Probability 1, impact 1.
  assert.deepEqual(await evaluate('[document.querySelector("#risk-residualProbability").value,document.querySelector("#risk-residualImpact").value]'), ['1', '1']);
  await evaluate('document.querySelector(".risk-matrix").scrollIntoView({block:"center"})');
  const from = await position('.risk-map-marker.before.selected circle', false);
  const to = await position('.risk-cell:nth-child(8)', false); // Probability 4, impact 3.
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...from, button: 'left', clickCount: 1 });
  for (let step = 1; step <= 5; step++) await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x + (to.x - from.x) * step / 5, y: from.y + (to.y - from.y) * step / 5, button: 'left', buttons: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...to, button: 'left', clickCount: 1 });
  await pause(100);
  assert.deepEqual(await evaluate('[Number(document.querySelector("#risk-probability").value),Number(document.querySelector("#risk-impact").value)]'), [4, 3]);
  assert.equal(await evaluate('document.querySelectorAll(".risk-connection").length'), 2);
  await screenshot('desktop-editor');
  await evaluate('document.querySelector(".risk-editor").requestSubmit()');
  await wait('document.querySelector(".risk-editor") === null');
  assert.equal(await evaluate('document.querySelector(".risk-register tbody tr:first-child td:nth-child(4)").textContent'), '4/3');
  assert.equal(await evaluate('document.querySelector(".risk-register tbody tr:first-child td:nth-child(7)").textContent'), '1/1');
  await click('.risk-register tbody tr:first-child .risk-row-number');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await pause(200);
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile document overflow');
  assert.ok(await evaluate('document.querySelector(".risk-register-scroll").scrollWidth > document.querySelector(".risk-register-scroll").clientWidth'), 'Mobile table should scroll within its own container');
  await screenshot('mobile-editor');
  assert.equal(await evaluate('window.testError ?? null'), null);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ riskMapClicks: 'passed', residualSelection: 'passed', markerDrag: 'passed', mockSaveReload: 'passed', mobileLayout: 'passed', browserErrors: 0, output }));
} finally { socket.close(); await fetch(`${endpoint}/json/close/${target.id}`); }
