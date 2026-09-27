import type React from "react";
import { Modal } from "../components/Modal";
import type { AccessSummary, MemberSummary, OrganizationUnitSummary, RoleAssignmentSummary, RoleSummary } from "../siteAdmin/models";
import type { PersonnelUnit } from "./personnelHierarchy";
import { PersonnelUnitOptions } from "./PersonnelUnitOptions";

export function RoleEditDialog({ role, units, busy, onChange, onSubmit, onDelete, onClose }: {
  role: RoleSummary | null;
  units: PersonnelUnit[];
  busy: boolean;
  onChange: (role: RoleSummary) => void;
  onSubmit: (event: React.FormEvent) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  if (!role) return null;
  return <Modal title="Rediger arbeidsrolle" onClose={onClose}>
    <form className="stacked-form" onSubmit={onSubmit}>
      <div className="field"><label htmlFor="edit-role-name">Rollenavn</label><input id="edit-role-name" required minLength={2} value={role.name} onChange={(event) => onChange({ ...role, name: event.target.value })} /></div>
      <div className="field"><label htmlFor="edit-role-unit">Organisasjonsenhet</label><select id="edit-role-unit" value={role.organizationUnitId} onChange={(event) => onChange({ ...role, organizationUnitId: event.target.value })}><PersonnelUnitOptions units={units} /></select></div>
      <label className="checkbox-field"><input type="checkbox" checked={role.hasLeaderAccess} onChange={(event) => onChange({ ...role, hasLeaderAccess: event.target.checked })} /> Gi rollen samme operative tilgang som lederrollen</label>
      <label className="checkbox-field"><input type="checkbox" checked={role.canPlan} onChange={(event) => onChange({ ...role, canPlan: event.target.checked })} /> Kan planlegge oppgaver</label>
      <p className="muted modal-note">Tilganger følger aktive innehavere av rollen. Site Manager kan trekke dem tilbake. Rollen kan bare slettes når den ikke har aktive tildelinger.</p>
      <div className="modal-actions">
        <button className="danger-button" type="button" disabled={busy || role.assignments.length > 0} onClick={onDelete}>Slett rolle</button>
        <span className="action-spacer" />
        <button className="secondary-button" type="button" onClick={onClose}>Avbryt</button>
        <button className="primary-button" disabled={busy}>Lagre</button>
      </div>
    </form>
  </Modal>;
}

export type AssignmentForm = {
  roleId: string;
  validTo: string;
  canLeadParentLevel: boolean;
};

export function MemberEditDialog({ member, units, personnelUnits, access, assignment, canGrantParentLeadership, busy, onMemberChange, onAssignmentChange, onRemoveAssignment, onParentLeadershipChange, onAssignRole, onSubmit, onClose }: {
  member: MemberSummary | null;
  units: OrganizationUnitSummary[];
  personnelUnits: PersonnelUnit[];
  access: AccessSummary;
  assignment: AssignmentForm;
  canGrantParentLeadership: boolean;
  busy: boolean;
  onMemberChange: (member: MemberSummary) => void;
  onAssignmentChange: (assignment: AssignmentForm) => void;
  onRemoveAssignment: (assignment: RoleAssignmentSummary) => void;
  onParentLeadershipChange: (assignment: RoleAssignmentSummary, enabled: boolean) => void;
  onAssignRole: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}) {
  if (!member) return null;
  const directoryManaged = Boolean(member.directoryProvider);
  const assignedRoles = access.roles.flatMap((role) => role.assignments.filter((value) => value.personId === member.id).map((value) => ({ role, assignment: value })));
  return <Modal title="Rediger bruker" onClose={onClose}>
    <form className="stacked-form" onSubmit={onSubmit}>
      <div className="field"><label htmlFor="edit-person-name">Navn</label><input id="edit-person-name" required disabled={directoryManaged} value={member.displayName} onChange={(event) => onMemberChange({ ...member, displayName: event.target.value })} /></div>
      <div className="field"><label htmlFor="edit-person-email">E-postadresse</label><input id="edit-person-email" type="email" required disabled={directoryManaged} value={member.email ?? ""} onChange={(event) => onMemberChange({ ...member, email: event.target.value })} /></div>
      <div className="field"><label htmlFor="edit-person-username">Brukernavn</label><input id="edit-person-username" required disabled={directoryManaged} value={member.username ?? ""} onChange={(event) => onMemberChange({ ...member, username: event.target.value })} /></div>
      {member.directoryProvider && <p className="muted modal-note">Navn, e-post, brukernavn og passord forvaltes av {member.directoryProvider.toUpperCase()}. Enhet, roller og aktivt site-medlemskap forvaltes lokalt.</p>}
      <div className="field">
        <label htmlFor="edit-person-unit">Underenhet</label>
        <select id="edit-person-unit" value={member.organizationUnitId ?? ""} onChange={(event) => onMemberChange({ ...member, organizationUnitId: event.target.value || null, organizationUnitName: units.find((unit) => unit.id === event.target.value)?.name ?? null })}>
          <option value="">Ingen enhet</option><PersonnelUnitOptions units={personnelUnits} />
        </select>
        <p className="muted modal-note">Flytting endrer organisatorisk tilhørighet, men ikke tildelte roller.</p>
      </div>
      <div className="field">
        <span className="field-label">Tildelte roller</span>
        <div className="assignment-chips">
          {assignedRoles.map(({ role, assignment: roleAssignment }) => {
            const unit = units.find((value) => value.id === role.organizationUnitId);
            return <div className="assigned-role-control" key={roleAssignment.id}>
              <span className="manager-chip">{role.organizationUnitName} · {role.name}<button type="button" aria-label={`Fjern rollen ${role.name}`} disabled={busy} onClick={() => onRemoveAssignment(roleAssignment)}>×</button></span>
              {role.isLeader && unit?.worksAtParentLevel && <label className="checkbox-field compact-checkbox"><input type="checkbox" checked={roleAssignment.canLeadParentLevel} disabled={busy} onChange={(event) => onParentLeadershipChange(roleAssignment, event.target.checked)} /> Kan fungere som leder på overordnet nivå</label>}
            </div>;
          })}
          {assignedRoles.length === 0 && <span className="muted">Ingen tildelte roller</span>}
        </div>
      </div>
      <div className="field"><label htmlFor="edit-person-role">Fordel rolle</label><select id="edit-person-role" value={assignment.roleId} onChange={(event) => onAssignmentChange({ ...assignment, roleId: event.target.value, canLeadParentLevel: false })}>{access.roles.map((role) => <option key={role.id} value={role.id}>{role.organizationUnitName} – {role.name}</option>)}</select></div>
      {canGrantParentLeadership && <label className="checkbox-field"><input type="checkbox" checked={assignment.canLeadParentLevel} onChange={(event) => onAssignmentChange({ ...assignment, canLeadParentLevel: event.target.checked })} /> Kan fungere som leder på overordnet nivå</label>}
      <div className="field"><label htmlFor="edit-person-role-valid-to">Rollen gjelder til (valgfritt)</label><input id="edit-person-role-valid-to" type="date" value={assignment.validTo} onChange={(event) => onAssignmentChange({ ...assignment, validTo: event.target.value })} /></div>
      <div className="inline-actions"><button className="secondary-button" type="button" disabled={busy || !assignment.roleId} onClick={onAssignRole}>Tildel rolle</button></div>
      <label className="checkbox-field"><input type="checkbox" checked={member.isActive} onChange={(event) => onMemberChange({ ...member, isActive: event.target.checked })} /> Aktiv bruker</label>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Avbryt</button><button className="primary-button" disabled={busy}>Lagre</button></div>
    </form>
  </Modal>;
}
