import { translateActive } from "../localization";
import type { Dispatch, SetStateAction } from "react";
import type { TaskSite } from "../work/WorkContextModels";
import type { TaskUnitWithDepth } from "./taskScope";
import { ListSortControl, type ListSort } from "../components/ListSortControl";

export type TaskQueueSummary = { active: number; inProgress: number; inReview: number; overdue: number };

export function TaskQueueControls({ sites, selectedSite, selectedSiteId, setSelectedSiteId, selectedUnitId, setSelectedUnitId, selectableUnits, taskLevelCount, filter, setFilter, search, setSearch, sort, setSort, summary }: {
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
  sort: ListSort;
  setSort: Dispatch<SetStateAction<ListSort>>;
  summary: TaskQueueSummary;
}) {
  return <>
    <section className="panel task-toolbar">
      {(sites.length > 1 || taskLevelCount > 1) && <div className="task-scope-controls">
      {sites.length > 1 && <div className="field"><label htmlFor="task-site">{translateActive("site")}</label><select id="task-site" value={selectedSiteId} onChange={event => setSelectedSiteId(event.target.value)}>{sites.map(site => <option key={site.siteId} value={site.siteId}>{site.name}</option>)}</select></div>}
      {taskLevelCount > 1 && <div className="field"><label htmlFor="task-level">{translateActive("workLevel")}</label><select id="task-level" value={selectedUnitId} onChange={event => setSelectedUnitId(event.target.value)}>{selectedSite?.hasTopLevelAccess && <option value="">{selectedSite.name} {translateActive("tasksTaskQueueControlsTopLevel")}</option>}{selectableUnits.map(unit => <option key={unit.id} value={unit.id}>{`${"— ".repeat(unit.depth)}${unit.name}`}</option>)}</select></div>}
      </div>}
      <div className="field"><label htmlFor="task-filter">{translateActive("view")}</label><select id="task-filter" value={filter} onChange={event => setFilter(event.target.value)}>
        <option value="active">{translateActive("activePlural")}</option><option value="unassigned">{translateActive("tasksTaskQueueControlsUnallocatedMeetingProcessing")}</option><option value="all">{translateActive("all")}</option><option value="archived">{translateActive("lifecycleArchivedTasks")}</option><option value="registered">{translateActive("taskStatusRegistered")}</option><option value="under_review">{translateActive("taskStatusUnderReview")}</option><option value="on_hold">{translateActive("taskStatusOnHold")}</option><option value="planning">{translateActive("taskStatusPlanning")}</option><option value="execution">{translateActive("taskStatusExecution")}</option><option value="assigned">{translateActive("requestProgressAssigned")}</option><option value="in_progress">{translateActive("taskStatusInProgress")}</option><option value="in_review">{translateActive("taskStatusInReview")}</option><option value="rejected">{translateActive("taskStatusRejected")}</option><option value="completed">{translateActive("taskStatusCompleted")}</option><option value="cancelled">{translateActive("taskStatusCancelled")}</option><option value="reassigned">{translateActive("taskStatusReassigned")}</option>
      </select></div>
      <div className="field task-search"><label htmlFor="task-search">{translateActive("tasksTaskQueueControlsSearchTasks")}</label><input id="task-search" type="search" value={search} placeholder={translateActive("tasksTaskQueueControlsTitleContentSenderOrName")} onChange={event => setSearch(event.target.value)} /></div>
      <ListSortControl id="task-sort" value={sort} onChange={setSort} options={["newest", "oldest", "name-asc", "name-desc", "reference-asc", "reference-desc"]}/>
    </section>
    <div className="task-summary">
      <div className="summary-card"><span>{translateActive("activePlural")}</span><strong>{summary.active}</strong></div>
      <div className="summary-card"><span>{translateActive("taskStatusInProgress")}</span><strong>{summary.inProgress}</strong></div>
      <div className="summary-card"><span>{translateActive("taskStatusInReview")}</span><strong>{summary.inReview}</strong></div>
      <div className="summary-card"><span>{translateActive("overdue")}</span><strong>{summary.overdue}</strong></div>
    </div>
  </>;
}
