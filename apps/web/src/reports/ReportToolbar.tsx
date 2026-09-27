import type { FormEvent } from "react";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import { availableReportYears } from "./reportFilters";

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
};

export function ReportToolbar({ sites, units, selectedSiteId, selectedUnitId, hasTopLevelAccess, year, years, search, onSiteChange, onUnitChange, onYearChange, onSearchChange, onSubmit }: ReportToolbarProps) {
  return <form className="panel report-toolbar" onSubmit={onSubmit}>
    {sites.length > 1 && <div className="field">
      <label htmlFor="report-site">Site</label>
      <select id="report-site" value={selectedSiteId} onChange={event => onSiteChange(event.target.value)}>
        {sites.map(site => <option key={site.siteId} value={site.siteId}>{site.name}</option>)}
      </select>
    </div>}
    {units.length + (hasTopLevelAccess ? 1 : 0) > 1 && <div className="field">
      <label htmlFor="report-level">Arbeidsnivå</label>
      <select id="report-level" value={selectedUnitId} onChange={event => onUnitChange(event.target.value)}>
        {hasTopLevelAccess && <option value="">Toppnivå</option>}
        {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
      </select>
    </div>}
    <div className="field">
      <label htmlFor="report-year">År</label>
      <select id="report-year" value={year} onChange={event => onYearChange(event.target.value)}>
        <option value="">Alle år</option>
        {availableReportYears(years, year).map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </div>
    <div className="field report-search">
      <label htmlFor="report-search">Søk</label>
      <input id="report-search" type="search" value={search} placeholder="Tittel, innhold eller navn" onChange={event => onSearchChange(event.target.value)}/>
    </div>
    <button className="primary-button" type="submit">Søk</button>
  </form>;
}
