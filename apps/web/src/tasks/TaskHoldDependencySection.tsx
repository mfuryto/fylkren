import { translateActive } from "../localization";
import type { WorkItemDependencyCandidate } from "../work/WorkItemModels";
import { TaskDependencyPicker } from "./TaskDependencyPicker";

export function TaskHoldDependencySection({ siteId, itemId, busy, selected, onToggle, onError }: {
  siteId: string;
  itemId: string;
  busy: boolean;
  selected: WorkItemDependencyCandidate[];
  onToggle: (candidate: WorkItemDependencyCandidate) => void;
  onError: (message: string) => void;
}) {
  return <section className="dependency-section">
    <h3>{translateActive("tasksTaskHoldDependencySectionWaitForOtherTasks")}</h3>
    <TaskDependencyPicker siteId={siteId} itemId={itemId} busy={busy} selectedIds={selected.map(value => value.id)} onSelect={onToggle} onError={onError} />
    {selected.length > 0 ? <div className="selection-summary"><strong>{translateActive("tasksTaskHoldDependencySectionSelectedDependencies")}</strong><ul>{selected.map(value => <li key={value.id}>{value.title}</li>)}</ul></div>
      : <p className="muted">{translateActive("tasksTaskHoldDependencySectionOptionalSelectOneOrMoreTasks")}</p>}
  </section>;
}
