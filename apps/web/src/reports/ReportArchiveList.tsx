import { PaginationNav } from "../components/PaginationNav";
import type { ArchivedReport } from "./ReportViewer";
import { useTranslation } from "../localization/LocalizationProvider";

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
  return <section className="panel report-list-panel">
    <div className="section-heading"><div>
      <h2>{t("reportArchive")}</h2>
      <p className="muted">{loading ? t("loading") : total === 1 ? t("oneReport") : t("reportCount", { count: total })}</p>
    </div></div>
    {!loading && reports.length === 0 && <p className="empty-list-message">{t("noReportsMatch")}</p>}
    <div className="admin-list">
      {reports.map(report => <div className="admin-list-row report-list-row" key={report.id}>
        <span><strong>{report.title}</strong><small className="muted">{date(report.finalReportApprovedAt)} · {t("reportApprovedBySummary", { name: report.approvedBy })}</small></span>
        <button className="secondary-button" type="button" onClick={() => onSelect(report)}>{t("viewReport")}</button>
      </div>)}
    </div>
    <PaginationNav page={page} totalItems={total} onPageChange={onPageChange} label={t("reportPages")} />
  </section>;
}
