import { translateActive } from "../localization";
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
    <Modal title={translateActive("tasksTaskLookupDialogsTaskTypes")} onClose={onClose}>
      <form className="stacked-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="work-type-name">{translateActive("name")}</label>
          <input id="work-type-name" required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </div>
        {form.id && (
          <label className="checkbox-field">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> {translateActive("tasksTaskLookupDialogsActiveTaskType")}
          </label>
        )}
        <button className="primary-button" disabled={busy}>{form.id ? translateActive("tasksTaskLookupDialogsSaveType") : translateActive("createType")}</button>
      </form>
      <section className="type-list">
        <h3>{translateActive("tasksTaskLookupDialogsManagedTypes")}</h3>
        {types.map((type) => (
          <div className="type-row" key={type.id}>
            <span>
              <strong>{type.name}</strong>
              <small className="muted">{type.isActive ? translateActive("active") : translateActive("inactive")}{type.inUse ? translateActive("inUseSuffix") : ""}</small>
            </span>
            {type.isSystemManaged ? (
              <span className="muted">{translateActive("tasksTaskLookupDialogsSystemManaged")}</span>
            ) : (
              <button className="link-button" type="button" onClick={() => setForm({ id: type.id, name: type.name, isActive: type.isActive })}>{translateActive("edit")}</button>
            )}
          </div>
        ))}
      </section>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>{translateActive("close")}</button></div>
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
    <Modal title={kind === "source-type" ? translateActive("tasksTaskLookupDialogsSourceTypes") : translateActive("tasksTaskLookupDialogsSenders")} onClose={onClose}>
      <form className="stacked-form" onSubmit={onSubmit}>
        <div className="field">
          <label>{translateActive("name")}</label>
          <input required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </div>
        {form.id && (
          <label className="checkbox-field">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> {translateActive("active")}
          </label>
        )}
        <button className="primary-button" disabled={busy}>{form.id ? translateActive("save") : translateActive("create")}</button>
      </form>
      <section className="type-list">
        <h3>{translateActive("tasksTaskLookupDialogsManagedValues")}</h3>
        {values.map((value) => (
          <div className="type-row" key={value.id}>
            <span>
              <strong>{value.name}</strong>
              <small className="muted">{value.isActive ? translateActive("active") : translateActive("inactive")}{value.inUse ? translateActive("inUseSuffix") : ""}</small>
            </span>
            <button className="link-button" type="button" onClick={() => setForm({ id: value.id, name: value.name, isActive: value.isActive })}>{translateActive("edit")}</button>
          </div>
        ))}
      </section>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>{translateActive("close")}</button></div>
    </Modal>
  );
}
