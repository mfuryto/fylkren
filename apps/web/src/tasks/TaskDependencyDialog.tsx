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
    catch (problem) { onError(problem instanceof Error ? problem.message : "Dependencies could not be loaded."); }
  }
  useEffect(() => { void load(); }, [siteId, item.id]);

  return <Modal title="Task dependencies" onClose={onClose}>
    <section className="dependency-section"><h3>Registered dependencies</h3><p className="muted">The task is blocked until all registered predecessors are completed.</p>
      {dependencies.length === 0 ? <p className="empty-state-inline">No dependencies are registered.</p> : <ul className="dependency-list">{dependencies.map(value => <li key={value.id}>
        <span><strong>{value.predecessorTitle}</strong><small>{taskStatusLabel(value.isSatisfied ? "completed" : value.predecessorStatus)}</small></span>
        {editable && <button className="secondary-button" type="button" disabled={busy} onClick={() => { void onRemove(value.id).then(ok => { if (ok) void load(); }); }}>Remove</button>}
      </li>)}</ul>}
    </section>
    {editable && <section className="dependency-section"><h3>Add dependency</h3><TaskDependencyPicker siteId={siteId} itemId={item.id} busy={busy} onError={onError} onSelect={value => { void onAdd(value.id).then(ok => { if (ok) void load(); }); }} /><p className="muted">Search for the task that must be completed first.</p></section>}
    <p className="muted modal-note">Finish-to-start is currently supported: this task is released automatically when all predecessors are completed.{editable ? "" : " Closed tasks are read-only."}</p>
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Close</button></div>
  </Modal>;
}
