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
    <Modal title="Registrer oppgave" onClose={onClose}>
      <form className="stacked-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="task-title">Tittel</label>
          <input id="task-title" required minLength={2} maxLength={200} value={form.title} onChange={(event) => update({ title: event.target.value })} />
          <ClassificationControls markings={classificationMarkings} value={form.title} onChange={(title) => update({ title })} />
        </div>
        <div className="field">
          <label htmlFor="task-type">Type</label>
          <select id="task-type" value={form.workItemTypeId} onChange={(event) => update({ workItemTypeId: event.target.value, targetSiteId: "", targetInstanceId: "", targetUnitId: "" })}>
            <option value="">Ingen type</option>
            {types.filter((type) => type.isActive).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </div>
        {requestTypeSelected && (
          <div className="field">
            <label htmlFor="request-recipient-site">Mottaker</label>
            <input
              id="request-recipient-site"
              type="search"
              autoComplete="off"
              required
              placeholder={selectedUnitId ? "Søk etter arbeidsnivå eller site" : "Søk etter site"}
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
                    <small>{recipient.kind === "unit" ? "Arbeidsnivå i samme site" : "Ekstern toppnivå-site"}</small>
                  </button>
                ))}
              </div>
            )}
            {(form.targetSiteId || form.targetUnitId) && (
              <small className="muted">
                {form.targetUnitId
                  ? "Intern anmodning: hele oppdragsgrunnlaget følger saken etter ordinære tilgangsregler."
                  : "Anmodningen sendes direkte til denne sitens toppnivå."}
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
                <option value="">Ingen kildetype</option>
                {sourceTypes.filter((value) => value.isActive).map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="task-sender">Avsender</label>
              <select id="task-sender" value={form.senderId} onChange={(event) => update({ senderId: event.target.value })}>
                <option value="">Ingen avsender</option>
                {senders.filter((value) => value.isActive).map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
              </select>
            </div>
          </div>
          <textarea id="task-description" rows={5} maxLength={10000} value={form.description} onChange={(event) => update({ description: event.target.value })} />
          <ClassificationControls markings={classificationMarkings} value={form.description} onChange={(description) => update({ description })} />
        </div>
        <div className="field">
          <label htmlFor="task-recommendation">Anbefaling (valgfritt)</label>
          <textarea id="task-recommendation" rows={4} maxLength={4000} placeholder="Foreslå videre handling som leder kan ta stilling til" value={form.recommendation} onChange={(event) => update({ recommendation: event.target.value })} />
          <ClassificationControls markings={classificationMarkings} value={form.recommendation} onChange={(recommendation) => update({ recommendation })} />
        </div>
        <div className="field">
          <label htmlFor="task-reference">Lenke til hoveddokument eller oppdragstekst (valgfritt)</label>
          <input id="task-reference" type="url" maxLength={2048} placeholder="https://sharepoint… eller file://server/mappe/fil" value={form.referenceUrl} onChange={(event) => update({ referenceUrl: event.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="task-due">Ønsket frist</label>
          <input id="task-due" type="date" value={form.dueAt} onChange={(event) => update({ dueAt: event.target.value })} />
        </div>
        <p className="muted modal-note">Oppgaven registreres uten ansvarlig og legges i sitens ufordelte kø for vurdering. Kildelenken følger oppgaven ved viderefordeling.</p>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Avbryt</button>
          <button className="primary-button" disabled={busy}>Registrer</button>
        </div>
      </form>
    </Modal>
  );
}
