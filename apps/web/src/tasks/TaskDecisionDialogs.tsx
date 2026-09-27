import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { ClassificationControls, type ClassificationMarking } from "../components/ClassificationControls";
import { Modal } from "../components/Modal";
import type { TaskUnit } from "../work/WorkContextModels";
import type { WorkItem } from "../work/WorkItemModels";

export type PlanDecision = { runId: string; item: WorkItem; action: "replan" | "hold" | "reject"; note: string };
export type TaskDecision = { item: WorkItem; status: "assigned" | "on_hold" | "rejected" | "cancelled" };
export type ReviewDecision = { item: WorkItem; priority: string };

export function PlanDecisionDialog({ decision, setDecision, markings, busy, dependencyReason, dependencyPicker, onSubmit }: { decision: PlanDecision; setDecision: Dispatch<SetStateAction<PlanDecision | null>>; markings: ClassificationMarking[]; busy: boolean; dependencyReason?: boolean; dependencyPicker?: ReactNode; onSubmit: (event: FormEvent) => void }) {
  return <Modal title={decision.action === "replan" ? "Tilbake til planlegging" : decision.action === "hold" ? "Sett oppdraget på vent" : "Avvis oppdrag"} onClose={() => setDecision(null)}>
    <form className="stacked-form" onSubmit={onSubmit}><div className="field">
      <label>{decision.action === "replan" ? "Korrigeringer planleggeren skal innarbeide" : "Begrunnelse"}</label>
      <textarea required={!dependencyReason} maxLength={2000} rows={5} value={decision.note} onChange={event => setDecision({ ...decision, note: event.target.value })} />
      <ClassificationControls value={decision.note} onChange={note => setDecision({ ...decision, note })} markings={markings} />
    </div>{decision.action === "hold" && dependencyPicker}<div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setDecision(null)}>Avbryt</button><button className={decision.action === "reject" ? "danger-button" : "primary-button"} disabled={busy || !decision.note.trim() && !dependencyReason}>Bekreft</button></div></form>
  </Modal>;
}

export function TaskDecisionDialog({ decision, unitId, setUnitId, note, setNote, units, markings, busy, dependencyReason, dependencyPicker, onClose, onSubmit }: { decision: TaskDecision; unitId: string; setUnitId: (value: string) => void; note: string; setNote: (value: string) => void; units: Array<TaskUnit & { depth: number }>; markings: ClassificationMarking[]; busy: boolean; dependencyReason?: boolean; dependencyPicker?: ReactNode; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  const title=decision.status === "assigned" ? "Godkjenn og fordel" : decision.status === "on_hold" ? "Sett på vent" : decision.status === "cancelled" ? decision.item.isOutgoingRequest ? "Trekk anmodningen" : "Kanseller hele oppdragskjeden" : "Avvis oppgave";
  return <Modal title={title} onClose={onClose}><form className="stacked-form" onSubmit={onSubmit}>
    <p><strong>{decision.item.title}</strong></p>
    {decision.status === "cancelled" && <p className="status-message error-message">{decision.item.isOutgoingRequest ? "Mottaker varsles om at anmodningen er trukket. Mottakers behandling og historikk beholdes frem til mottaker kvitterer og fullfører." : "Hovedoppdraget og alle oppdrag under det kanselleres på alle nivåer. Planer og historikk beholdes."}</p>}
    {decision.status === "assigned" ? <div className="field"><label htmlFor="decision-unit">Ansvarlig enhet</label><select id="decision-unit" required value={unitId} onChange={event => setUnitId(event.target.value)}>{units.map(unit => <option key={unit.id} value={unit.id}>{`${"— ".repeat(unit.depth)}${unit.name}`}</option>)}</select></div> : <><div className="field"><label htmlFor="decision-note">Begrunnelse{decision.status === "on_hold" ? " (valgfri når avhengighet velges)" : ""}</label><textarea id="decision-note" required={!dependencyReason} rows={4} value={note} onChange={event => setNote(event.target.value)} /><ClassificationControls value={note} onChange={setNote} markings={markings} /></div>{decision.status === "on_hold" && dependencyPicker}</>}
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Avbryt</button><button className={decision.status === "cancelled" ? "danger-button" : "primary-button"} disabled={busy || (decision.status === "assigned" ? !unitId : !note.trim() && !dependencyReason)}>Bekreft</button></div>
  </form></Modal>;
}

export function ReviewDecisionDialog({ decision, setDecision, busy, onSubmit }: { decision: ReviewDecision; setDecision: Dispatch<SetStateAction<ReviewDecision | null>>; busy: boolean; onSubmit: (event: FormEvent) => void }) {
  return <Modal title="Ta oppdraget til vurdering" onClose={() => setDecision(null)}><form className="stacked-form" onSubmit={onSubmit}>
    <p><strong>{decision.item.title}</strong></p>
    {!decision.item.parentWorkItemId && decision.item.recommendation && <div className="task-recommendation"><strong>Anbefaling</strong><p>{decision.item.recommendation}</p></div>}
    <div className="field"><label htmlFor="review-priority">Lederprioritet</label><select id="review-priority" value={decision.priority} onChange={event => setDecision({ ...decision, priority: event.target.value })}><option value="low">Lav</option><option value="normal">Normal</option><option value="high">Høy</option><option value="critical">Kritisk</option></select></div>
    <p className="muted modal-note">Prioriteten fastsettes nå og følger oppdraget videre gjennom planlegging, utførelse og eventuell fordeling.</p>
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setDecision(null)}>Avbryt</button><button className="primary-button" disabled={busy}>Ta til vurdering</button></div>
  </form></Modal>;
}
