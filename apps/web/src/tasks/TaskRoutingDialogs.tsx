import type { Dispatch, FormEvent, SetStateAction } from "react";
import { ClassificationControls, type ClassificationMarking } from "../components/ClassificationControls";
import { Modal } from "../components/Modal";
import type { TaskUnit } from "../work/WorkContextModels";
import type { WorkItem } from "../work/WorkItemModels";
import type { RequestRecipient } from "../work/useRequestRecipientSearch";

export type TaskDelegationDraft = { item: WorkItem; assignedUnitId: string; instruction: string };
export type TaskSideRequestDraft = { item: Pick<WorkItem, "id" | "title" | "assignedUnitId">; targetSiteId: string; targetInstanceId: string; targetUnitId: string; title: string; description: string };
export type TaskReassignmentDraft = { item: WorkItem; assignedUnitId: string };

export function TaskDelegationDialog({ draft, setDraft, units, markings, busy, onClose, onSubmit }: {
  draft: TaskDelegationDraft;
  setDraft: Dispatch<SetStateAction<TaskDelegationDraft | null>>;
  units: TaskUnit[];
  markings: ClassificationMarking[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <Modal title="Route onward to subordinate unit" onClose={onClose}>
    <form className="stacked-form" onSubmit={onSubmit}>
      <p><strong>{draft.item.title}</strong></p>
      <div className="field">
        <label htmlFor="delegate-unit">Receiving subordinate unit</label>
        <select id="delegate-unit" required value={draft.assignedUnitId} onChange={(event) => setDraft({ ...draft, assignedUnitId: event.target.value })}>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="delegate-instruction">Task</label>
        <textarea id="delegate-instruction" required minLength={2} maxLength={10000} rows={6} value={draft.instruction} onChange={(event) => setDraft({ ...draft, instruction: event.target.value })} />
        <ClassificationControls markings={markings} value={draft.instruction} onChange={(instruction) => setDraft({ ...draft, instruction })} />
      </div>
      <p className="muted modal-note">A separate subtask is created. Source link, type, priority, and due date are carried forward.</p>
      <div className="modal-actions">
        <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-button" disabled={busy || !draft.assignedUnitId || draft.instruction.trim().length < 2}>Allocate task</button>
      </div>
    </form>
  </Modal>;
}

export function TaskSideRequestDialog({ draft, setDraft, recipientQuery, setRecipientQuery, recipients, clearRecipients, markings, busy, onClose, onSubmit }: {
  draft: TaskSideRequestDraft;
  setDraft: Dispatch<SetStateAction<TaskSideRequestDraft | null>>;
  recipientQuery: string;
  setRecipientQuery: (value: string) => void;
  recipients: RequestRecipient[];
  clearRecipients: () => void;
  markings: ClassificationMarking[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <Modal title="Send request" onClose={onClose}>
    <form className="stacked-form" onSubmit={onSubmit}>
      <p className="muted">The request becomes a separate branch under the task. For an internal recipient, the full task basis follows the site's ordinary access rules; across a site boundary, only the official basis and response are shared.</p>
      <div className="field">
        <label htmlFor="side-request-recipient">Recipient</label>
        <input id="side-request-recipient" autoComplete="off" placeholder={draft.item.assignedUnitId ? "Search for work level or site" : "Search for site"} value={recipientQuery} onChange={(event) => { setRecipientQuery(event.target.value); setDraft({ ...draft, targetSiteId: "", targetInstanceId: "", targetUnitId: "" }); }} />
        {recipients.length > 0 && !draft.targetSiteId && !draft.targetUnitId && <div className="person-search-results" role="listbox">
          {recipients.map((recipient) => <button key={`${recipient.kind}-${recipient.instanceId}-${recipient.id}`} type="button" role="option" onClick={() => { setDraft({ ...draft, targetSiteId: recipient.kind === "site" ? recipient.id : "", targetInstanceId: recipient.instanceId, targetUnitId: recipient.kind === "unit" ? recipient.id : "" }); setRecipientQuery(recipient.name); clearRecipients(); }}><strong>{recipient.name}</strong><small>{recipient.kind === "unit" ? "Work level in the same site" : "External top-level site"}</small></button>)}
        </div>}
      </div>
      <div className="field"><label htmlFor="side-request-title">Tittel</label><input id="side-request-title" required minLength={2} maxLength={200} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></div>
      <div className="field"><label htmlFor="side-request-description">Request</label><textarea id="side-request-description" required minLength={2} maxLength={10000} rows={7} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /><ClassificationControls markings={markings} value={draft.description} onChange={(description) => setDraft({ ...draft, description })} /></div>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy || (!draft.targetSiteId && !draft.targetUnitId) || draft.title.trim().length < 2 || draft.description.trim().length < 2}>Send request</button></div>
    </form>
  </Modal>;
}

export function TaskReassignmentDialog({ draft, setDraft, units, busy, onClose, onSubmit }: {
  draft: TaskReassignmentDraft;
  setDraft: Dispatch<SetStateAction<TaskReassignmentDraft | null>>;
  units: TaskUnit[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <Modal title="Reassign task" onClose={onClose}>
    <form className="stacked-form" onSubmit={onSubmit}>
      <p><strong>{draft.item.title}</strong></p>
      <div className="field">
        <label htmlFor="reassign-unit">New receiving subordinate unit</label>
        <select id="reassign-unit" required value={draft.assignedUnitId} onChange={(event) => setDraft({ ...draft, assignedUnitId: event.target.value })}>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select>
      </div>
      <p className="muted modal-note">Previous processing is retained as history. A new subtask is created. If the same subordinate unit is selected, any final report is carried forward as a draft that must be approved again.</p>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy || !draft.assignedUnitId}>Omfordel</button></div>
    </form>
  </Modal>;
}
