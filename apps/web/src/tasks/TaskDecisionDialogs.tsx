import { translateActive } from "../localization";
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { ClassificationControls, type ClassificationMarking } from "../components/ClassificationControls";
import { Modal } from "../components/Modal";
import type { TaskUnit } from "../work/WorkContextModels";
import type { WorkItem } from "../work/WorkItemModels";

export type PlanDecision = { runId: string; item: WorkItem; action: "replan" | "hold" | "reject"; note: string };
export type TaskDecision = { item: WorkItem; status: "assigned" | "on_hold" | "rejected" | "cancelled" };
export type ReviewDecision = { item: WorkItem; priority: string };

export function PlanDecisionDialog({ decision, setDecision, markings, busy, dependencyReason, dependencyPicker, onSubmit }: { decision: PlanDecision; setDecision: Dispatch<SetStateAction<PlanDecision | null>>; markings: ClassificationMarking[]; busy: boolean; dependencyReason?: boolean; dependencyPicker?: ReactNode; onSubmit: (event: FormEvent) => void }) {
  return <Modal title={decision.action === "replan" ? translateActive("tasksTaskDecisionDialogsReturnToPlanning") : decision.action === "hold" ? translateActive("tasksTaskDecisionDialogsPutTheTaskOnHold") : translateActive("tasksTaskDecisionDialogsRejectTask")} onClose={() => setDecision(null)}>
    <form className="stacked-form" onSubmit={onSubmit}><div className="field">
      <label>{decision.action === "replan" ? translateActive("tasksTaskDecisionDialogsCorrectionsForThePlannerToIncorporate") : translateActive("approvalRationale")}</label>
      <textarea required={!dependencyReason} maxLength={2000} rows={5} value={decision.note} onChange={event => setDecision({ ...decision, note: event.target.value })} />
      <ClassificationControls value={decision.note} onChange={note => setDecision({ ...decision, note })} markings={markings} />
    </div>{decision.action === "hold" && dependencyPicker}<div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setDecision(null)}>{translateActive("cancel")}</button><button className={decision.action === "reject" ? "danger-button" : "primary-button"} disabled={busy || !decision.note.trim() && !dependencyReason}>{translateActive("tasksTaskDecisionDialogsConfirm")}</button></div></form>
  </Modal>;
}

export function TaskDecisionDialog({ decision, unitId, setUnitId, note, setNote, units, markings, busy, dependencyReason, dependencyPicker, onClose, onSubmit }: { decision: TaskDecision; unitId: string; setUnitId: (value: string) => void; note: string; setNote: (value: string) => void; units: Array<TaskUnit & { depth: number }>; markings: ClassificationMarking[]; busy: boolean; dependencyReason?: boolean; dependencyPicker?: ReactNode; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  const title=decision.status === "assigned" ? translateActive("tasksTaskActionPanelsApproveAndAllocate") : decision.status === "on_hold" ? translateActive("tasksTaskDecisionDialogsPutOnHold") : decision.status === "cancelled" ? decision.item.isOutgoingRequest ? translateActive("tasksTaskDecisionDialogsWithdrawRequest") : translateActive("tasksTaskDecisionDialogsCancelTheEntireTaskChain") : translateActive("tasksTaskDecisionDialogsRejectTask");
  return <Modal title={title} onClose={onClose}><form className="stacked-form" onSubmit={onSubmit}>
    <p><strong>{decision.item.title}</strong></p>
    {decision.status === "cancelled" && <p className="status-message error-message">{decision.item.isOutgoingRequest ? translateActive("tasksTaskDecisionDialogsTheRecipientIsNotifiedThatThe") : translateActive("tasksTaskDecisionDialogsThePrimaryTaskAndAllSubordinate")}</p>}
    {decision.status === "assigned" ? <div className="field"><label htmlFor="decision-unit">{translateActive("tasksTaskDecisionDialogsResponsibleUnit")}</label><select id="decision-unit" required value={unitId} onChange={event => setUnitId(event.target.value)}>{units.map(unit => <option key={unit.id} value={unit.id}>{`${"— ".repeat(unit.depth)}${unit.name}`}</option>)}</select></div> : <><div className="field"><label htmlFor="decision-note">{translateActive("approvalRationale")}{decision.status === "on_hold" ? translateActive("tasksTaskDecisionDialogsOptionalWhenADependencyIsSelected") : ""}</label><textarea id="decision-note" required={!dependencyReason} rows={4} value={note} onChange={event => setNote(event.target.value)} /><ClassificationControls value={note} onChange={setNote} markings={markings} /></div>{decision.status === "on_hold" && dependencyPicker}</>}
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>{translateActive("cancel")}</button><button className={decision.status === "cancelled" ? "danger-button" : "primary-button"} disabled={busy || (decision.status === "assigned" ? !unitId : !note.trim() && !dependencyReason)}>{translateActive("tasksTaskDecisionDialogsConfirm")}</button></div>
  </form></Modal>;
}

export function ReviewDecisionDialog({ decision, setDecision, busy, onSubmit }: { decision: ReviewDecision; setDecision: Dispatch<SetStateAction<ReviewDecision | null>>; busy: boolean; onSubmit: (event: FormEvent) => void }) {
  return <Modal title={translateActive("tasksTaskDecisionDialogsMoveTaskToAssessment")} onClose={() => setDecision(null)}><form className="stacked-form" onSubmit={onSubmit}>
    <p><strong>{decision.item.title}</strong></p>
    {!decision.item.parentWorkItemId && decision.item.recommendation && <div className="task-recommendation"><strong>{translateActive("tasksTaskDecisionDialogsRecommendation")}</strong><p>{decision.item.recommendation}</p></div>}
    <div className="field"><label htmlFor="review-priority">{translateActive("tasksTaskDecisionDialogsManagerPriority")}</label><select id="review-priority" value={decision.priority} onChange={event => setDecision({ ...decision, priority: event.target.value })}><option value="low">{translateActive("priorityLow")}</option><option value="normal">{translateActive("priorityNormal")}</option><option value="high">{translateActive("priorityHigh")}</option><option value="critical">{translateActive("priorityCritical")}</option></select></div>
    <p className="muted modal-note">{translateActive("tasksTaskDecisionDialogsPriorityIsSetNowAndFollows")}</p>
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setDecision(null)}>{translateActive("cancel")}</button><button className="primary-button" disabled={busy}>{translateActive("actionTakeUnderReview")}</button></div>
  </form></Modal>;
}
