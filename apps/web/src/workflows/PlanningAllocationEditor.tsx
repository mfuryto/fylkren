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
    catch (problem) { onError(problem instanceof Error ? problem.message : "The subtask could not be added."); return; }
    setAllocationDraft({ unitId: "", instruction: "" });
  }

  async function addRequest() {
    if (!requestDraft.targetSiteId || requestDraft.instruction.trim().length < 2) return;
    try {
      await onAddRequest(requestDraft.targetSiteId, requestDraft.targetInstanceId, requestDraft.instruction);
      setRequestDraft({ targetSiteId: "", targetInstanceId: "", targetSiteName: "", instruction: "" });
      setRequestQuery("");
    } catch (problem) {
      onError(problem instanceof Error ? problem.message : "The request could not be added to the plan.");
    }
  }

  return (
    <div className="allocation-editor">
      <h4>Allocate tasks and send requests</h4>
      <p className="muted">Enter all tasks for one unit together in the same subtask. Then add more units or requests as needed.</p>
      <p className="muted">Subtasks are saved automatically when you add them or change their text.</p>
      {(stepAllocations.length > 0 || stepRequests.length > 0) && (
        <div className="planning-result">
          <h4>Added to the plan</h4>
          <ul className="plan-allocations">
            {stepAllocations.map((allocation) => (
              <li key={`${allocation.stepId}-${allocation.unitId}`}>
                <span><strong>Deloppdrag · {units.find((unit) => unit.id === allocation.unitId)?.name ?? allocation.unitName ?? "Underenhet"}</strong><br />
                  <textarea aria-label={`Tasks for ${units.find((unit) => unit.id === allocation.unitId)?.name ?? "subordinate unit"}`} rows={Math.min(12, Math.max(3, allocation.instruction.split("\n").length + 1))} maxLength={10000} value={allocation.instruction} onChange={(event) => onAllocationsChange(allocations.map((item) => item === allocation ? { ...item, instruction: event.target.value } : item))} />
                </span>
                <button className="link-button danger" type="button" onClick={() => onAllocationsChange(allocations.filter((item) => item !== allocation))}>Remove deloppdrag</button>
              </li>
            ))}
            {stepRequests.map((request) => (
              <li key={request.id}>
                <span><strong>Request · {request.targetSiteName}</strong><br />{request.instruction}</span>
                <button className="link-button danger" type="button" onClick={() => void onRemoveRequest(request.id).catch((problem) => onError(problem instanceof Error ? problem.message : "The request could not be removed."))}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="field">
        <label>Fordelingstype</label>
        <select value={kind} onChange={(event) => setKind(event.target.value as "internal" | "request")}>
          <option value="internal">Task for subordinate unit or team</option>
          <option value="request">Request to annen site</option>
        </select>
      </div>
      {kind === "internal" ? (
        <>
          <div className="field">
            <label>Subordinate unit or team</label>
            <select value={allocationDraft.unitId} onChange={(event) => setAllocationDraft({ ...allocationDraft, unitId: event.target.value })}>
              <option value="">Select enhet</option>
              {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Task and instructions for the unit</label>
            <textarea rows={7} maxLength={10000} placeholder={"Write all tasks here, one per line.\n1. First task\n2. Next task"} value={allocationDraft.instruction} onChange={(event) => setAllocationDraft({ ...allocationDraft, instruction: event.target.value })} />
            <ClassificationControls markings={classificationMarkings} value={allocationDraft.instruction} onChange={(instruction) => setAllocationDraft({ ...allocationDraft, instruction })} />
          </div>
          <button className="secondary-button" type="button" disabled={!allocationDraft.unitId || !allocationDraft.instruction.trim()} onClick={addAllocation}>Add subtask</button>
        </>
      ) : (
        <>
          <div className="field">
            <label>Search for receiving site</label>
            <input value={requestQuery} onChange={(event) => { setRequestQuery(event.target.value); setRequestDraft({ ...requestDraft, targetSiteId: "", targetInstanceId: "", targetSiteName: "" }); }} placeholder="Enter at least two characters" autoComplete="off" />
            {requestRecipients.length > 0 && (
              <div className="person-search-results" role="listbox" aria-label="Top-level sites">
                {requestRecipients.map((target) => (
                  <button key={`${target.instanceId}-${target.id}`} type="button" role="option" aria-selected="false" onClick={() => { setRequestDraft({ ...requestDraft, targetSiteId: target.id, targetInstanceId: target.instanceId, targetSiteName: target.name }); setRequestQuery(target.name); setRequestRecipients([]); }}>
                    <strong>{target.name}</strong><small>Togjengelig recipientsite</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="field">
            <label>Task text for receiving site</label>
            <textarea rows={5} maxLength={2000} value={requestDraft.instruction} onChange={(event) => setRequestDraft({ ...requestDraft, instruction: event.target.value })} />
            <ClassificationControls markings={classificationMarkings} value={requestDraft.instruction} onChange={(instruction) => setRequestDraft({ ...requestDraft, instruction })} />
          </div>
          <button className="secondary-button" type="button" disabled={!requestDraft.targetSiteId || requestDraft.instruction.trim().length < 2} onClick={() => void addRequest()}>Add request</button>
        </>
      )}
    </div>
  );
}
