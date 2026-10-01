import type React from "react";
import { Modal } from "../components/Modal";
import { useTranslation } from "../localization/LocalizationProvider";
import type { DirectoryProviderSummary, DirectoryUserSummary, ExistingUserSummary, MemberSummary } from "../siteAdmin/models";
import type { PersonnelUnit } from "./personnelHierarchy";
import { PersonnelUnitOptions } from "./PersonnelUnitOptions";

export function DirectoryUserDialog({ open, localEnabled, providers, provider, query, results, selectedUser, unitId, units, busy, onProviderChange, onQueryChange, onSelectUser, onUnitChange, onSubmit, onClose }: {
  open: boolean;
  localEnabled: boolean;
  providers: DirectoryProviderSummary[];
  provider: string;
  query: string;
  results: DirectoryUserSummary[];
  selectedUser: DirectoryUserSummary | null;
  unitId: string;
  units: PersonnelUnit[];
  busy: boolean;
  onProviderChange: (provider: string) => void;
  onQueryChange: (query: string) => void;
  onSelectUser: (user: DirectoryUserSummary) => void;
  onUnitChange: (unitId: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}) {
  const t = useTranslation();
  if (!open) return null;
  return <Modal title={localEnabled ? t("addDirectoryPersonnel") : t("addUser")} onClose={onClose}>
    <form className="stacked-form" onSubmit={onSubmit}>
      {providers.length === 0 ? <p className="status-message">{t("noDirectoryProvider")}</p> : <>
        <p className="muted modal-note">{t("directoryPersonOnly")}</p>
        <div className="field"><label htmlFor="directory-provider">{t("directory")}</label><select id="directory-provider" value={provider} onChange={(event) => onProviderChange(event.target.value)}>{providers.map((value) => <option key={value.key} value={value.key}>{value.name}</option>)}</select></div>
        <div className="field">
          <label htmlFor="directory-person-search">{t("findPerson")}</label>
          <input id="directory-person-search" type="search" autoComplete="off" placeholder={t("searchPersonPlaceholder")} value={query} onChange={(event) => onQueryChange(event.target.value)} />
          {query.trim().length > 0 && query.trim().length < 2 && <p className="muted modal-note">{t("minimumTwoCharacters")}</p>}
          {results.length > 0 && !selectedUser && <div className="person-search-results" role="listbox" aria-label={t("directoryResults")}>{results.map((person) => <button key={`${person.provider}:${person.stableId}`} type="button" role="option" aria-selected="false" onClick={() => onSelectUser(person)}><strong>{person.displayName || person.username}</strong><small>{[person.username, person.email].filter(Boolean).join(" · ")}</small></button>)}</div>}
        </div>
        <div className="field"><label htmlFor="directory-person-unit">{t("subunit")}</label><select id="directory-person-unit" required value={unitId} onChange={(event) => onUnitChange(event.target.value)}><PersonnelUnitOptions units={units} /></select></div>
      </>}
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>{t("cancel")}</button>{providers.length > 0 && <button className="primary-button" disabled={busy || !selectedUser || !unitId}>{t("addPersonnel")}</button>}</div>
    </form>
  </Modal>;
}

export function ExistingUserDialog({ open, query, results, selectedUser, unitId, units, busy, onQueryChange, onSelectUser, onUnitChange, onSubmit, onClose }: {
  open: boolean;
  query: string;
  results: ExistingUserSummary[];
  selectedUser: ExistingUserSummary | null;
  unitId: string;
  units: PersonnelUnit[];
  busy: boolean;
  onQueryChange: (query: string) => void;
  onSelectUser: (user: ExistingUserSummary) => void;
  onUnitChange: (unitId: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}) {
  const t = useTranslation();
  if (!open) return null;
  return <Modal title={t("addExistingLocalUser")} onClose={onClose}>
    <form className="stacked-form" onSubmit={onSubmit}>
      <p className="muted modal-note">{t("existingLocalUserIntro")}</p>
      <div className="field">
        <label htmlFor="existing-local-user-search">{t("findUser")}</label>
        <input id="existing-local-user-search" type="search" autoComplete="off" placeholder={t("searchPersonPlaceholder")} value={query} onChange={(event) => onQueryChange(event.target.value)} />
        {query.trim().length > 0 && query.trim().length < 2 && <p className="muted modal-note">{t("minimumTwoCharacters")}</p>}
        {results.length > 0 && !selectedUser && <div className="person-search-results" role="listbox" aria-label={t("existingLocalUsers")}>{results.map((person) => <button key={person.id} type="button" role="option" onClick={() => onSelectUser(person)}><strong>{person.displayName}</strong><small>{t("emailValue", { email: person.email ?? t("notRegistered") })} · {t("usernameValue", { username: person.username })}</small></button>)}</div>}
        {selectedUser && <div className="site-detail-block"><strong>{selectedUser.displayName}</strong><dl className="detail-list"><div><dt>{t("emailAddress")}</dt><dd>{selectedUser.email ?? t("notRegistered")}</dd></div><div><dt>{t("username")}</dt><dd>{selectedUser.username}</dd></div><div><dt>{t("currentSite")}</dt><dd>{selectedUser.sites.join(", ")}</dd></div></dl></div>}
      </div>
      <div className="field"><label htmlFor="existing-local-user-unit">{t("subunitInSite")}</label><select id="existing-local-user-unit" required value={unitId} onChange={(event) => onUnitChange(event.target.value)}><PersonnelUnitOptions units={units} /></select></div>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>{t("cancel")}</button><button className="primary-button" disabled={busy || !selectedUser || !unitId}>{t("addToSite")}</button></div>
    </form>
  </Modal>;
}

export function PasswordResetDialog({ value, busy, onSubmit, onClose }: {
  value: (MemberSummary & { resetCode?: string; expiresAt?: string }) | null;
  busy: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}) {
  const t = useTranslation();
  if (!value) return null;
  return <Modal title={t("resetPassword")} onClose={onClose}>
    <form className="stacked-form" onSubmit={onSubmit}>
      {value.resetCode ? <><p>{t("resetCodeDelivery", { name: value.displayName })}</p><div className="field"><label htmlFor="reset-person-code">{t("oneTimeCode")}</label><input id="reset-person-code" readOnly value={value.resetCode} onFocus={(event) => event.currentTarget.select()} /></div></> : <p className="muted modal-note">{t("resetPasswordCodeIntro", { name: value.displayName })}</p>}
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>{value.resetCode ? t("close") : t("cancel")}</button>{!value.resetCode && <button className="primary-button" disabled={busy}>{busy ? t("creating") : t("createOneTimeCode")}</button>}</div>
    </form>
  </Modal>;
}

export function RemoveMemberDialog({ member, busy, onConfirm, onClose }: {
  member: MemberSummary | null;
  busy: boolean;
  onConfirm: (member: MemberSummary) => void;
  onClose: () => void;
}) {
  const t = useTranslation();
  if (!member) return null;
  return <Modal title={t("removeUser")} onClose={onClose}>
    <p>{t("removeUserQuestion", { name: member.displayName })}</p>
    <p className="muted">{t("removeUserImpact")}</p>
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>{t("cancel")}</button><button className="danger-button" type="button" disabled={busy} onClick={() => onConfirm(member)}>{t("removeUser")}</button></div>
  </Modal>;
}
