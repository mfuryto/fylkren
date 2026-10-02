import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { assertClassificationOrder } from './classification-browser.mjs';
import { buildMultiPageReportHtml } from './classified-report-content.mjs';
import { createLocalLeader, signInLocalActor } from './local-actors.mjs';
import { verifyTaskDialogKeyboard } from './keyboard-browser.mjs';
import { writeReportPdf } from './report-pdf.mjs';
import { configureTaskSmtp, verifyTaskMail } from './smtp-browser.mjs';
import { verifyMultiPageClassifiedPdf } from './verify-classified-report-pdf.mjs';
import { verifyWorkloadPresentation } from './workload-browser.mjs';
import { addPrivateLearning, verifyPrivateLearning, verifyPrivateLearningPdf } from './learning-report-privacy.mjs';

const endpoint = process.env.FYLKREN_BROWSER_CDP_URL ?? 'http://127.0.0.1:19224';
const targetUrl = process.env.FYLKREN_BROWSER_TARGET_URL ?? 'http://web:8080/';
const enterpriseTransition = process.argv.includes('--enterprise'), taskFlow = process.argv.includes('--task-flow');
const smtpDelivery = process.argv.includes('--smtp');
const keyboardAccessibility = process.argv.includes('--keyboard');
const reportPdfPath = process.env.FYLKREN_BROWSER_REPORT_PDF ?? (process.argv.includes('--classified-pdf') ? 'output/pdf/e2e-01-classified-report.pdf' : undefined);
const licensePath = process.env.FYLKREN_BROWSER_LICENSE_PATH ?? '/test/license-upload-fixture.json';
assert.ok(!(enterpriseTransition && taskFlow), 'Choose either --enterprise or --task-flow');
assert.ok(!smtpDelivery || taskFlow, '--smtp requires --task-flow');
assert.ok(!keyboardAccessibility || taskFlow, '--keyboard requires --task-flow');
const target = await (await fetch(
  `${endpoint}/json/new?${encodeURIComponent(targetUrl)}`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl.replace('127.0.0.1:9222',
  new URL(endpoint).host));
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve);
  socket.addEventListener('error', reject);
});

let sequence = 0;
const pending = new Map();
const browserErrors = [];
socket.addEventListener('message', event => {
  const value = JSON.parse(event.data);
  if (!value.id) {
    if (value.method === 'Runtime.exceptionThrown')
      browserErrors.push(value.params.exceptionDetails?.text ?? 'Runtime exception');
    if (value.method === 'Log.entryAdded' && value.params.entry?.level === 'error')
      browserErrors.push(value.params.entry.text);
    return;
  }
  const waiter = pending.get(value.id);
  if (!waiter) return;
  pending.delete(value.id);
  if (value.error) waiter.reject(new Error(JSON.stringify(value.error)));
  else waiter.resolve(value.result);
});

function call(method, params = {}, sessionId) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function bodyText() { return evaluate('document.body.innerText'); }
async function waitFor(test, label) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await evaluate(test)) return;
    await pause(250);
  }
  throw new Error(`Timed out waiting for ${label}: ${await bodyText()}`);
}
async function navigate(hash) {
  await call('Page.navigate', { url: new URL(hash, targetUrl).href });
  await waitFor('document.readyState === "complete"', `${hash} document`);
  await pause(750);
}
async function setInput(selector, value) {
  await evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) throw new Error('Missing input: ' + ${JSON.stringify(selector)});
    const prototype = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
}
async function setSelect(selector, value) {
  await evaluate(`(() => {
    const select = document.querySelector(${JSON.stringify(selector)});
    if (!select) throw new Error('Missing select: ' + ${JSON.stringify(selector)});
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(select, ${JSON.stringify(value)});
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}
async function clickButton(label, root = 'document') {
  await evaluate(`(() => {
    const button = [...${root}.querySelectorAll('button')]
      .find(value => value.textContent.trim() === ${JSON.stringify(label)} ||
        [...value.querySelectorAll('span')]
          .some(span => span.textContent.trim() === ${JSON.stringify(label)}));
    if (!button) throw new Error('Missing button: ' + ${JSON.stringify(label)});
    button.click();
  })()`);
}
async function request(path, method = 'GET', body) {
  return evaluate(`(async () => {
    const method = ${JSON.stringify(method)};
    const headers = {};
    if (method !== 'GET') {
      const tokenResponse = await fetch('/api/security/antiforgery');
      const token = await tokenResponse.json();
      headers['X-Fylkren-CSRF'] = token.token;
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(${JSON.stringify(path)}, {
      method, headers, credentials: 'same-origin',
      body: ${body === undefined ? 'undefined' : JSON.stringify(JSON.stringify(body))},
    });
    const text = await response.text();
    let value = text;
    try { value = text ? JSON.parse(text) : null; } catch {}
    return { status: response.status, body: value };
  })()`);
}
async function requestExpectingHttpError(path, method, body, expectedStatus) {
  const firstNewError = browserErrors.length;
  const response = await request(path, method, body);
  assert.equal(response.status, expectedStatus, JSON.stringify(response.body));
  await pause(250);
  const expectedMessage = `Failed to load resource: the server responded with a status of ${expectedStatus} (Bad Request)`;
  const errorIndex = browserErrors.findIndex((message, index) =>
    index >= firstNewError && message === expectedMessage);
  assert.notEqual(errorIndex, -1, `Expected browser HTTP error was not observed: ${JSON.stringify(browserErrors.slice(firstNewError))}`);
  browserErrors.splice(errorIndex, 1);
  return response;
}
async function setRichText(root, html) {
  await evaluate(`(() => {
    const editor = ${root}.querySelector('.workflow-document-editor[contenteditable="true"]');
    if (!editor) throw new Error('Missing rich-text editor');
    editor.focus();
    editor.innerHTML = ${JSON.stringify(html)};
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  })()`);
}
async function assertNoOverflow(label) {
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true,
    `${label} has horizontal document overflow`);
}
async function waitForSummary(label, expected, scope = '.summary-card') {
  await waitFor(`(() => {
    const card = [...document.querySelectorAll(${JSON.stringify(scope)})]
      .find(value => value.querySelector('span')?.textContent.trim().includes(${JSON.stringify(label)}));
    return card?.querySelector('strong')?.textContent.trim() === ${JSON.stringify(String(expected))};
  })()`, `${label} summary = ${expected}`);
}
async function assertCommunityBoundary() {
  await navigate('/#/license');
  await waitFor('document.body.innerText.includes("Community features without Enterprise add-ons.")',
    'Community license page');
  const licenseText = await bodyText();
  assert.match(licenseText, /the same software for Community and Enterprise/);
  assert.match(licenseText, /Import signed license file/);

  await navigate('/#/federation');
  await waitFor('document.body.innerText.includes("Requires an Enterprise license")',
    'Community federation boundary');
  const federationText = await bodyText();
  assert.match(federationText, /The entire feature remains visible below/);
  assert.ok(federationText.includes('Add peer'));
  assert.ok(federationText.includes('Create federation key'));
}
async function importEnterpriseLicense() {
  await navigate('/#/license');
  await call('DOM.enable');
  const { root } = await call('DOM.getDocument', { depth: -1 });
  const { nodeId } = await call('DOM.querySelector', {
    nodeId: root.nodeId, selector: '#enterprise-license-file',
  });
  assert.notEqual(nodeId, 0, 'Enterprise license file input was not rendered');
  await call('DOM.setFileInputFiles', { nodeId, files: [licensePath] });
  await waitFor(`document.body.innerText.includes("The Enterprise license was activated without reinstalling.") &&
    document.body.innerText.includes("Enterprise") && document.body.innerText.includes("Valid")`,
  'Enterprise license activation');
}
async function removeEnterpriseLicense() {
  await waitFor(`[...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Remove license')`, 'loaded license removal control');
  await evaluate(`[...document.querySelectorAll('button')]
    .find(button => button.textContent.trim() === 'Remove license').click()`);
  await waitFor(`document.querySelector('[role="dialog"]') !== null`, 'license removal dialog');
  await evaluate(`[...document.querySelectorAll('[role="dialog"] button')]
    .find(button => button.textContent.trim() === 'Remove license').click()`);
  await waitFor(`document.body.innerText.includes("Enterprise entitlements are disabled") &&
    document.body.innerText.includes("Community features without Enterprise add-ons.")`,
  'Community downgrade');
}
async function runTopLevelTaskFlow(suffix, platformCredentials) {
  const session = await request('/api/session');
  assert.equal(session.status, 200);
  const classificationDefinitions = [
    ['PUBLIC', 'PUB'], ['INTERNAL', 'INT'], ['CONFIDENTIAL', 'CONF'],
    ['SENSITIVE', 'SENS'], ['SECRET', 'SECRET'],
  ];
  for (const [index, [name, abbreviation]] of classificationDefinitions.entries()) {
    const created = await request('/api/platform/classifications/', 'POST', {
      name, abbreviation, sortOrder: (index + 1) * 10, isActive: true,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
  }
  const classificationSettings = await request('/api/platform/classifications/settings', 'PUT', {
    enabled: true,
  });
  assert.equal(classificationSettings.status, 204, JSON.stringify(classificationSettings.body));
  const sites = await request('/api/sites/');
  assert.equal(sites.status, 200);
  const site = sites.body.find(value => value.name === 'Synthetic Browser Site');
  assert.ok(site?.id, `Created site not found: ${JSON.stringify(sites.body)}`);

  const manager = await request(`/api/sites/${site.id}/site-managers`, 'POST', {
    personId: session.body.personId,
  });
  assert.equal(manager.status, 201, JSON.stringify(manager.body));
  const leadership = await request(`/api/sites/${site.id}/organization-units`, 'POST', {
    name: 'Synthetic Leadership', parentId: null, isTemporary: false,
    worksAtParentLevel: false, isSiteLeadership: true,
  });
  assert.equal(leadership.status, 201, JSON.stringify(leadership.body));
  const access = await request(`/api/sites/${site.id}/access/`);
  assert.equal(access.status, 200, JSON.stringify(access.body));
  const leaderRole = access.body.roles.find(value =>
    value.organizationUnitId === leadership.body.id && value.isLeader);
  assert.ok(leaderRole?.id, 'Default leadership role missing');

  const author = await createLocalLeader({ request, siteId: site.id, roleId: leaderRole.id,
    suffix, key: 'author', displayName: 'Synthetic Report Author', siteManager: true });
  const approver = await createLocalLeader({ request, siteId: site.id, roleId: leaderRole.id,
    suffix, key: 'approver', displayName: 'Synthetic Report Approver' });
  const notificationSettings = await request(`/api/site-notifications/sites/${site.id}`, 'PUT', {
    newWorkItems: true, workItemChanges: true, decisionsRequired: true,
    childWorkCompleted: true, planningCompleted: true, executionCompleted: true,
  });
  assert.equal(notificationSettings.status, 204, JSON.stringify(notificationSettings.body));
  await configureTaskSmtp({ request, requestExpectingHttpError, enabled: smtpDelivery });
  await signInLocalActor({ request, navigate, waitFor, setInput, evaluate, actor: author });

  const title = 'Synthetic direct execution task {{7*7}} {{recipientName}}';
  assert.equal(await evaluate(`(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(${JSON.stringify(String.raw`.probe { background-image: u\72l("https://example.invalid/probe"); }`)});
    return sheet.cssRules[0].style.backgroundImage.includes('url(');
  })()`), true, 'CSS escape proof must be interpreted as url() by the real browser parser');
  const injectionMarker = 'fylkren-browser-xss-marker';
  const description = `Complete the synthetic top-level browser lifecycle. <img data-${injectionMarker} src=x onerror="globalThis.__fylkrenXss=1"><script>globalThis.__fylkrenXss=2</script>\n&lt;img src=x onerror=synthetic()&gt;\n%3Cscript%3Esynthetic()%3C/script%3E\n%253Cscript%253Esynthetic()%253C/script%253E\n[link](javascript:synthetic())\n{{constructor.constructor("synthetic()")()}}`;
  const recommendation = 'Send directly to the standard execution workflow.';
  const referenceUrl = 'https://example.invalid/source-document';
  const dueDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  await navigate('/#/tasks');
  await waitFor('document.body.innerText.includes("New task")', 'Tasks page');
  const keyboardEvidence = keyboardAccessibility
    ? await verifyTaskDialogKeyboard({ call, evaluate, waitFor })
    : (await clickButton('New task'), {});
  await waitFor('document.querySelector("#task-title") !== null', 'task registration dialog');
  await setInput('#task-title', title);
  await setInput('#task-description', description);
  await setInput('#task-recommendation', recommendation);
  await setInput('#task-reference', referenceUrl);
  await setInput('#task-due', dueDate);
  await evaluate('document.querySelector("#task-title").closest("form").requestSubmit()');
  await waitFor(`document.querySelector("#task-title") === null &&
    document.body.innerText.includes(${JSON.stringify(title)})`, 'registered task');
  await pause(500);
  assert.equal((await bodyText()).includes('The task does not exist, or you do not have access to it.'), false,
    'Successful task registration left a stale missing-task error');
  assert.match(await evaluate('window.location.hash'), /[?&]item=[0-9a-f-]{36}/,
    'Successful task registration did not focus the returned task ID');
  await navigate('/#/');
  await waitForSummary('Requires action', 1);
  await waitForSummary('Active', 1);
  await verifyWorkloadPresentation({ navigate, waitFor, request, evaluate, assertNoOverflow, siteId: site.id, expected: 1 });
  await navigate('/#/tasks');
  await waitFor(`document.body.innerText.includes(${JSON.stringify(title)})`, 'registered task queue');
  if (!(await bodyText()).includes('Take under review')) await clickButton(title);
  await waitFor('document.body.innerText.includes("Take under review")', 'registered task actions');
  await evaluate(`(() => {
    const summary = [...document.querySelectorAll('summary')]
      .find(value => value.textContent.includes('Description'));
    if (!summary) throw new Error('Missing task description disclosure');
    if (!summary.closest('details')?.open) summary.click();
  })()`);
  await waitFor(`document.body.innerText.includes(${JSON.stringify(`<img data-${injectionMarker}`)})`,
    'stored active-content payload');
  assert.equal(await evaluate(`(() => document.body.innerText.includes(${JSON.stringify(`<img data-${injectionMarker}`)}) &&
    !document.querySelector(${JSON.stringify(`[data-${injectionMarker}]`)}) &&
    ![...document.scripts].some(value => value.textContent.includes(${JSON.stringify('__fylkrenXss')})) &&
    globalThis.__fylkrenXss === undefined)()`), true,
  'Stored active-content payload was not rendered as inert text');
  for (const literal of ['&lt;img', '%3Cscript%3E', '%253Cscript%253E', '[link](javascript:', '{{constructor.constructor']) {
    assert.ok((await bodyText()).includes(literal), 'Stored encoded/expression input was decoded or lost');
  }
  await clickButton('Take under review');
  await waitFor('document.querySelector("#review-priority") !== null', 'review dialog');
  assert.match(await bodyText(), new RegExp(recommendation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await setSelect('#review-priority', 'high');
  await evaluate('document.querySelector("#review-priority").closest("form").requestSubmit()');
  await waitFor(`document.body.innerText.includes("Under review") &&
    document.body.innerText.includes("Send to execution")`, 'reviewed task');
  assert.ok(!(await bodyText()).includes(recommendation),
    'Recommendation remained visible after initial assessment');
  await clickButton('Send to execution');
  await waitFor('document.body.innerText.includes("Execution")', 'task sent to execution');

  await navigate('/#/execution');
  await waitFor(`document.body.innerText.includes(${JSON.stringify(title)})`, 'execution queue');
  await clickButton(title);
  await clickButton('Claim responsibility for the task');
  await waitFor('document.body.innerText.includes("Select execution workflow")', 'claimed execution');
  const definition = await evaluate(`(() => {
    const select = [...document.querySelectorAll('select')]
      .find(value => value.closest('.planning-result'));
    return select?.options[1]?.value ?? '';
  })()`);
  assert.ok(definition, 'No execution workflow was available');
  await evaluate(`(() => {
    const select = [...document.querySelectorAll('select')]
      .find(value => value.closest('.planning-result'));
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(select, ${JSON.stringify(definition)});
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await clickButton('Start workflow');
  await waitFor('document.body.innerText.includes("Step 1 of")', 'execution workflow');
  for (let step = 1; step <= 10; step++) {
    await setRichText('document', `<h1>Execution step ${step}</h1><ul><li>Completed in Chromium</li></ul>`);
    if (step === 1) {
      assert.equal(await evaluate(`(() => {
        const editor = document.querySelector('.workflow-document-editor');
        const plain = 'SYNTHETIC_PASTE_LITERAL &lt;img&gt; %253Cscript%253E';
        const clipboard = new DataTransfer(); clipboard.setData('text/plain', plain);
        clipboard.setData('text/html', '<img data-asvs-paste src=x onerror="globalThis.__fylkrenXss=3">');
        editor.focus(); editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true }));
        const dropped = new DataTransfer(); dropped.setData('text/plain', 'SYNTHETIC_DROP_LITERAL');
        dropped.setData('text/html', '<script>globalThis.__fylkrenXss=4</script>');
        editor.dispatchEvent(new DragEvent('drop', { dataTransfer: dropped, bubbles: true, cancelable: true }));
        return editor.textContent.includes(plain) && editor.textContent.includes('SYNTHETIC_DROP_LITERAL') &&
          !editor.querySelector('img, script') && globalThis.__fylkrenXss === undefined;
      })()`), true, 'Rich-text paste/drop must insert only literal plain text');
    }
    const lastStep = await evaluate(`[...document.querySelectorAll('button')]
      .some(button => button.textContent.trim() === 'Send for review')`);
    await clickButton(lastStep ? 'Send for review' : 'Next step');
    if (lastStep) break;
    await waitFor(`document.body.innerText.includes("Step ${step + 1} of")`,
      `execution step ${step + 1}`);
    if (step === 10) throw new Error('Execution workflow exceeded ten steps');
  }

  await navigate('/#/tasks');
  await waitFor(`document.body.innerText.includes(${JSON.stringify(title)})`, 'task review queue');
  if (!(await bodyText()).includes('Write final report')) await clickButton(title);
  await waitFor('document.body.innerText.includes("Write final report")', 'final report action');
  await clickButton('Write final report');
  await waitFor('document.querySelector("[role=dialog] .workflow-document-editor") !== null',
    'final report dialog');
  await setRichText('document.querySelector("[role=dialog]")',
    reportPdfPath ? buildMultiPageReportHtml()
      : '<h1>Summary</h1><p>Task completed.</p><h1>Conclusion</h1><p>Accepted.</p>');
  await assertClassificationOrder(evaluate);
  await setSelect('#final-report-classification', 'CONF');
  await addPrivateLearning({ evaluate, setInput, waitFor });
  await clickButton('Save final report', 'document.querySelector("[role=dialog]")');
  await waitFor('document.body.innerText.includes("Approve final report")',
    'saved final report');
  await signInLocalActor({ request, navigate, waitFor, setInput, evaluate, actor: approver });
  await navigate('/#/tasks');
  await waitFor(`document.body.innerText.includes(${JSON.stringify(title)})`, 'approver task queue');
  if (!(await bodyText()).includes('Approve final report')) await clickButton(title);
  await waitFor('document.body.innerText.includes("Approve final report")', 'separate approval action');
  await clickButton('Approve final report');
  await waitFor(`[...document.querySelectorAll('button')]
    .some(button => button.textContent.trim() === 'Complete')`, 'approved final report');
  await clickButton('Complete');

  let completed;
  for (let attempt = 0; attempt < 60; attempt++) {
    const overview = await request(`/api/work/sites/${site.id}/items/overview`);
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    completed = overview.body.find(value => value.title === title);
    if (completed?.status === 'completed') break;
    await pause(250);
  }
  assert.equal(completed?.status, 'completed', JSON.stringify(completed));
  assert.equal(completed?.priority, 'high', JSON.stringify(completed));
  assert.equal(completed?.description, description, JSON.stringify(completed));
  assert.equal(completed?.referenceUrl, referenceUrl, JSON.stringify(completed));
  assert.equal(completed?.dueAt?.slice(0, 10), dueDate, JSON.stringify(completed));
  assert.equal(completed?.finalReportClassification, 'CONF', JSON.stringify(completed));
  assert.equal(completed?.finalReportWrittenBy, author.displayName, JSON.stringify(completed));
  assert.equal(completed?.finalReportApprovedBy, approver.displayName, JSON.stringify(completed));
  assert.ok(completed?.finalReportApprovedAt, 'Approved final report missing');
  await signInLocalActor({ request, navigate, waitFor, setInput, evaluate, actor: author });
  await verifyPrivateLearning({ request, siteId: site.id, itemId: completed.id, completed });

  await navigate('/#/');
  await waitForSummary('Requires action', 0);
  await waitForSummary('Active', 0);
  await waitForSummary('Registered and received work items', 1, '.overview-stat-card');
  await waitForSummary('Completed work items', 1, '.overview-stat-card');
  await verifyWorkloadPresentation({ navigate, waitFor, request, evaluate, assertNoOverflow, siteId: site.id, expected: 0 });

  await navigate('/#/reports');
  await waitFor(`document.body.innerText.includes(${JSON.stringify(title)}) &&
    [...document.querySelectorAll('select option')].some(option => option.textContent.includes('(1)'))`, 'report archive');
  await clickButton(title);
  await waitFor(`document.body.innerText.includes("Task completed.") &&
    document.body.innerText.includes("CONFIDENTIAL") &&
    document.body.innerText.includes(${JSON.stringify(author.displayName)}) &&
    document.body.innerText.includes(${JSON.stringify(approver.displayName)}) &&
    document.body.innerText.includes("Export as PDF")`, 'classified archived report viewer');
  if (reportPdfPath) {
    await writeReportPdf({ call, evaluate, outputPath: reportPdfPath, targetUrl });
    verifyMultiPageClassifiedPdf(reportPdfPath);
    verifyPrivateLearningPdf(reportPdfPath);
  }
  await assertNoOverflow('Completed report archive');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  await assertNoOverflow('Mobile completed report archive');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  });

  await navigate('/#/audit');
  await waitFor(`document.body.innerText.includes("Traceable events in Sites you administer") &&
    document.body.innerText.includes("Work registered") &&
    document.body.innerText.includes("Execution submitted for review") &&
    document.body.innerText.includes("Final report approved")`, 'site audit chain');

  const leaderLogout = await request('/api/session', 'DELETE');
  assert.equal(leaderLogout.status, 204, JSON.stringify(leaderLogout.body));
  await navigate('/');
  await waitFor('document.body.innerText.includes("Sign in")', 'Platform Manager login');
  await setInput('#username', platformCredentials.username);
  await setInput('#password', platformCredentials.password);
  await evaluate('document.querySelector("#password").closest("form").requestSubmit()');
  await waitFor('document.body.innerText.includes("Platform")', 'Platform Manager shell');
  const platformSession = await request('/api/session');
  assert.equal(platformSession.status, 200, JSON.stringify(platformSession.body));
  assert.equal(platformSession.body.isPlatformManager, true, JSON.stringify(platformSession.body));

  return { ...keyboardEvidence,
    ...(await verifyTaskMail({ request, pause, title, enabled: smtpDelivery })) };
}

try {
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Log.enable');
  await call('Network.enable');
  const browserVersion = await call('Browser.getVersion');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
  });
  await navigate('/');
  const configurationResponse = await evaluate(
    `fetch('/api/configuration/public', { cache: 'no-store' }).then(async response =>
      ({ origin: location.origin, status: response.status, text: await response.text() }))`);
  assert.equal(configurationResponse.status, 200,
    `Public configuration failed: ${JSON.stringify(configurationResponse)}`);
  const publicConfiguration = JSON.parse(configurationResponse.text);
  assert.equal(publicConfiguration.setupRequired, true,
    `Fresh browser fixture did not require setup: ${JSON.stringify(publicConfiguration)}`);
  await waitFor('document.body.innerText.includes("First-run setup")', 'setup page');
  const setupText = await bodyText();
  assert.match(setupText, /Create the installation's first Platform Manager/);
  await assertNoOverflow('Setup page');

  const suffix = randomBytes(6).toString('hex');
  const username = `browser-${suffix}`;
  const password = `V9!${randomBytes(24).toString('base64url')}#q`;
  await setInput('#setup-display-name', 'Synthetic Browser Manager');
  await setInput('#setup-email', `${username}@example.invalid`);
  await setInput('#setup-username', username);
  await setInput('#setup-password', password);
  await setInput('#setup-confirm-password', password);
  await evaluate('document.querySelector("#setup-password").closest("form").requestSubmit()');
  await waitFor('document.body.innerText.includes("Community") && document.body.innerText.includes("Platform")',
    'authenticated shell');
  await assertNoOverflow('Authenticated shell');

  await navigate('/#/sites');
  await waitFor('document.body.innerText.includes("No Sites have been created")', 'empty Sites page');
  assert.match(await bodyText(), /Community: 0 of 3 active Sites/);
  await evaluate(`[...document.querySelectorAll('button')]
    .find(button => button.textContent.trim() === 'New Site').click()`);
  await waitFor('document.querySelector("#new-site-name") !== null', 'new-site dialog');
  await setInput('#new-site-name', 'Synthetic Browser Site');
  await evaluate('document.querySelector("#new-site-name").closest("form").requestSubmit()');
  await waitFor(`document.body.innerText.includes("Synthetic Browser Site") &&
    document.body.innerText.includes("Community: 1 of 3 active Sites")`, 'created site');

  const taskEvidence = taskFlow
    ? await runTopLevelTaskFlow(suffix, { username, password }) : {};
  if (!taskFlow) await assertCommunityBoundary();

  if (enterpriseTransition) {
    await importEnterpriseLicense();

    await navigate('/#/federation');
    await waitFor(`document.body.innerText.includes("Add peer") &&
      document.body.innerText.includes("Create federation key")`,
    'Enterprise federation controls');
    await assertNoOverflow('Enterprise federation page');

    await navigate('/#/api');
    await waitFor('document.body.innerText.includes("New API client")',
      'Enterprise API controls');

    await navigate('/#/license');
    await removeEnterpriseLicense();

    await navigate('/#/sites');
    await waitFor(`document.body.innerText.includes("Synthetic Browser Site") &&
      document.body.innerText.includes("Community: 1 of 3 active Sites")`,
    'site preserved after Community downgrade');
    await assertCommunityBoundary();
  }

  if (!taskFlow) {
    await call('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
    });
    await navigate('/#/license');
    await waitFor('document.body.innerText.includes("Import signed license file")',
      'mobile license page');
    await assertNoOverflow('Mobile license page');
  }
  assert.deepEqual(browserErrors, [], `Browser errors: ${JSON.stringify(browserErrors)}`);

  process.stdout.write(`${JSON.stringify({
    ...(taskFlow
      ? { topLevelTaskBrowserFlow: 'passed', taskRegistration: true,
        leaderAssessment: true, directExecution: true, finalReport: true,
        reportArchive: true, overviewCounts: true, siteAudit: true,
        notificationQueue: true, classifiedReport: true, workloadPresentation: true,
        separateReportApprover: true, storedContentInjection: true, pdfOutput: Boolean(reportPdfPath),
        multiPageClassifiedReport: Boolean(reportPdfPath), ...taskEvidence }
      : enterpriseTransition
      ? { enterpriseBrowserTransition: 'passed', licenseFileInput: true,
        enterpriseControls: true, communityDowngrade: true, sitePreserved: true }
      : { communityBrowserSmoke: 'passed' }),
    chromium: browserVersion.product,
    firstRunSetup: true, authenticatedShell: true, communityEdition: true,
    siteCreation: true,
    ...(!taskFlow && { licensePage: true, federationReadOnlyBoundary: true }),
    desktopOverflow: false, mobileOverflow: false, browserErrors: 0 })}\n`);
} finally {
  socket.close();
}
