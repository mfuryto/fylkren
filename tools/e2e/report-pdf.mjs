import { writeFileSync } from 'node:fs';

export async function writeReportPdf({ call, evaluate, outputPath, targetUrl }) {
  const html = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')]
      .find(value => value.textContent.trim() === 'Export as PDF');
    if (!button) throw new Error('Missing PDF export button');
    button.click();
    const frame = document.querySelector('iframe[data-report-print-frame]');
    if (!frame?.srcdoc) throw new Error('Missing report print document');
    return frame.srcdoc;
  })()`);
  const target = await call('Target.createTarget', { url: targetUrl });
  const attached = await call('Target.attachToTarget', {
    targetId: target.targetId, flatten: true,
  });
  const session = attached.sessionId;
  try {
    await call('Page.enable', {}, session);
    await call('Runtime.enable', {}, session);
    await call('Emulation.setDeviceMetricsOverride', {
      width: 658, height: 971, deviceScaleFactor: 1, mobile: false,
    }, session);
    const tree = await call('Page.getFrameTree', {}, session);
    await call('Page.setDocumentContent', {
      frameId: tree.frameTree.frame.id, html,
    }, session);
    await call('Runtime.evaluate', {
      expression: `new Promise((resolve, reject) => {
        let attempts = 0;
        const check = () => {
          if (getComputedStyle(document.querySelector('.report-metadata')).display === 'grid')
            return resolve(true);
          if (++attempts === 100) return reject(new Error('Report stylesheet did not load'));
          setTimeout(check, 25);
        };
        check();
      })`,
      awaitPromise: true,
    }, session);
    await call('Runtime.evaluate', {
      expression: 'document.fonts.ready',
      awaitPromise: true,
    }, session);
    const result = await call('Page.printToPDF', {
      printBackground: true, preferCSSPageSize: true,
    }, session);
    if (!result.data) throw new Error('Chromium returned no PDF data');
    writeFileSync(outputPath, Buffer.from(result.data, 'base64'));
  } finally {
    await call('Target.closeTarget', { targetId: target.targetId });
  }
}
