import type { TaskSite } from "../work/WorkContextModels";

type PlanningScopeControlsProps = {
  sites: TaskSite[];
  siteId: string;
  levels: Array<[string, string]>;
  levelFilter: string;
  onSiteChange: (siteId: string) => void;
  onLevelChange: (levelId: string) => void;
};

export function PlanningScopeControls({
  sites,
  siteId,
  levels,
  levelFilter,
  onSiteChange,
  onLevelChange,
}: PlanningScopeControlsProps) {
  if (sites.length <= 1 && levels.length <= 1) return null;

  return <section className="panel personnel-site">
    {sites.length > 1 && <div className="field">
      <label htmlFor="planning-site">Site</label>
      <select id="planning-site" value={siteId} onChange={event => onSiteChange(event.target.value)}>
        {sites.map(site => <option key={site.siteId} value={site.siteId}>{site.name}</option>)}
      </select>
    </div>}
    {levels.length > 1 && <div className="field">
      <label htmlFor="planning-level">Arbeidsnivå</label>
      <select id="planning-level" value={levelFilter} onChange={event => onLevelChange(event.target.value)}>
        <option value="all">Alle mine nivåer</option>
        {levels.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </div>}
  </section>;
}
