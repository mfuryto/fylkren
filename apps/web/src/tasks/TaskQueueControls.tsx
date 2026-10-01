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
      {taskLevelCount > 1 && <div className="field"><label htmlFor="task-level">Work level</label><select id="task-level" value={selectedUnitId} onChange={event => setSelectedUnitId(event.target.value)}>{selectedSite?.hasTopLevelAccess && <option value="">{selectedSite.name} (top level)</option>}{selectableUnits.map(unit => <option key={unit.id} value={unit.id}>{`${"— ".repeat(unit.depth)}${unit.name}`}</option>)}</select></div>}
      <div className="field"><label htmlFor="task-filter">Vis</label><select id="task-filter" value={filter} onChange={event => setFilter(event.target.value)}>
        <option value="active">Active</option><option value="unassigned">Unallocated / meeting processing</option><option value="all">All</option><option value="registered">Registered</option><option value="under_review">To vurdering</option><option value="on_hold">Pending</option><option value="planning">Planning</option><option value="execution">Execution</option><option value="assigned">Allocated</option><option value="in_progress">In progress</option><option value="in_review">To kontroll</option><option value="rejected">Rejected</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="reassigned">Reassigned</option>
      </select></div>
      <div className="field task-search"><label htmlFor="task-search">Search tasks</label><input id="task-search" type="search" value={search} placeholder="Title, content, sender, or name" onChange={event => setSearch(event.target.value)} /></div>
    </section>
    <div className="summary-grid">
      <div className="summary-card"><span>Active</span><strong>{summary.active}</strong></div>
      <div className="summary-card"><span>In progress</span><strong>{summary.inProgress}</strong></div>
      <div className="summary-card"><span>To kontroll</span><strong>{summary.inReview}</strong></div>
      <div className="summary-card"><span>Forfalt</span><strong>{summary.overdue}</strong></div>
    </div>
  </>;
}
