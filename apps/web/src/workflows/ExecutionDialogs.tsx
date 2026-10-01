import { translateActive } from "../localization";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Modal } from "../components/Modal";
import { RichTextContent } from "../components/RichText";
import type { TaskUnit } from "../work/WorkContextModels";
import type { ExecutionItem } from "./ExecutionModels";
import type { PlanningContextDetails } from "./PlanningModels";
import { StepDocumentLinks } from "./WorkflowFields";

export type ExecutionDownwardAllocation = {
  item: ExecutionItem;
  unitId: string;
  instruction: string;
};

export type ExecutionReassignment = {
  item: ExecutionItem;
  personId: string;
  candidates: Array<{ personId: string; displayName: string }>;
};

export function ExecutionDownwardAllocationDialog({
  draft,
  units,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: ExecutionDownwardAllocation;
  units: TaskUnit[];
  onChange: Dispatch<SetStateAction<ExecutionDownwardAllocation | null>>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal title={translateActive("workflowsExecutionDialogsRouteTheTaskOnward")} onClose={onClose}>
      <form className="stacked-form" onSubmit={onSubmit}>
        <p><strong>{draft.item.title}</strong></p>
        <p className="status-message">{translateActive("workflowsExecutionDialogsExecutionAtThisLevelIsClosed")}</p>
        <div className="field">
          <label htmlFor="execution-downward-unit">{translateActive("tasksTaskRoutingDialogsReceivingSubordinateUnit")}</label>
          <select id="execution-downward-unit" value={draft.unitId} onChange={(event) => onChange({ ...draft, unitId: event.target.value })}>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="execution-downward-instruction">{translateActive("workflowsExecutionDialogsTaskTextForTheSubordinateUnit")}</label>
          <textarea id="execution-downward-instruction" rows={6} maxLength={10000} value={draft.instruction} onChange={(event) => onChange({ ...draft, instruction: event.target.value })} />
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>{translateActive("cancel")}</button>
          <button className="primary-button" disabled={!draft.unitId || draft.instruction.trim().length < 2}>{translateActive("tasksTaskActionPanelsRouteOnward")}</button>
        </div>
      </form>
    </Modal>
  );
}

export function ExecutionReassignmentDialog({
  draft,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: ExecutionReassignment;
  onChange: Dispatch<SetStateAction<ExecutionReassignment | null>>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal title={translateActive("workflowsExecutionDialogsReassignExecution")} onClose={onClose}>
      <form className="stacked-form" onSubmit={onSubmit}>
        <p><strong>{draft.item.title}</strong></p>
        <div className="field">
          <label htmlFor="execution-reassignment-person">{translateActive("workflowsExecutionDialogsNewAssignee")}</label>
          <select id="execution-reassignment-person" value={draft.personId} onChange={(event) => onChange({ ...draft, personId: event.target.value })}>
            {draft.candidates.map((candidate) => <option key={candidate.personId} value={candidate.personId}>{candidate.displayName}</option>)}
          </select>
        </div>
        <p className="muted modal-note">{translateActive("workflowsExecutionDialogsCompletedStepsDocumentationTimelineAndHistory")}</p>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>{translateActive("cancel")}</button>
          <button className="primary-button" disabled={!draft.personId}>{translateActive("tasksTaskRoutingDialogsReassign")}</button>
        </div>
      </form>
    </Modal>
  );
}

export function ExecutionPlanDialog({ details, onClose }: { details: PlanningContextDetails; onClose: () => void }) {
  return (
    <Modal title={translateActive("workflowsExecutionDialogsPlanForTheTask")} onClose={onClose}>
      {details.plan ? (
        <div className="plan-presentation">
          {details.plan.steps.map((step) => (
            <section key={step.id}>
              <h3>{step.name}</h3>
              <RichTextContent value={step.content} />
              <StepDocumentLinks links={step.links ?? []} editable={false} />
            </section>
          ))}
        </div>
      ) : <p className="muted">{translateActive("workflowsExecutionDialogsTheTaskHasNoPlan")}</p>}
    </Modal>
  );
}
