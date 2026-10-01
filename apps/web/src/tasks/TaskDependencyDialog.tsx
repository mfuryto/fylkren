import { translateActive } from "../localization";
import { useEffect, useState } from "react";
import { Modal } from "../components/Modal";
import type { WorkItem, WorkItemDependency } from "../work/WorkItemModels";
import { getTaskDependencies } from "./taskApi";
import { TaskDependencyPicker } from "./TaskDependencyPicker";
import { taskStatusLabel } from "./taskPolicy";

export function TaskDependencyDialog({ siteId, item, busy, editable, onClose, onAdd, onRemove, onError }: {
  siteId: string;
  item: WorkItem;
  busy: boolean;
  editable: boolean;
  onClose: () => void;
  onAdd: (predecessorWorkItemId: string) => Promise<boolean>;
  onRemove: (dependencyId: string) => Promise<boolean>;
  onError: (message: string) => void;
}) {
  const [dependencies, setDependencies] = useState<WorkItemDependency[]>([]);

  async function load() {
    try { setDependencies(await getTaskDependencies(siteId, item.id)); }
    catch (problem) { onError(problem instanceof Error ? problem.message : translateActive("tasksTaskDependencyDialogDependenciesCouldNotBeLoaded")); }
  }
  useEffect(() => { void load(); }, [siteId, item.id]);

  return <Modal title={translateActive("tasksTaskDependencyDialogTaskDependencies")} onClose={onClose}>
    <section className="dependency-section"><h3>{translateActive("tasksTaskDependencyDialogRegisteredDependencies")}</h3><p className="muted">{translateActive("tasksTaskDependencyDialogTheTaskIsBlockedUntilAll")}</p>
      {dependencies.length === 0 ? <p className="empty-state-inline">{translateActive("tasksTaskDependencyDialogNoDependenciesAreRegistered")}</p> : <ul className="dependency-list">{dependencies.map(value => <li key={value.id}>
        <span><strong>{value.predecessorTitle}</strong><small>{taskStatusLabel(value.isSatisfied ? "completed" : value.predecessorStatus)}</small></span>
        {editable && <button className="secondary-button" type="button" disabled={busy} onClick={() => { void onRemove(value.id).then(ok => { if (ok) void load(); }); }}>{translateActive("remove")}</button>}
      </li>)}</ul>}
    </section>
    {editable && <section className="dependency-section"><h3>{translateActive("tasksTaskDependencyDialogAddDependency")}</h3><TaskDependencyPicker siteId={siteId} itemId={item.id} busy={busy} onError={onError} onSelect={value => { void onAdd(value.id).then(ok => { if (ok) void load(); }); }} /><p className="muted">{translateActive("tasksTaskDependencyDialogSearchForTheTaskThatMust")}</p></section>}
    <p className="muted modal-note">{translateActive("tasksTaskDependencyDialogFinishToStartIsCurrentlySupported")}{editable ? "" : translateActive("tasksTaskDependencyDialogClosedTasksAreReadOnly")}</p>
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>{translateActive("close")}</button></div>
  </Modal>;
}
