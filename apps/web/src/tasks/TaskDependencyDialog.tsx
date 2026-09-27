import { useEffect, useState } from "react";
import { Modal } from "../components/Modal";
import type { WorkItem, WorkItemDependency } from "../work/WorkItemModels";
import { getTaskDependencies } from "./taskApi";
import { TaskDependencyPicker } from "./TaskDependencyPicker";
import { taskStatusLabels } from "./taskPolicy";

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
    catch (problem) { onError(problem instanceof Error ? problem.message : "Avhengighetene kunne ikke lastes."); }
  }
  useEffect(() => { void load(); }, [siteId, item.id]);

  return <Modal title="Oppdragsavhengigheter" onClose={onClose}>
    <section className="dependency-section"><h3>Registrerte avhengigheter</h3><p className="muted">Oppdraget er blokkert til alle registrerte forgjengere er fullført.</p>
      {dependencies.length === 0 ? <p className="empty-state-inline">Ingen avhengigheter er registrert.</p> : <ul className="dependency-list">{dependencies.map(value => <li key={value.id}>
        <span><strong>{value.predecessorTitle}</strong><small>{value.isSatisfied ? "Fullført" : taskStatusLabels[value.predecessorStatus] ?? value.predecessorStatus}</small></span>
        {editable && <button className="secondary-button" type="button" disabled={busy} onClick={() => { void onRemove(value.id).then(ok => { if (ok) void load(); }); }}>Fjern</button>}
      </li>)}</ul>}
    </section>
    {editable && <section className="dependency-section"><h3>Legg til avhengighet</h3><TaskDependencyPicker siteId={siteId} itemId={item.id} busy={busy} onError={onError} onSelect={value => { void onAdd(value.id).then(ok => { if (ok) void load(); }); }} /><p className="muted">Søk etter oppdraget som må fullføres først.</p></section>}
    <p className="muted modal-note">Foreløpig støttes fullfør-til-start: dette oppdraget frigjøres automatisk når alle forgjengerne er fullført.{editable ? "" : " Avsluttede oppdrag er skrivebeskyttet."}</p>
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Lukk</button></div>
  </Modal>;
}
