import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Modal } from "../components/Modal";
import type { WorkItemType } from "../work/WorkItemModels";

export type TaskLookupDraft = { id: string; name: string; isActive: boolean };

export function TaskTypeManagerDialog({
  form,
  setForm,
  types,
  busy,
  onClose,
  onSubmit,
}: {
  form: TaskLookupDraft;
  setForm: Dispatch<SetStateAction<TaskLookupDraft>>;
  types: WorkItemType[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal title="Oppgavetyper" onClose={onClose}>
      <form className="stacked-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="work-type-name">Navn</label>
          <input id="work-type-name" required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </div>
        {form.id && (
          <label className="checkbox-field">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Aktiv oppgavetype
          </label>
        )}
        <button className="primary-button" disabled={busy}>{form.id ? "Lagre type" : "Opprett type"}</button>
      </form>
      <section className="type-list">
        <h3>Forvaltede typer</h3>
        {types.map((type) => (
          <div className="type-row" key={type.id}>
            <span>
              <strong>{type.name}</strong>
              <small className="muted">{type.isActive ? "Aktiv" : "Deaktivert"}{type.inUse ? " · i bruk" : ""}</small>
            </span>
            {type.isSystemManaged ? (
              <span className="muted">Systemstyrt</span>
            ) : (
              <button className="link-button" type="button" onClick={() => setForm({ id: type.id, name: type.name, isActive: type.isActive })}>Rediger</button>
            )}
          </div>
        ))}
      </section>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Lukk</button></div>
    </Modal>
  );
}

export function TaskLookupManagerDialog({
  kind,
  form,
  setForm,
  values,
  busy,
  onClose,
  onSubmit,
}: {
  kind: "source-type" | "sender";
  form: TaskLookupDraft;
  setForm: Dispatch<SetStateAction<TaskLookupDraft>>;
  values: WorkItemType[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal title={kind === "source-type" ? "Kildetyper" : "Avsendere"} onClose={onClose}>
      <form className="stacked-form" onSubmit={onSubmit}>
        <div className="field">
          <label>Navn</label>
          <input required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </div>
        {form.id && (
          <label className="checkbox-field">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Aktiv
          </label>
        )}
        <button className="primary-button" disabled={busy}>{form.id ? "Lagre" : "Opprett"}</button>
      </form>
      <section className="type-list">
        <h3>Forvaltede verdier</h3>
        {values.map((value) => (
          <div className="type-row" key={value.id}>
            <span>
              <strong>{value.name}</strong>
              <small className="muted">{value.isActive ? "Aktiv" : "Deaktivert"}{value.inUse ? " · i bruk" : ""}</small>
            </span>
            <button className="link-button" type="button" onClick={() => setForm({ id: value.id, name: value.name, isActive: value.isActive })}>Rediger</button>
          </div>
        ))}
      </section>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Lukk</button></div>
    </Modal>
  );
}
