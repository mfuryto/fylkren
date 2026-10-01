import type React from "react";
import { Modal } from "../components/Modal";
import { useTranslation } from "../localization/LocalizationProvider";
import type { PersonnelUnit } from "./personnelHierarchy";
import { PersonnelUnitOptions } from "./PersonnelUnitOptions";

export type LocalUserForm = {
  displayName: string;
  email: string;
  username: string;
  organizationUnitId: string;
  resetCode?: string;
};

export type RoleForm = {
  organizationUnitId: string;
  name: string;
  hasLeaderAccess: boolean;
  canPlan: boolean;
};

export function LocalUserDialog({ open, units, form, busy, onChange, onSubmit, onClose }: {
  open: boolean;
  units: PersonnelUnit[];
  form: LocalUserForm;
  busy: boolean;
  onChange: (form: LocalUserForm) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}) {
  const t = useTranslation();
  if (!open) return null;
  return <Modal title={t("addLocalUser")} onClose={onClose}>
    <form className="stacked-form" onSubmit={onSubmit}>
      {form.resetCode ? <><p>{t("localUserCreated")}</p><div className="field"><label htmlFor="new-person-reset-code">{t("oneTimeCode")}</label><input id="new-person-reset-code" readOnly value={form.resetCode} onFocus={(event) => event.currentTarget.select()} /></div></> : <>
      <div className="field"><label htmlFor="person-name">{t("name")}</label><input id="person-name" required value={form.displayName} onChange={(event) => onChange({ ...form, displayName: event.target.value })} /></div>
      <div className="field"><label htmlFor="person-email">{t("emailAddress")}</label><input id="person-email" type="email" required value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} /></div>
      <div className="field"><label htmlFor="person-username">{t("username")}</label><input id="person-username" required minLength={3} value={form.username} onChange={(event) => onChange({ ...form, username: event.target.value })} /></div>
      <div className="field">
        <label htmlFor="person-unit">{t("subunit")}</label>
        <select id="person-unit" required value={form.organizationUnitId} onChange={(event) => onChange({ ...form, organizationUnitId: event.target.value })}><PersonnelUnitOptions units={units} /></select>
        <p className="muted modal-note">{t("localUserUnitHelp")}</p>
      </div>
      <p className="muted modal-note">{t("localUserPasswordHelp")}</p></>}
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>{form.resetCode ? t("close") : t("cancel")}</button>{!form.resetCode && <button className="primary-button" disabled={busy}>{t("add")}</button>}</div>
    </form>
  </Modal>;
}

export function RoleCreateDialog({ open, units, form, busy, onChange, onSubmit, onClose }: {
  open: boolean;
  units: PersonnelUnit[];
  form: RoleForm;
  busy: boolean;
  onChange: (form: RoleForm) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}) {
  const t = useTranslation();
  if (!open) return null;
  return <Modal title={t("createWorkRole")} onClose={onClose}>
    <form className="stacked-form" onSubmit={onSubmit}>
      <div className="field"><label htmlFor="personnel-unit">{t("unit")}</label><select id="personnel-unit" required value={form.organizationUnitId} onChange={(event) => onChange({ ...form, organizationUnitId: event.target.value })}><PersonnelUnitOptions units={units} /></select></div>
      <div className="field"><label htmlFor="personnel-role-name">{t("roleName")}</label><input id="personnel-role-name" required value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} /></div>
      <label className="checkbox-field"><input type="checkbox" checked={form.hasLeaderAccess} onChange={(event) => onChange({ ...form, hasLeaderAccess: event.target.checked })} /> {t("grantLeaderAccess")}</label>
      <label className="checkbox-field"><input type="checkbox" checked={form.canPlan} onChange={(event) => onChange({ ...form, canPlan: event.target.checked })} /> {t("canPlanWork")}</label>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>{t("cancel")}</button><button className="primary-button" disabled={busy || !units.length}>{t("create")}</button></div>
    </form>
  </Modal>;
}
