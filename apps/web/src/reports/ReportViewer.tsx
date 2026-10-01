import { createElement } from "react";
import { Modal } from "../components/Modal";
import { RichTextContent } from "../components/RichText";
import { printReportDocument } from "./printReport";
import { useTranslation } from "../localization/LocalizationProvider";

export type ArchivedReport = {
  id: string;
  siteName: string;
  organizationPath: string[];
  title: string;
  finalReport: string;
  finalReportClassification: string | null;
  reportCreatedAt: string;
  workReceivedAt: string;
  workCompletedAt: string;
  writtenBy: string;
  approvedBy: string;
  finalReportApprovedAt: string;
};

type ClassificationMarking = { name: string; abbreviation: string };

type ReportViewerProps = {
  report: ArchivedReport;
  language: string;
  timeZone: string;
  classificationMarkings: ClassificationMarking[];
  onClose: () => void;
  onCopyLink: () => void;
};

export function ReportViewer({ report, language, timeZone, classificationMarkings, onClose, onCopyLink }: ReportViewerProps) {
  const t = useTranslation();
  const date = (value: string) => new Date(value).toLocaleDateString(language, { timeZone });
  const classification = classificationMarkings.find((marking) => marking.abbreviation === report.finalReportClassification);
  const reportContent = report.finalReport.replace(/^(#{1,4})\s+/gm, (_match, hashes: string) => `${"#".repeat(hashes.length + 1)} `);

  const print = () => printReportDocument(language, t("reportModalTitle"), t("reportPrintView"));

  return <Modal title={t("reportModalTitle")} onClose={onClose}>
    <article className="report-document" id="printable-report">
      {classification && <><div className="report-page-mark report-page-mark-header">{classification.name}</div><div className="report-page-mark report-page-mark-footer">{classification.name}</div></>}
      <h1>{report.siteName}</h1>
      {report.organizationPath.map((name, index) => createElement(`h${Math.min(index + 2, 6)}`, { key: `${index}-${name}`, className: "report-organization-heading" }, name))}
      <dl className="report-metadata">
        <div><dt>{t("workItemLabel")}</dt><dd>{report.title}</dd></div>
        <div><dt>{t("dateLabel")}</dt><dd>{date(report.reportCreatedAt)}</dd></div>
        <div><dt>{t("workReceived")}</dt><dd>{date(report.workReceivedAt)}</dd></div>
        <div><dt>{t("workCompleted")}</dt><dd>{date(report.workCompletedAt)}</dd></div>
        <div><dt>{t("reportWrittenBy")}</dt><dd>{report.writtenBy}</dd></div>
        <div><dt>{t("reportApprovedBy")}</dt><dd>{report.approvedBy}</dd></div>
      </dl>
      <RichTextContent value={reportContent} />
    </article>
    <div className="modal-actions report-screen-actions">
      <button className="task-icon-action permalink-action" type="button" title={t("copyReportLink")} aria-label={t("copyReportLink")} onClick={onCopyLink}><i aria-hidden="true">🔗</i></button>
      <button className="secondary-button" type="button" onClick={onClose}>{t("close")}</button>
      <button className="secondary-button" type="button" onClick={print}>{t("print")}</button>
      <button className="primary-button" type="button" onClick={print}>{t("exportPdf")}</button>
    </div>
  </Modal>;
}
