import { translateActive } from "../localization";
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
  primaryDocument: File | null;
  usePrimaryDocumentForAi: boolean;
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
  primaryDocument: null,
  usePrimaryDocumentForAi: true,
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
  aiEnabled: boolean;
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
  aiEnabled,
  onClose,
  onSubmit,
}: Props) {
  const update = (change: Partial<TaskCreateDraft>) =>
    setForm((current) => ({ ...current, ...change }));

  return (
    <Modal title={translateActive("tasksTaskCreateDialogRegisterTask")} onClose={onClose}>
      <form className="stacked-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="task-title">{translateActive("approvalTitle")}</label>
          <input id="task-title" required minLength={2} maxLength={200} value={form.title} onChange={(event) => update({ title: event.target.value })} />
          <ClassificationControls markings={classificationMarkings} value={form.title} onChange={(title) => update({ title })} />
        </div>
        <div className="field">
          <label htmlFor="task-type">{translateActive("taskTypeLabel")}</label>
          <select id="task-type" value={form.workItemTypeId} onChange={(event) => update({ workItemTypeId: event.target.value, targetSiteId: "", targetInstanceId: "", targetUnitId: "" })}>
            <option value="">{translateActive("tasksTaskCreateDialogNoneType")}</option>
            {types.filter((type) => type.isActive).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </div>
        {requestTypeSelected && (
          <div className="field">
            <label htmlFor="request-recipient-site">{translateActive("tasksTaskCreateDialogRecipient")}</label>
            <input
              id="request-recipient-site"
              type="search"
              autoComplete="off"
              required
              placeholder={selectedUnitId ? translateActive("tasksTaskCreateDialogSearchForWorkLevelOrSite") : translateActive("tasksTaskCreateDialogSearchForSite")}
              value={recipientQuery}
              onChange={(event) => {
                setRecipientQuery(event.target.value);
                update({ targetSiteId: "", targetInstanceId: "", targetUnitId: "" });
              }}
            />
            {recipients.length > 0 && !form.targetSiteId && !form.targetUnitId && (
              <div className="person-search-results" role="listbox" aria-label={translateActive("recipientsLabel")}>
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
                    <small>{recipient.kind === "unit" ? translateActive("tasksTaskCreateDialogWorkLevelInTheSameSite") : translateActive("tasksTaskCreateDialogExternalTopLevelSite")}</small>
                  </button>
                ))}
              </div>
            )}
            {(form.targetSiteId || form.targetUnitId) && (
              <small className="muted">
                {form.targetUnitId
                  ? translateActive("tasksTaskCreateDialogInternalRequestTheCompleteTaskBasis")
                  : translateActive("tasksTaskCreateDialogTheRequestIsSentDirectlyTo")}
              </small>
            )}
          </div>
        )}
        <div className="field">
          <label htmlFor="task-description">{translateActive("approvalDescription")}</label>
          <div className="form-row">
            <div className="field">
              <label htmlFor="task-source-type">{translateActive("tasksTaskCreateDialogSourceType")}</label>
              <select id="task-source-type" value={form.sourceTypeId} onChange={(event) => update({ sourceTypeId: event.target.value })}>
                <option value="">{translateActive("tasksTaskCreateDialogNoSourceType")}</option>
                {sourceTypes.filter((value) => value.isActive).map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="task-sender">{translateActive("tasksTaskClassifiersSender")}</label>
              <select id="task-sender" value={form.senderId} onChange={(event) => update({ senderId: event.target.value })}>
                <option value="">{translateActive("tasksTaskCreateDialogNoSender")}</option>
                {senders.filter((value) => value.isActive).map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
              </select>
            </div>
          </div>
          <textarea id="task-description" rows={5} maxLength={10000} value={form.description} onChange={(event) => update({ description: event.target.value })} />
          <ClassificationControls markings={classificationMarkings} value={form.description} onChange={(description) => update({ description })} />
        </div>
        <div className="field">
          <label htmlFor="task-recommendation">{translateActive("tasksTaskCreateDialogRecommendationOptional")}</label>
          <textarea id="task-recommendation" rows={4} maxLength={4000} placeholder={translateActive("tasksTaskCreateDialogProposeFurtherActionForTheManager")} value={form.recommendation} onChange={(event) => update({ recommendation: event.target.value })} />
          <ClassificationControls markings={classificationMarkings} value={form.recommendation} onChange={(recommendation) => update({ recommendation })} />
        </div>
        <div className="field">
          <label htmlFor="task-reference">{translateActive("tasksTaskCreateDialogLinkToPrimaryDocumentOrTask")}</label>
          <input id="task-reference" type="url" maxLength={2048} placeholder={translateActive("tasksTaskCreateDialogHttpsSharepointOrFileServerFolder")} value={form.referenceUrl} onChange={(event) => update({ referenceUrl: event.target.value })} />
        </div>
        {aiEnabled && <section className="site-detail-block primary-document-import"><h3>{translateActive("primaryDocumentImport")}</h3>
          <div className="field"><label htmlFor="task-primary-document">{translateActive("tasksTaskClassifiersPrimaryDocument")}</label><input id="task-primary-document" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={event => update({ primaryDocument: event.target.files?.[0] ?? null })}/><small>{translateActive("primaryDocumentImportHelp")}</small></div>
          {form.primaryDocument && <label className="checkbox-row"><input type="checkbox" checked={form.usePrimaryDocumentForAi} onChange={event => update({ usePrimaryDocumentForAi: event.target.checked })}/><span>{translateActive("primaryDocumentAiSource")}</span></label>}
        </section>}
        <div className="field">
          <label htmlFor="task-due">{translateActive("tasksTaskCreateDialogRequestedDueDate")}</label>
          <input id="task-due" type="date" value={form.dueAt} onChange={(event) => update({ dueAt: event.target.value })} />
        </div>
        <p className="muted modal-note">{translateActive("tasksTaskCreateDialogTheTaskIsRegisteredWithoutAn")}</p>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>{translateActive("cancel")}</button>
          <button className="primary-button" disabled={busy}>{translateActive("tasksTaskCreateDialogRegister")}</button>
        </div>
      </form>
    </Modal>
  );
}
