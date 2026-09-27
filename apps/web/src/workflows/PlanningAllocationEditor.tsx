import { useState } from "react";
import { ClassificationControls, type ClassificationMarking } from "../components/ClassificationControls";
import type { TaskUnit } from "../work/WorkContextModels";
import { useRequestRecipientSearch } from "../work/useRequestRecipientSearch";
import type { PlanAllocation, PlanningRun } from "./PlanningModels";
import { addPlanAllocation } from "./planAllocations";

export function PlanningAllocationEditor({
  siteId,
  run,
  stepId,
  units,
  allocations,
  classificationMarkings,
  onAllocationsChange,
  onAddRequest,
  onRemoveRequest,
  onError,
}: {
  siteId: string;
  run: PlanningRun;
  stepId: string;
  units: TaskUnit[];
  allocations: PlanAllocation[];
  classificationMarkings: ClassificationMarking[];
  onAllocationsChange: (allocations: PlanAllocation[]) => void;
  onAddRequest: (targetSiteId: string, targetInstanceId: string, instruction: string) => Promise<void>;
  onRemoveRequest: (requestId: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [kind, setKind] = useState<"internal" | "request">("internal");
  const [allocationDraft, setAllocationDraft] = useState({ unitId: "", instruction: "" });
  const [requestDraft, setRequestDraft] = useState({ targetSiteId: "", targetInstanceId: "", targetSiteName: "", instruction: "" });
  const [requestQuery, setRequestQuery] = useState("");
  const [requestRecipients, setRequestRecipients] = useRequestRecipientSearch({
    siteId,
    query: requestQuery,
    enabled: kind === "request",
    recipientSelected: Boolean(requestDraft.targetSiteId),
    onError,
  });
  const stepAllocations = allocations.filter((allocation) => allocation.stepId === stepId);
  const stepRequests = run.requests.filter((request) => request.stepId === stepId);

  function addAllocation() {
    if (!allocationDraft.unitId || !allocationDraft.instruction.trim()) return;
    try { onAllocationsChange(addPlanAllocation(allocations, stepId, allocationDraft.unitId, allocationDraft.instruction)); }
    catch (problem) { onError(problem instanceof Error ? problem.message : "Deloppdraget kunne ikke legges til."); return; }
    setAllocationDraft({ unitId: "", instruction: "" });
  }

  async function addRequest() {
    if (!requestDraft.targetSiteId || requestDraft.instruction.trim().length < 2) return;
    try {
      await onAddRequest(requestDraft.targetSiteId, requestDraft.targetInstanceId, requestDraft.instruction);
      setRequestDraft({ targetSiteId: "", targetInstanceId: "", targetSiteName: "", instruction: "" });
      setRequestQuery("");
    } catch (problem) {
      onError(problem instanceof Error ? problem.message : "Anmodningen kunne ikke legges til i planen.");
    }
  }

  return (
    <div className="allocation-editor">
      <h4>Fordel oppgaver og send anmodninger</h4>
      <p className="muted">Skriv alle oppgavene til én enhet under hverandre i samme deloppdrag. Legg deretter til flere enheter eller anmodninger ved behov.</p>
      <p className="muted">Deloppdragene lagres automatisk når du legger dem til eller endrer teksten.</p>
      {(stepAllocations.length > 0 || stepRequests.length > 0) && (
        <div className="planning-result">
          <h4>Dette er lagt til i planen</h4>
          <ul className="plan-allocations">
            {stepAllocations.map((allocation) => (
              <li key={`${allocation.stepId}-${allocation.unitId}`}>
                <span><strong>Deloppdrag · {units.find((unit) => unit.id === allocation.unitId)?.name ?? allocation.unitName ?? "Underenhet"}</strong><br />
                  <textarea aria-label={`Oppgaver til ${units.find((unit) => unit.id === allocation.unitId)?.name ?? "underenhet"}`} rows={Math.min(12, Math.max(3, allocation.instruction.split("\n").length + 1))} maxLength={10000} value={allocation.instruction} onChange={(event) => onAllocationsChange(allocations.map((item) => item === allocation ? { ...item, instruction: event.target.value } : item))} />
                </span>
                <button className="link-button danger" type="button" onClick={() => onAllocationsChange(allocations.filter((item) => item !== allocation))}>Fjern deloppdrag</button>
              </li>
            ))}
            {stepRequests.map((request) => (
              <li key={request.id}>
                <span><strong>Anmodning · {request.targetSiteName}</strong><br />{request.instruction}</span>
                <button className="link-button danger" type="button" onClick={() => void onRemoveRequest(request.id).catch((problem) => onError(problem instanceof Error ? problem.message : "Anmodningen kunne ikke fjernes."))}>Fjern</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="field">
        <label>Fordelingstype</label>
        <select value={kind} onChange={(event) => setKind(event.target.value as "internal" | "request")}>
          <option value="internal">Oppdrag til underenhet eller team</option>
          <option value="request">Anmodning til annen site</option>
        </select>
      </div>
      {kind === "internal" ? (
        <>
          <div className="field">
            <label>Underenhet eller team</label>
            <select value={allocationDraft.unitId} onChange={(event) => setAllocationDraft({ ...allocationDraft, unitId: event.target.value })}>
              <option value="">Velg enhet</option>
              {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Oppdrag og oppgaver til enheten</label>
            <textarea rows={7} maxLength={10000} placeholder={"Skriv alle oppgavene her, én per linje.\n1. Første oppgave\n2. Neste oppgave"} value={allocationDraft.instruction} onChange={(event) => setAllocationDraft({ ...allocationDraft, instruction: event.target.value })} />
            <ClassificationControls markings={classificationMarkings} value={allocationDraft.instruction} onChange={(instruction) => setAllocationDraft({ ...allocationDraft, instruction })} />
          </div>
          <button className="secondary-button" type="button" disabled={!allocationDraft.unitId || !allocationDraft.instruction.trim()} onClick={addAllocation}>Legg til deloppdrag</button>
        </>
      ) : (
        <>
          <div className="field">
            <label>Søk etter mottakende site</label>
            <input value={requestQuery} onChange={(event) => { setRequestQuery(event.target.value); setRequestDraft({ ...requestDraft, targetSiteId: "", targetInstanceId: "", targetSiteName: "" }); }} placeholder="Skriv minst to tegn" autoComplete="off" />
            {requestRecipients.length > 0 && (
              <div className="person-search-results" role="listbox" aria-label="Toppnivå-sites">
                {requestRecipients.map((target) => (
                  <button key={`${target.instanceId}-${target.id}`} type="button" role="option" aria-selected="false" onClick={() => { setRequestDraft({ ...requestDraft, targetSiteId: target.id, targetInstanceId: target.instanceId, targetSiteName: target.name }); setRequestQuery(target.name); setRequestRecipients([]); }}>
                    <strong>{target.name}</strong><small>Tilgjengelig mottakersite</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="field">
            <label>Oppdragstekst til mottakende site</label>
            <textarea rows={5} maxLength={2000} value={requestDraft.instruction} onChange={(event) => setRequestDraft({ ...requestDraft, instruction: event.target.value })} />
            <ClassificationControls markings={classificationMarkings} value={requestDraft.instruction} onChange={(instruction) => setRequestDraft({ ...requestDraft, instruction })} />
          </div>
          <button className="secondary-button" type="button" disabled={!requestDraft.targetSiteId || requestDraft.instruction.trim().length < 2} onClick={() => void addRequest()}>Legg til anmodning</button>
        </>
      )}
    </div>
  );
}
