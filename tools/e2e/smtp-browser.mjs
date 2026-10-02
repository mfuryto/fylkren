import assert from 'node:assert/strict';

const smtpHost = process.env.FYLKREN_BROWSER_SMTP_HOST ?? 'smtp-sink';
const inspectUrl = process.env.FYLKREN_BROWSER_SMTP_INSPECT_URL ??
  'http://127.0.0.1:19225/messages';

export async function configureTaskSmtp({ request, requestExpectingHttpError, enabled }) {
  if (!enabled) return;
  await requestExpectingHttpError('/api/platform/smtp/', 'PUT', {
    enabled: true, host: smtpHost, port: 2525, security: 'none',
    username: null, password: null, clearPassword: true,
    fromAddress: 'fylkren-browser@example.invalid',
    fromName: 'Synthetic Fylkren\r\nBcc: injected@example.invalid',
  }, 400);
  const configured = await request('/api/platform/smtp/', 'PUT', {
    enabled: true, host: smtpHost, port: 2525, security: 'none',
    username: null, password: null, clearPassword: true,
    fromAddress: 'fylkren-browser@example.invalid', fromName: 'Synthetic Fylkren',
  });
  assert.equal(configured.status, 204, JSON.stringify(configured.body));
  const templates = await request('/api/platform/smtp/templates');
  assert.equal(templates.status, 200);
  const template = templates.body.find(value => value.key === 'new-work-item');
  assert.ok(template);
  for (const update of [
    { subject: '{{unknownSyntheticField}}', body: template.body },
    { subject: 'Synthetic\r\nBcc: injected@example.invalid', body: template.body },
    { subject: 'Synthetic\u0000header', body: template.body },
    { subject: 'a'.repeat(201), body: template.body },
    { subject: template.subject, body: 'a'.repeat(10001) },
  ]) await requestExpectingHttpError('/api/platform/smtp/templates/new-work-item', 'PUT', update, 400);
  const unchanged = await request('/api/platform/smtp/templates');
  assert.deepEqual(unchanged.body.find(value => value.key === template.key), template);
  const rendered = await request('/api/platform/smtp/templates/new-work-item', 'PUT', {
    subject: 'SYNTHETIC_TEMPLATE {{title}} {{7*7}}',
    body: `${template.body}\nSYNTHETIC_TEMPLATE_EXPRESSION {{7*7}} {{constructor.constructor("synthetic()")()}}\nSYNTHETIC_ENCODED_TEXT %253Cscript%253E &lt;script&gt;\n.\nSYNTHETIC_AFTER_DOT`,
  });
  assert.equal(rendered.status, 204);
}

export async function verifyTaskMail({ request, pause, title, enabled }) {
  let deliveries;
  let taskDeliveries = [];
  let retryObserved = false;
  const attempts = enabled ? 120 : 20;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const result = await request('/api/platform/smtp/deliveries?pageSize=100');
    assert.equal(result.status, 200, JSON.stringify(result.body));
    deliveries = result.body;
    taskDeliveries = deliveries.items.filter(value => value.workItemTitle === title);
    retryObserved ||= taskDeliveries.some(value => value.attempts >= 1 && value.status === 'pending');
    if (!enabled && taskDeliveries.length > 0) break;
    if (enabled && taskDeliveries.length > 0 && deliveries.projectionBacklog === 0 &&
        taskDeliveries.every(value => value.status === 'sent') &&
        taskDeliveries.some(value => value.attempts >= 1)) break;
    await pause(enabled ? 1_000 : 250);
  }
  assert.ok(taskDeliveries.length > 0, `No task notification: ${JSON.stringify(deliveries)}`);
  if (!enabled) {
    assert.ok(taskDeliveries.every(value => value.status === 'pending'), JSON.stringify(taskDeliveries));
    assert.equal(deliveries.transportEnabled, false);
    return {};
  }

  assert.equal(deliveries.transportEnabled, true);
  assert.equal(deliveries.projectionBacklog, 0);
  assert.ok(taskDeliveries.every(value => value.status === 'sent' && value.sentAt),
    JSON.stringify(taskDeliveries));
  const retried = taskDeliveries.find(value => value.attempts >= 1);
  assert.ok(retried, `No retried task delivery: ${JSON.stringify(taskDeliveries)}`);
  assert.equal(retried.lastError, null);
  assert.equal(retryObserved, true, 'Pending retry state was not observed');

  const response = await fetch(inspectUrl);
  assert.equal(response.status, 200, 'Synthetic mailbox could not be inspected');
  const mailbox = await response.json();
  assert.equal(mailbox.rejected, 1, JSON.stringify(mailbox));
  const received = mailbox.messages.filter(value =>
    value.subject.includes(title) || value.body.includes(title));
  assert.ok(received.length > 0, `Task message missing from mailbox: ${JSON.stringify(mailbox)}`);
  assert.ok(received.every(value => value.recipient.endsWith('@example.invalid')));
  assert.ok(received.some(value => value.body.includes(title) && value.body.includes('/#/tasks')),
    'Task message body did not contain its title and task link');
  const templateMessage = received.find(value => value.body.includes('SYNTHETIC_TEMPLATE_EXPRESSION'));
  assert.ok(templateMessage, 'Custom template did not reach the mailbox');
  for (const literal of ['{{7*7}}', '{{recipientName}}', '{{constructor.constructor("synthetic()")()}}', '%253Cscript%253E', '&lt;script&gt;', 'SYNTHETIC_AFTER_DOT']) {
    assert.ok(templateMessage.body.includes(literal), `Template data was interpreted or lost: ${literal}`);
  }
  assert.ok(received.every(value => !/^Bcc:/mi.test(value.headers) && (value.headers.match(/^Subject:/gmi) ?? []).length === 1),
    'Synthetic message acquired injected or duplicate headers');
  const rejected = mailbox.attempts.find(value => !value.accepted &&
    (value.subject.includes(title) || value.body.includes(title)));
  assert.ok(rejected, `Task message did not exercise transient failure: ${JSON.stringify(mailbox)}`);
  assert.ok(received.some(value => value.recipient === rejected.recipient),
    'Retried message was not received by the originally rejected mailbox');
  return { smtpHandoff: true, smtpRetry: true, mailboxReceipt: true,
    smtpHeaderInjectionRejected: true, templateExpressionsLiteral: true,
    templateValuesNotRecursivelyExpanded: true, templateRejectedUpdatesUnchanged: true, smtpDotContentPreserved: true };
}
