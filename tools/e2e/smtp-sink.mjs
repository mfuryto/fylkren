import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';

const [host, portText = '2525', inspectPortText = '2526', inspectHost = '127.0.0.1'] = process.argv.slice(2);
assert.ok(host, 'Usage: node tools/e2e/smtp-sink.mjs <Docker bridge gateway> [SMTP port] [inspection port]');
const port = Number(portText);
const inspectPort = Number(inspectPortText);
let transientFailures = Number(process.env.FYLKREN_SMTP_TRANSIENT_FAILURES ?? '0');
assert.ok(Number.isInteger(port) && port > 0 && port < 65536);
assert.ok(Number.isInteger(inspectPort) && inspectPort > 0 && inspectPort < 65536);
assert.ok(Number.isInteger(transientFailures) && transientFailures >= 0);

const messages = [];
const attempts = [];

function inspectMessage(content, recipient) {
  const normalized = content.replace(/\r?\n[ \t]+/g, ' ');
  const separator = normalized.search(/\r?\n\r?\n/);
  const headers = separator >= 0 ? normalized.slice(0, separator) : normalized;
  const encodedBody = separator >= 0 ? normalized.slice(separator).replace(/^\r?\n\r?\n/, '') : '';
  const transferEncoding = headers.match(/^Content-Transfer-Encoding:\s*(.+)$/mi)?.[1].trim().toLowerCase();
  const body = transferEncoding === 'base64'
    ? Buffer.from(encodedBody.replace(/\s/g, ''), 'base64').toString('utf8')
    : encodedBody;
  return {
    recipient,
    bytes: Buffer.byteLength(content),
    subject: headers.match(/^Subject:\s*(.+)$/mi)?.[1].trim() ?? '',
    body,
  };
}

const smtp = net.createServer(socket => {
  let buffer = '';
  let recipient = '';
  let data = '';
  let readingData = false;
  socket.setEncoding('utf8');
  socket.setTimeout(10_000, () => socket.destroy());
  socket.write('220 synthetic-e2e ESMTP\r\n');
  socket.on('data', chunk => {
    buffer += chunk;
    if (buffer.length > 1_000_000) return socket.destroy();
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end).replace(/\r$/, '');
      buffer = buffer.slice(end + 1);
      if (readingData) {
        if (line === '.') {
          const message = inspectMessage(data, recipient);
          readingData = false;
          data = '';
          if (transientFailures > 0) {
            transientFailures--;
            attempts.push({ ...message, accepted: false });
            socket.write('451 4.3.0 synthetic transient failure\r\n');
          } else {
            attempts.push({ ...message, accepted: true });
            messages.push(message);
            socket.write('250 2.0.0 queued\r\n');
          }
        } else {
          data += `${line}\n`;
        }
        continue;
      }
      const command = line.split(' ', 1)[0].toUpperCase();
      if (command === 'EHLO' || command === 'HELO') socket.write('250 synthetic-e2e\r\n');
      else if (command === 'MAIL') socket.write('250 2.1.0 sender accepted\r\n');
      else if (command === 'RCPT') {
        recipient = line.match(/^RCPT TO:\s*<?([^>\s]+)>?/i)?.[1] ?? '';
        if (!recipient.endsWith('@example.invalid')) socket.write('550 5.7.1 synthetic recipients only\r\n');
        else socket.write('250 2.1.5 recipient accepted\r\n');
      } else if (command === 'DATA') {
        if (!recipient.endsWith('@example.invalid')) socket.write('503 5.5.1 recipient required\r\n');
        else { readingData = true; socket.write('354 end with <CRLF>.<CRLF>\r\n'); }
      } else if (command === 'RSET') { recipient = ''; data = ''; socket.write('250 2.0.0 reset\r\n'); }
      else if (command === 'QUIT') { socket.end('221 2.0.0 bye\r\n'); }
      else if (command === 'NOOP') socket.write('250 2.0.0 ok\r\n');
      else socket.write('502 5.5.1 unsupported\r\n');
    }
  });
});

const inspect = http.createServer((request, response) => {
  if (request.method !== 'GET' || request.url !== '/messages') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify({ count: messages.length,
    rejected: attempts.filter(value => !value.accepted).length, messages, attempts }));
});

await new Promise((resolve, reject) => smtp.listen(port, host, error => error ? reject(error) : resolve()));
await new Promise((resolve, reject) => inspect.listen(inspectPort, inspectHost, error => error ? reject(error) : resolve()));
process.stdout.write(`Synthetic SMTP sink ready on ${host}:${port}; inspection on ${inspectHost}:${inspectPort}\n`);
