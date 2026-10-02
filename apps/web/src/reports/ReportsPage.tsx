import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api/client";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import { ReportArchiveList } from "./ReportArchiveList";
import { ReportToolbar } from "./ReportToolbar";
import { ReportViewer, type ArchivedReport } from "./ReportViewer";
import { availableReportUnits } from "./reportFilters";
import { copyPermalink, navigateToLocation, type AppLocation } from "../navigation/permalinks";
import { useTranslation } from "../localization/LocalizationProvider";
import type { ListSort } from "../components/ListSortControl";

type ClassificationMarking = { name: string; abbreviation: string };

export function ReportsPage({ language, timeZone, classificationMarkings, permalink }: { language: string; timeZone: string; classificationMarkings: ClassificationMarking[]; permalink: AppLocation }) {
  const t = useTranslation();
  const [sites, setSites] = useState<TaskSite[]>([]);
  const [units, setUnits] = useState<TaskUnit[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [reports, setReports] = useState<ArchivedReport[]>([]);
  const [yearCounts, setYearCounts] = useState<Array<{ year: number; count: number }>>([]);
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ListSort>("newest");
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<ArchivedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linkMessage, setLinkMessage] = useState("");

  useEffect(() => {
    apiGet<{ sites: TaskSite[]; units: TaskUnit[] }>("/api/work/context", t("reportContextLoadFailed"))
      .then(context => {
        const operationalSites = context.sites.filter(site => site.hasOperationalAccess);
        setSites(operationalSites);
        setUnits(context.units);
        setSelectedSiteId(operationalSites.find(site => site.siteId === permalink.siteId)?.siteId ?? operationalSites[0]?.siteId ?? "");
        if (permalink.unitId) setSelectedUnitId(permalink.unitId);
        if (permalink.year) setYear(permalink.year);
        if (!operationalSites.length) setLoading(false);
      })
      .catch(problem => {
        setError(problem instanceof Error ? problem.message : t("reportContextLoadFailed"));
        setLoading(false);
      });
  }, [permalink.siteId, permalink.unitId, permalink.year]);

  const selectedSite = sites.find(site => site.siteId === selectedSiteId);
  const availableUnits = useMemo(() => availableReportUnits(units, selectedSiteId, language), [units, selectedSiteId, language]);
  useEffect(() => {
    if (!selectedSite) return;
    if (!selectedSite.hasTopLevelAccess && !availableUnits.some(unit => unit.id === selectedUnitId)) {
      setSelectedUnitId(availableUnits[0]?.id ?? "");
    }
    if (selectedSite.hasTopLevelAccess && selectedUnitId && !availableUnits.some(unit => unit.id === selectedUnitId)) {
      setSelectedUnitId("");
    }
  }, [selectedSiteId, selectedSite?.hasTopLevelAccess, availableUnits]);

  useEffect(() => {
    if (!selectedSiteId || (selectedSite && !selectedSite.hasTopLevelAccess && !selectedUnitId)) return;
    setLoading(true);
    const parameters = new URLSearchParams({ page: page.toString(), sort });
    if (selectedUnitId) parameters.set("unitId", selectedUnitId);
    if (year) parameters.set("year", year);
    if (appliedSearch) parameters.set("search", appliedSearch);
    apiGet<{ reports: ArchivedReport[]; years: number[]; yearCounts: Array<{ year: number; count: number }>; total: number }>(`/api/work/sites/${selectedSiteId}/reports?${parameters}`, t("reportsLoadFailed"))
      .then(value => {
        setReports(value.reports);
        setYears(value.years);
        setYearCounts(value.yearCounts ?? []);
        setTotal(value.total);
        setError("");
        if (permalink.reportId) {
          const requested = value.reports.find(report => report.id === permalink.reportId);
          if (requested) setSelected(requested);
          else if (page * 20 < value.total) setPage(page + 1);
          else setError(t("reportUnavailable"));
        }
      })
      .catch(problem => setError(problem instanceof Error ? problem.message : t("reportsLoadFailed")))
      .finally(() => setLoading(false));
  }, [selectedSiteId, selectedUnitId, year, appliedSearch, sort, page, permalink.reportId]);

  return <div className="page reports-page">
    <header className="page-header"><div><h1>{t("reportsTitle")}</h1><p className="muted">{t("reportsIntro")}</p></div></header>
    {error && <p className="status-message error-message">{error}</p>}
    {linkMessage && <p className="status-message" role="status">{linkMessage}</p>}
    {sites.length === 0 && !loading ? <section className="panel empty-state"><div>
      <h2>{t("noReportAccessTitle")}</h2><p className="muted">{t("noReportAccessIntro")}</p>
    </div></section> : <>
      <ReportToolbar
        sites={sites} units={availableUnits} selectedSiteId={selectedSiteId} selectedUnitId={selectedUnitId}
        hasTopLevelAccess={Boolean(selectedSite?.hasTopLevelAccess)} year={year} years={years} yearCounts={yearCounts} loading={loading} search={search}
        sort={sort}
        onSiteChange={value => { setSelectedSiteId(value); setSelectedUnitId(""); setPage(1); }}
        onUnitChange={value => { setSelectedUnitId(value); setPage(1); }}
        onYearChange={value => { setYear(value); setPage(1); }} onSearchChange={setSearch}
        onSortChange={value => { setSort(value); setPage(1); }}
        onSubmit={event => { event.preventDefault(); setPage(1); setAppliedSearch(search.trim()); }}
      />
      <ReportArchiveList reports={reports} loading={loading} total={total} page={page} language={language} timeZone={timeZone} onSelect={report => { setSelected(report); navigateToLocation({ page: "Reports", siteId: selectedSiteId, unitId: selectedUnitId || undefined, reportId: report.id, year }); }} onPageChange={setPage}/>
    </>}
    {selected && <ReportViewer
      report={selected}
      language={language}
      timeZone={timeZone}
      classificationMarkings={classificationMarkings}
      onCopyLink={() => {
        void copyPermalink({ page: "Reports", siteId: selectedSiteId, unitId: selectedUnitId || undefined, reportId: selected.id, year })
          .then(() => setLinkMessage(t("reportLinkCopied")))
          .catch(() => setError(t("reportLinkCopyFailed")));
      }}
      onClose={() => setSelected(null)}
    />}
  </div>;
}
