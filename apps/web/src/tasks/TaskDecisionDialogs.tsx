import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { ClassificationControls, type ClassificationMarking } from "../components/ClassificationControls";
import { Modal } from "../components/Modal";
import type { TaskUnit } from "../work/WorkContextModels";
import type { WorkItem } from "../work/WorkItemModels";

export type PlanDecision = { runId: string; item: WorkItem; action: "replan" | "hold" | "reject"; note: string };
export type TaskDecision = { item: WorkItem; status: "assigned" | "on_hold" | "rejected" | "cancelled" };
export type ReviewDecision = { item: WorkItem; priority: string };

export function PlanDecisionDialog({ decision, setDecision, markings, busy, dependencyReason, dependencyPicker, onSubmit }: { decision: PlanDecision; setDecision: Dispatch<SetStateAction<PlanDecision | null>>; markings: ClassificationMarking[]; busy: boolean; dependencyReason?: boolean; dependencyPicker?: ReactNode; onSubmit: (event: FormEvent) => void }) {
  return <Modal title={decision.action === "replan" ? "Return to planning" : decision.action === "hold" ? "Put the task on hold" : "Reject task"} onClose={() => setDecision(null)}>
    <form className="stacked-form" onSubmit={onSubmit}><div className="field">
      <label>{decision.action === "replan" ? "Corrections for the planner to incorporate" : "Rationale"}</label>
      <textarea required={!dependencyReason} maxLength={2000} rows={5} value={decision.note} onChange={event => setDecision({ ...decision, note: event.target.value })} />
      <ClassificationControls value={decision.note} onChange={note => setDecision({ ...decision, note })} markings={markings} />
    </div>{decision.action === "hold" && dependencyPicker}<div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setDecision(null)}>Cancel</button><button className={decision.action === "reject" ? "danger-button" : "primary-button"} disabled={busy || !decision.note.trim() && !dependencyReason}>Bekreft</button></div></form>
  </Modal>;
}

export function TaskDecisionDialog({ decision, unitId, setUnitId, note, setNote, units, markings, busy, dependencyReason, dependencyPicker, onClose, onSubmit }: { decision: TaskDecision; unitId: string; setUnitId: (value: string) => void; note: string; setNote: (value: string) => void; units: Array<TaskUnit & { depth: number }>; markings: ClassificationMarking[]; busy: boolean; dependencyReason?: boolean; dependencyPicker?: ReactNode; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  const title=decision.status === "assigned" ? "Approve and allocate" : decision.status === "on_hold" ? "Put on hold" : decision.status === "cancelled" ? decision.item.isOutgoingRequest ? "Withdraw request" : "Cancel the entire task chain" : "Reject task";
  return <Modal title={title} onClose={onClose}><form className="stacked-form" onSubmit={onSubmit}>
    <p><strong>{decision.item.title}</strong></p>
    {decision.status === "cancelled" && <p className="status-message error-message">{decision.item.isOutgoingRequest ? "The recipient is notified that the request has been withdrawn. The recipient's processing and history are retained until the recipient acknowledges and completes it." : "The primary task and all subordinate tasks are cancelled at every level. Plans and history are retained."}</p>}
    {decision.status === "assigned" ? <div className="field"><label htmlFor="decision-unit">Ansvarlig enhet</label><select id="decision-unit" required value={unitId} onChange={event => setUnitId(event.target.value)}>{units.map(unit => <option key={unit.id} value={unit.id}>{`${"— ".repeat(unit.depth)}${unit.name}`}</option>)}</select></div> : <><div className="field"><label htmlFor="decision-note">Rationale{decision.status === "on_hold" ? " (optional when a dependency is selected)" : ""}</label><textarea id="decision-note" required={!dependencyReason} rows={4} value={note} onChange={event => setNote(event.target.value)} /><ClassificationControls value={note} onChange={setNote} markings={markings} /></div>{decision.status === "on_hold" && dependencyPicker}</>}
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className={decision.status === "cancelled" ? "danger-button" : "primary-button"} disabled={busy || (decision.status === "assigned" ? !unitId : !note.trim() && !dependencyReason)}>Bekreft</button></div>
  </form></Modal>;
}

export function ReviewDecisionDialog({ decision, setDecision, busy, onSubmit }: { decision: ReviewDecision; setDecision: Dispatch<SetStateAction<ReviewDecision | null>>; busy: boolean; onSubmit: (event: FormEvent) => void }) {
  return <Modal title="Move task to assessment" onClose={() => setDecision(null)}><form className="stacked-form" onSubmit={onSubmit}>
    <p><strong>{decision.item.title}</strong></p>
    {!decision.item.parentWorkItemId && decision.item.recommendation && <div className="task-recommendation"><strong>Anbefaling</strong><p>{decision.item.recommendation}</p></div>}
    <div className="field"><label htmlFor="review-priority">Lederprioritet</label><select id="review-priority" value={decision.priority} onChange={event => setDecision({ ...decision, priority: event.target.value })}><option value="low">Lav</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Kritisk</option></select></div>
    <p className="muted modal-note">Priority is set now and follows the task through planning, execution, and any allocation.</p>
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setDecision(null)}>Cancel</button><button className="primary-button" disabled={busy}>Move to assessment</button></div>
  </form></Modal>;
}
