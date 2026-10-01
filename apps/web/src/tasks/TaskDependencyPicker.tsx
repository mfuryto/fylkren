import { useEffect, useState } from "react";
import type { WorkItemDependencyCandidate } from "../work/WorkItemModels";
import { searchTaskDependencyCandidates } from "./taskApi";
import { taskStatusLabel } from "./taskPolicy";

export function TaskDependencyPicker({ siteId, itemId, busy, selectedIds = [], onSelect, onError }: {
  siteId: string;
  itemId: string;
  busy: boolean;
  selectedIds?: string[];
  onSelect: (candidate: WorkItemDependencyCandidate) => void;
  onError: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<WorkItemDependencyCandidate[]>([]);
  useEffect(() => {
    if (query.trim().length < 2) { setCandidates([]); return; }
    const timer = window.setTimeout(() => {
      void searchTaskDependencyCandidates(siteId, itemId, query.trim())
        .then(setCandidates)
        .catch(problem => onError(problem instanceof Error ? problem.message : "Oppdragssøket kunne ikke gjennomføres."));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, siteId, itemId, onError]);

  return <div className="dependency-picker">
    <div className="field"><label htmlFor={`dependency-search-${itemId}`}>Søk etter oppdrag</label><input id={`dependency-search-${itemId}`} value={query} onChange={event => setQuery(event.target.value)} placeholder="Skriv minst to tegn" /></div>
    {candidates.length > 0 && <ul className="dependency-candidate-list">{candidates.map(value => <li key={value.id}>
      <span><strong>{value.title}</strong><small>{taskStatusLabel(value.status)}</small></span>
      <button className={selectedIds.includes(value.id) ? "primary-button" : "secondary-button"} type="button" disabled={busy} onClick={() => onSelect(value)}>{selectedIds.includes(value.id) ? "Fjern valg" : "Velg"}</button>
    </li>)}</ul>}
  </div>;
}
