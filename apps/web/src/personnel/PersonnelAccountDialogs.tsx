import type React from "react";
import { Modal } from "../components/Modal";
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
  if (!open) return null;
  return <Modal title={localEnabled ? "Legg til personell fra AD/LDAP" : "Legg til bruker"} onClose={onClose}>
    <form className="stacked-form" onSubmit={onSubmit}>
      {providers.length === 0 ? <p className="status-message">Ingen AD- eller LDAP-leverandør er aktivert av Platform Manager.</p> : <>
        <p className="muted modal-note">Bare personen du velger legges til i siten. Katalogen populerer ikke personellregisteret automatisk.</p>
        <div className="field"><label htmlFor="directory-provider">Katalog</label><select id="directory-provider" value={provider} onChange={(event) => onProviderChange(event.target.value)}>{providers.map((value) => <option key={value.key} value={value.key}>{value.name}</option>)}</select></div>
        <div className="field">
          <label htmlFor="directory-person-search">Finn person</label>
          <input id="directory-person-search" type="search" autoComplete="off" placeholder="Søk på navn, e-post eller brukernavn" value={query} onChange={(event) => onQueryChange(event.target.value)} />
          {query.trim().length > 0 && query.trim().length < 2 && <p className="muted modal-note">Skriv minst to tegn.</p>}
          {results.length > 0 && !selectedUser && <div className="person-search-results" role="listbox" aria-label="Katalogtreff">{results.map((person) => <button key={`${person.provider}:${person.stableId}`} type="button" role="option" aria-selected="false" onClick={() => onSelectUser(person)}><strong>{person.displayName || person.username}</strong><small>{[person.username, person.email].filter(Boolean).join(" · ")}</small></button>)}</div>}
        </div>
        <div className="field"><label htmlFor="directory-person-unit">Underenhet</label><select id="directory-person-unit" required value={unitId} onChange={(event) => onUnitChange(event.target.value)}><PersonnelUnitOptions units={units} /></select></div>
      </>}
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Avbryt</button>{providers.length > 0 && <button className="primary-button" disabled={busy || !selectedUser || !unitId}>Legg til personell</button>}</div>
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
  if (!open) return null;
  return <Modal title="Legg til eksisterende lokal bruker" onClose={onClose}>
    <form className="stacked-form" onSubmit={onSubmit}>
      <p className="muted modal-note">Mottakende site søker etter en person som allerede har lokal konto i en annen site. Identitet og profil gjenbrukes, mens enhet og roller forvaltes separat her.</p>
      <div className="field">
        <label htmlFor="existing-local-user-search">Finn bruker</label>
        <input id="existing-local-user-search" type="search" autoComplete="off" placeholder="Søk på navn, e-post eller brukernavn" value={query} onChange={(event) => onQueryChange(event.target.value)} />
        {query.trim().length > 0 && query.trim().length < 2 && <p className="muted modal-note">Skriv minst to tegn.</p>}
        {results.length > 0 && !selectedUser && <div className="person-search-results" role="listbox" aria-label="Eksisterende lokale brukere">{results.map((person) => <button key={person.id} type="button" role="option" onClick={() => onSelectUser(person)}><strong>{person.displayName}</strong><small>E-post: {person.email ?? "Ikke registrert"} · Brukernavn: {person.username}</small></button>)}</div>}
        {selectedUser && <div className="site-detail-block"><strong>{selectedUser.displayName}</strong><dl className="detail-list"><div><dt>E-post</dt><dd>{selectedUser.email ?? "Ikke registrert"}</dd></div><div><dt>Brukernavn</dt><dd>{selectedUser.username}</dd></div><div><dt>Nåværende site</dt><dd>{selectedUser.sites.join(", ")}</dd></div></dl></div>}
      </div>
      <div className="field"><label htmlFor="existing-local-user-unit">Underenhet i denne siten</label><select id="existing-local-user-unit" required value={unitId} onChange={(event) => onUnitChange(event.target.value)}><PersonnelUnitOptions units={units} /></select></div>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Avbryt</button><button className="primary-button" disabled={busy || !selectedUser || !unitId}>Legg til i siten</button></div>
    </form>
  </Modal>;
}

export function PasswordResetDialog({ value, busy, onSubmit, onClose }: {
  value: (MemberSummary & { resetCode?: string; expiresAt?: string }) | null;
  busy: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}) {
  if (!value) return null;
  return <Modal title="Tilbakestill passord" onClose={onClose}>
    <form className="stacked-form" onSubmit={onSubmit}>
      {value.resetCode ? <><p>Gi engangskoden til <strong>{value.displayName}</strong> gjennom en sikker kanal. Koden vises bare her og utløper etter 30 minutter.</p><div className="field"><label htmlFor="reset-person-code">Engangskode</label><input id="reset-person-code" readOnly value={value.resetCode} onFocus={(event) => event.currentTarget.select()} /></div></> : <p className="muted modal-note">Opprett en engangskode for <strong>{value.displayName}</strong>. Brukeren velger selv sitt nye passord på innloggingssiden.</p>}
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>{value.resetCode ? "Lukk" : "Avbryt"}</button>{!value.resetCode && <button className="primary-button" disabled={busy}>{busy ? "Oppretter …" : "Opprett engangskode"}</button>}</div>
    </form>
  </Modal>;
}

export function RemoveMemberDialog({ member, busy, onConfirm, onClose }: {
  member: MemberSummary | null;
  busy: boolean;
  onConfirm: (member: MemberSummary) => void;
  onClose: () => void;
}) {
  if (!member) return null;
  return <Modal title="Fjern bruker" onClose={onClose}>
    <p>Vil du fjerne <strong>{member.displayName}</strong> fra siten?</p>
    <p className="muted">Innlogging i denne siten og aktive rolletildelinger deaktiveres. Historikken beholdes.</p>
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Avbryt</button><button className="danger-button" type="button" disabled={busy} onClick={() => onConfirm(member)}>Fjern bruker</button></div>
  </Modal>;
}
