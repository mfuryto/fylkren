import type { Dispatch, FormEvent, SetStateAction } from "react";
import { ClassificationControls, type ClassificationMarking } from "../components/ClassificationControls";
import { Modal } from "../components/Modal";
import type { WorkItemType } from "../work/WorkItemModels";
import type { RequestRecipient } from "../work/useRequestRecipientSearch";

export type TaskCreateDraft = {
  title: string;
  description: string;
  recommendation: string;
  referenceUrl: string;
  workItemTypeId: string;
  sourceTypeId: string;
  senderId: string;
  targetSiteId: string;
  targetInstanceId: string;
  targetUnitId: string;
  dueAt: string;
};

export const emptyTaskCreateDraft = (): TaskCreateDraft => ({
  title: "",
  description: "",
  recommendation: "",
  referenceUrl: "",
  workItemTypeId: "",
  sourceTypeId: "",
  senderId: "",
  targetSiteId: "",
  targetInstanceId: "",
  targetUnitId: "",
  dueAt: "",
});

type Props = {
  form: TaskCreateDraft;
  setForm: Dispatch<SetStateAction<TaskCreateDraft>>;
  types: WorkItemType[];
  sourceTypes: WorkItemType[];
  senders: WorkItemType[];
  requestTypeSelected: boolean;
  recipientQuery: string;
  setRecipientQuery: (value: string) => void;
  recipients: RequestRecipient[];
  clearRecipients: () => void;
  selectedUnitId: string;
  classificationMarkings: ClassificationMarking[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function TaskCreateDialog({
  form,
  setForm,
  types,
  sourceTypes,
  senders,
  requestTypeSelected,
  recipientQuery,
  setRecipientQuery,
  recipients,
  clearRecipients,
  selectedUnitId,
  classificationMarkings,
  busy,
  onClose,
  onSubmit,
}: Props) {
  const update = (change: Partial<TaskCreateDraft>) =>
    setForm((current) => ({ ...current, ...change }));

  return (
    <Modal title="Register task" onClose={onClose}>
      <form className="stacked-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="task-title">Tittel</label>
          <input id="task-title" required minLength={2} maxLength={200} value={form.title} onChange={(event) => update({ title: event.target.value })} />
          <ClassificationControls markings={classificationMarkings} value={form.title} onChange={(title) => update({ title })} />
        </div>
        <div className="field">
          <label htmlFor="task-type">Type</label>
          <select id="task-type" value={form.workItemTypeId} onChange={(event) => update({ workItemTypeId: event.target.value, targetSiteId: "", targetInstanceId: "", targetUnitId: "" })}>
            <option value="">None type</option>
            {types.filter((type) => type.isActive).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </div>
        {requestTypeSelected && (
          <div className="field">
            <label htmlFor="request-recipient-site">Recipient</label>
            <input
              id="request-recipient-site"
              type="search"
              autoComplete="off"
              required
              placeholder={selectedUnitId ? "Search for work level or site" : "Search for site"}
              value={recipientQuery}
              onChange={(event) => {
                setRecipientQuery(event.target.value);
                update({ targetSiteId: "", targetInstanceId: "", targetUnitId: "" });
              }}
            />
            {recipients.length > 0 && !form.targetSiteId && !form.targetUnitId && (
              <div className="person-search-results" role="listbox" aria-label="Mottakere">
                {recipients.map((recipient) => (
                  <button
                    key={`${recipient.kind}-${recipient.instanceId}-${recipient.id}`}
                    type="button"
                    role="option"
                    aria-selected="false"
                    onClick={() => {
                      update({
                        targetSiteId: recipient.kind === "site" ? recipient.id : "",
                        targetInstanceId: recipient.instanceId,
                        targetUnitId: recipient.kind === "unit" ? recipient.id : "",
                      });
                      setRecipientQuery(recipient.name);
                      clearRecipients();
                    }}
                  >
                    <strong>{recipient.name}</strong>
                    <small>{recipient.kind === "unit" ? "Work level in the same site" : "External top-level site"}</small>
                  </button>
                ))}
              </div>
            )}
            {(form.targetSiteId || form.targetUnitId) && (
              <small className="muted">
                {form.targetUnitId
                  ? "Internal request: the complete task basis follows the case under ordinary access rules."
                  : "The request is sent directly to this site's top level."}
              </small>
            )}
          </div>
        )}
        <div className="field">
          <label htmlFor="task-description">Beskrivelse</label>
          <div className="form-row">
            <div className="field">
              <label htmlFor="task-source-type">Kildetype</label>
              <select id="task-source-type" value={form.sourceTypeId} onChange={(event) => update({ sourceTypeId: event.target.value })}>
                <option value="">None kildetype</option>
                {sourceTypes.filter((value) => value.isActive).map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="task-sender">Sender</label>
              <select id="task-sender" value={form.senderId} onChange={(event) => update({ senderId: event.target.value })}>
                <option value="">No sender</option>
                {senders.filter((value) => value.isActive).map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
              </select>
            </div>
          </div>
          <textarea id="task-description" rows={5} maxLength={10000} value={form.description} onChange={(event) => update({ description: event.target.value })} />
          <ClassificationControls markings={classificationMarkings} value={form.description} onChange={(description) => update({ description })} />
        </div>
        <div className="field">
          <label htmlFor="task-recommendation">Anbefaling (valgfritt)</label>
          <textarea id="task-recommendation" rows={4} maxLength={4000} placeholder="Propose further action for the manager to consider" value={form.recommendation} onChange={(event) => update({ recommendation: event.target.value })} />
          <ClassificationControls markings={classificationMarkings} value={form.recommendation} onChange={(recommendation) => update({ recommendation })} />
        </div>
        <div className="field">
          <label htmlFor="task-reference">Link to primary document or task text (optional)</label>
          <input id="task-reference" type="url" maxLength={2048} placeholder="https://sharepoint… or file://server/folder/file" value={form.referenceUrl} onChange={(event) => update({ referenceUrl: event.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="task-due">Requested due date</label>
          <input id="task-due" type="date" value={form.dueAt} onChange={(event) => update({ dueAt: event.target.value })} />
        </div>
        <p className="muted modal-note">The task is registered without an assignee and placed in the site's unallocated queue for assessment. The source link follows the task when routed onward.</p>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={busy}>Registrer</button>
        </div>
      </form>
    </Modal>
  );
}
