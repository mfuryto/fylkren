import type { Dispatch, SetStateAction } from "react";
import type { TaskSite } from "../work/WorkContextModels";
import type { TaskUnitWithDepth } from "./taskScope";

export type TaskQueueSummary = { active: number; inProgress: number; inReview: number; overdue: number };

export function TaskQueueControls({ sites, selectedSite, selectedSiteId, setSelectedSiteId, selectedUnitId, setSelectedUnitId, selectableUnits, taskLevelCount, filter, setFilter, search, setSearch, summary }: {
  sites: TaskSite[];
  selectedSite?: TaskSite;
  selectedSiteId: string;
  setSelectedSiteId: Dispatch<SetStateAction<string>>;
  selectedUnitId: string;
  setSelectedUnitId: Dispatch<SetStateAction<string>>;
  selectableUnits: TaskUnitWithDepth[];
  taskLevelCount: number;
  filter: string;
  setFilter: Dispatch<SetStateAction<string>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  summary: TaskQueueSummary;
}) {
  return <>
    <section className="panel task-toolbar">
      {sites.length > 1 && <div className="field"><label htmlFor="task-site">Site</label><select id="task-site" value={selectedSiteId} onChange={event => setSelectedSiteId(event.target.value)}>{sites.map(site => <option key={site.siteId} value={site.siteId}>{site.name}</option>)}</select></div>}
      {taskLevelCount > 1 && <div className="field"><label htmlFor="task-level">Arbeidsnivå</label><select id="task-level" value={selectedUnitId} onChange={event => setSelectedUnitId(event.target.value)}>{selectedSite?.hasTopLevelAccess && <option value="">{selectedSite.name} (toppnivå)</option>}{selectableUnits.map(unit => <option key={unit.id} value={unit.id}>{`${"— ".repeat(unit.depth)}${unit.name}`}</option>)}</select></div>}
      <div className="field"><label htmlFor="task-filter">Vis</label><select id="task-filter" value={filter} onChange={event => setFilter(event.target.value)}>
        <option value="active">Aktive</option><option value="unassigned">Ufordelte / møtebehandling</option><option value="all">Alle</option><option value="registered">Registrert</option><option value="under_review">Til vurdering</option><option value="on_hold">Avventer</option><option value="planning">Planlegging</option><option value="execution">Utførelse</option><option value="assigned">Fordelt</option><option value="in_progress">Pågår</option><option value="in_review">Til kontroll</option><option value="rejected">Avvist</option><option value="completed">Fullført</option><option value="cancelled">Kansellert</option><option value="reassigned">Omfordelt</option>
      </select></div>
      <div className="field task-search"><label htmlFor="task-search">Søk i oppgaver</label><input id="task-search" type="search" value={search} placeholder="Tittel, innhold, avsender eller navn" onChange={event => setSearch(event.target.value)} /></div>
    </section>
    <div className="summary-grid">
      <div className="summary-card"><span>Aktive</span><strong>{summary.active}</strong></div>
      <div className="summary-card"><span>Pågår</span><strong>{summary.inProgress}</strong></div>
      <div className="summary-card"><span>Til kontroll</span><strong>{summary.inReview}</strong></div>
      <div className="summary-card"><span>Forfalt</span><strong>{summary.overdue}</strong></div>
    </div>
  </>;
}
