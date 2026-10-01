import { Modal } from "../components/Modal";
import type { TaskUnit } from "../work/WorkContextModels";
import type { PlanningRun } from "./PlanningModels";

export type PlanningReassignmentDraft = {
  run: PlanningRun;
  candidates: Array<{ personId: string; displayName: string }>;
  personId: string;
};

export type DownwardAllocationDraft = {
  run: PlanningRun;
  unitId: string;
  instruction: string;
};

export function PlanningReassignmentDialog({ draft, onChange, onSubmit, onClose }: {
  draft: PlanningReassignmentDraft;
  onChange: (draft: PlanningReassignmentDraft) => void;
  onSubmit: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <Modal title="Reassign planning" onClose={onClose}>
      <form className="stacked-form" onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
        <p><strong>{draft.run.item.title}</strong><br /><span className="muted">Current assignee: {draft.run.claimedBy}</span></p>
        <div className="field">
          <label htmlFor="planning-reassignment-person">Ny ansvarlig planlegger</label>
          <select id="planning-reassignment-person" value={draft.personId} onChange={(event) => onChange({ ...draft, personId: event.target.value })}>
            {draft.candidates.map((candidate) => (
              <option key={candidate.personId} value={candidate.personId}>{candidate.displayName}{candidate.personId === draft.run.claimedByPersonId ? " (current)" : ""}</option>
            ))}
          </select>
          {draft.candidates.length === 0 && <p className="muted">No eligible planners exist at this level.</p>}
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={!draft.personId}>Omfordel</button>
        </div>
      </form>
    </Modal>
  );
}

export function DownwardAllocationDialog({ draft, units, onChange, onSubmit, onClose }: {
  draft: DownwardAllocationDraft;
  units: TaskUnit[];
  onChange: (draft: DownwardAllocationDraft) => void;
  onSubmit: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <Modal title="Route the task onward" onClose={onClose}>
      <form className="stacked-form" onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
        <p><strong>{draft.run.item.title}</strong></p>
        <p className="status-message">Planning at this level is closed. Documentation and history are retained, and the subordinate unit receives a new subtask.</p>
        <div className="field">
          <label htmlFor="planning-downward-unit">Receiving subordinate unit</label>
          <select id="planning-downward-unit" value={draft.unitId} onChange={(event) => onChange({ ...draft, unitId: event.target.value })}>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="planning-downward-instruction">Task text for the subordinate unit</label>
          <textarea id="planning-downward-instruction" rows={6} maxLength={10000} value={draft.instruction} onChange={(event) => onChange({ ...draft, instruction: event.target.value })} />
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={!draft.unitId || draft.instruction.trim().length < 2}>Fordel videre</button>
        </div>
      </form>
    </Modal>
  );
}
