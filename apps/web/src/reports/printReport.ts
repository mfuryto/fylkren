export function reportPrintPageStyles(classification: string) {
  const marking = classification
    .replace(/\\/g, "\\\\")
    .replace(/\"/g, '\\"')
    .replace(/\r\n|\r|\n/g, "\\A ")
    .replace(/</g, "\\3C ");
  return `@page {
    size: A4;
    margin: 20mm 18mm;
    @top-right { content: "${marking}"; color: #c42b1c; font-size: 8pt; font-weight: 700; }
    @bottom-right { content: "${marking}"; color: #c42b1c; font-size: 8pt; font-weight: 700; }
  }`;
}

export function printReportDocument() {
  const report = document.getElementById("printable-report");
  if (!report) return;

  const reportClone = report.cloneNode(true) as HTMLElement;
  const classification = reportClone.querySelector<HTMLElement>(".report-page-mark-header")?.textContent?.trim() ?? "";
  reportClone.querySelectorAll(".report-page-mark").forEach((mark) => mark.remove());

  const printable = document.createElement("article");
  printable.id = "printable-report";
  printable.className = "report-document";
  while (reportClone.firstChild) printable.appendChild(reportClone.firstChild);

  document.querySelector<HTMLIFrameElement>("iframe[data-report-print-frame]")?.remove();
  const frame = document.createElement("iframe");
  frame.dataset.reportPrintFrame = "true";
  frame.title = "Utskriftsvisning av rapport";
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "absolute";
  frame.style.width = "174mm";
  frame.style.height = "257mm";
  frame.style.left = "-10000px";
  frame.style.top = "0";
  frame.style.border = "0";

  const styles = Array.from(document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join("");
  const reportMarkup = printable.outerHTML;
  frame.onload = () => {
    const printWindow = frame.contentWindow;
    if (!printWindow) {
      frame.remove();
      return;
    }
    const cleanup = () => frame.remove();
    printWindow.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
    window.setTimeout(cleanup, 120_000);
  };
  frame.srcdoc = `<!doctype html><html lang="nb"><head><meta charset="UTF-8"><title>Rapport</title>${styles}<style>
    ${reportPrintPageStyles(classification)}
    :root, html, body { min-height: 0; margin: 0; padding: 0; background: #fff !important; }
    body * { visibility: visible !important; }
    #printable-report { position: static; width: auto; overflow: visible; margin: 0; padding: 0; background: #fff !important; }
  </style></head><body>${reportMarkup}</body></html>`;
  document.body.appendChild(frame);
}
