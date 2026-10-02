import type { FormEvent } from "react";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import { availableReportYears } from "./reportFilters";
import { useTranslation } from "../localization/LocalizationProvider";
import { ListSortControl, type ListSort } from "../components/ListSortControl";

type ReportToolbarProps = {
  sites: TaskSite[];
  units: TaskUnit[];
  selectedSiteId: string;
  selectedUnitId: string;
  hasTopLevelAccess: boolean;
  year: string;
  years: number[];
  search: string;
  onSiteChange: (siteId: string) => void;
  onUnitChange: (unitId: string) => void;
  onYearChange: (year: string) => void;
  onSearchChange: (search: string) => void;
  onSubmit: (event: FormEvent) => void;
  sort: ListSort;
  onSortChange: (sort: ListSort) => void;
};

export function ReportToolbar({ sites, units, selectedSiteId, selectedUnitId, hasTopLevelAccess, year, years, search, sort, onSiteChange, onUnitChange, onYearChange, onSearchChange, onSortChange, onSubmit }: ReportToolbarProps) {
  const t = useTranslation();
  return <form className="panel report-toolbar" onSubmit={onSubmit}>
    {sites.length > 1 && <div className="field">
      <label htmlFor="report-site">{t("site")}</label>
      <select id="report-site" value={selectedSiteId} onChange={event => onSiteChange(event.target.value)}>
        {sites.map(site => <option key={site.siteId} value={site.siteId}>{site.name}</option>)}
      </select>
    </div>}
    {units.length + (hasTopLevelAccess ? 1 : 0) > 1 && <div className="field">
      <label htmlFor="report-level">{t("workLevel")}</label>
      <select id="report-level" value={selectedUnitId} onChange={event => onUnitChange(event.target.value)}>
        {hasTopLevelAccess && <option value="">{t("topLevel")}</option>}
        {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
      </select>
    </div>}
    <div className="field">
      <label htmlFor="report-year">{t("year")}</label>
      <select id="report-year" value={year} onChange={event => onYearChange(event.target.value)}>
        <option value="">{t("allYears")}</option>
        {availableReportYears(years, year).map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </div>
    <div className="field report-search">
      <label htmlFor="report-search">{t("search")}</label>
      <input id="report-search" type="search" value={search} placeholder={t("reportSearchPlaceholder")} onChange={event => onSearchChange(event.target.value)}/>
    </div>
    <ListSortControl id="report-sort" value={sort} onChange={onSortChange} options={["newest", "oldest", "name-asc", "name-desc", "reference-asc", "reference-desc"]}/>
    <button className="primary-button" type="submit">{t("search")}</button>
  </form>;
}
