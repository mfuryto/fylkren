import { translateActive } from "../localization";
import type { TaskSite } from "../work/WorkContextModels";
import { ListSortControl, type ListSort } from "../components/ListSortControl";

type PlanningScopeControlsProps = {
  sites: TaskSite[];
  siteId: string;
  levels: Array<[string, string]>;
  levelFilter: string;
  onSiteChange: (siteId: string) => void;
  onLevelChange: (levelId: string) => void;
  sort: ListSort;
  onSortChange: (sort: ListSort) => void;
};

export function PlanningScopeControls({
  sites,
  siteId,
  levels,
  levelFilter,
  onSiteChange,
  onLevelChange,
  sort,
  onSortChange,
}: PlanningScopeControlsProps) {
  return <section className="panel personnel-site">
    {sites.length > 1 && <div className="field">
      <label htmlFor="planning-site">{translateActive("site")}</label>
      <select id="planning-site" value={siteId} onChange={event => onSiteChange(event.target.value)}>
        {sites.map(site => <option key={site.siteId} value={site.siteId}>{site.name}</option>)}
      </select>
    </div>}
    {levels.length > 1 && <div className="field">
      <label htmlFor="planning-level">{translateActive("workLevel")}</label>
      <select id="planning-level" value={levelFilter} onChange={event => onLevelChange(event.target.value)}>
        <option value="all">{translateActive("workflowsPlanningScopeControlsAllMyLevels")}</option>
        {levels.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </div>}
    <ListSortControl id="planning-sort" value={sort} onChange={onSortChange} options={["newest", "oldest", "name-asc", "name-desc", "reference-asc", "reference-desc"]}/>
  </section>;
}
