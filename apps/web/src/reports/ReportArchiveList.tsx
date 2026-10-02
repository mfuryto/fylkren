import { PaginationNav } from "../components/PaginationNav";
import type { ArchivedReport } from "./ReportViewer";
import { useTranslation } from "../localization/LocalizationProvider";
import { WorkReference } from "../components/WorkReference";

type ReportArchiveListProps = {
  reports: ArchivedReport[];
  loading: boolean;
  total: number;
  page: number;
  language: string;
  timeZone: string;
  onSelect: (report: ArchivedReport) => void;
  onPageChange: (page: number) => void;
};

export function ReportArchiveList({ reports, loading, total, page, language, timeZone, onSelect, onPageChange }: ReportArchiveListProps) {
  const t = useTranslation();
  const date = (value: string) => new Date(value).toLocaleDateString(language, { timeZone });
  return <section className="panel report-list-panel" aria-label={t("reportArchive")} aria-busy={loading}>
    {loading && <p className="empty-list-message" role="status">{t("loading")}</p>}
    {!loading && reports.length === 0 && <p className="empty-list-message">{t("noReportsMatch")}</p>}
    <div className="admin-list">
      {reports.map(report => <div className="admin-list-row report-list-row" key={report.id} onClick={event => { if (!(event.target as HTMLElement).closest("button, a")) onSelect(report); }}>
        <WorkReference referenceCode={report.referenceCode}/>
        <span className="report-list-title"><strong><button className="report-heading-button" type="button" title={report.title} aria-label={`${t("viewReport")}: ${report.title}`} onClick={() => onSelect(report)}>{report.title}</button></strong><small className="muted">{date(report.finalReportApprovedAt)} · {t("reportApprovedBySummary", { name: report.approvedBy })}{report.originReference ? ` · ${t("originReferenceLabel")}: ${report.originReference}` : ""}</small></span>
      </div>)}
    </div>
    <PaginationNav page={page} totalItems={total} onPageChange={onPageChange} label={t("reportPages")} />
  </section>;
}
