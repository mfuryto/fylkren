import type {
  AccessSummary,
  MemberSummary,
  RoleAssignmentSummary,
  RoleSummary,
} from "../siteAdmin/models";
import type { PersonnelUnit } from "./personnelHierarchy";

type Props = {
  access: AccessSummary;
  units: PersonnelUnit[];
  canManage: boolean;
  busy: boolean;
  onEditMember: (member: MemberSummary) => void;
  onResetPassword: (member: MemberSummary) => void;
  onRemoveMember: (member: MemberSummary) => void;
  onRemoveAssignment: (assignment: RoleAssignmentSummary) => void;
  onEditRole: (role: RoleSummary) => void;
};

export function PersonnelLists({
  access,
  units,
  canManage,
  busy,
  onEditMember,
  onResetPassword,
  onRemoveMember,
  onRemoveAssignment,
  onEditRole,
}: Props) {
  const knownUnitIds = new Set(units.map(({ unit }) => unit.id));
  const unplacedMembers = access.members.filter(
    (member) =>
      !member.organizationUnitId || !knownUnitIds.has(member.organizationUnitId),
  );

  const renderMember = (member: MemberSummary) => (
    <article className="personnel-row" key={member.id}>
      <div>
        <strong>{member.displayName}</strong>
        <span className="muted">
          {member.email} · {member.username}
          {member.directoryProvider
            ? ` · ${member.directoryProvider.toUpperCase()}`
            : " · Lokal"}
        </span>
      </div>
      <div className="assignment-chips">
        {access.roles.flatMap((role) =>
          role.assignments
            .filter((assignment) => assignment.personId === member.id)
            .map((assignment) => (
              <span className="manager-chip" key={assignment.id}>
                {role.organizationUnitName} · {role.name}
                {canManage && (
                  <button
                    type="button"
                    aria-label={`Fjern rollen ${role.name}`}
                    disabled={busy}
                    onClick={() => onRemoveAssignment(assignment)}
                  >
                    ×
                  </button>
                )}
              </span>
            )),
        )}
        {member.organizationUnitId &&
          !access.roles.some(
            (role) =>
              role.organizationUnitId === member.organizationUnitId &&
              role.assignments.some(
                (assignment) => assignment.personId === member.id,
              ),
          ) && <span className="muted">Ingen rolle</span>}
        {!member.organizationUnitId && (
          <span className="muted">Ingen enhet</span>
        )}
      </div>
      {canManage && (
        <div className="row-actions">
          <button
            className="link-button"
            type="button"
            onClick={() => onEditMember(member)}
          >
            Rediger
          </button>
          {!member.directoryProvider && (
            <button
              className="link-button"
              type="button"
              onClick={() => onResetPassword(member)}
            >
              Tilbakestill passord
            </button>
          )}
          <button
            className="link-button danger"
            type="button"
            onClick={() => onRemoveMember(member)}
          >
            Fjern
          </button>
        </div>
      )}
    </article>
  );

  return (
    <>
      <section className="panel personnel-list">
        <div className="section-heading">
          <h2>Brukere</h2>
          <span className="muted">{access.members.length}</span>
        </div>
        {units.flatMap(({ unit, depth }) => {
          const members = access.members.filter(
            (member) => member.organizationUnitId === unit.id,
          );
          if (!members.length) return [];
          return [
            <div
              className="hierarchy-group-heading"
              key={`${unit.id}-personnel-heading`}
              style={{ paddingLeft: `${20 + depth * 24}px` }}
            >
              <strong>
                {depth ? "↳ " : ""}
                {unit.name}
              </strong>
              <span className="muted">
                {members.length} bruker{members.length === 1 ? "" : "e"}
              </span>
            </div>,
            ...members.map(renderMember),
          ];
        })}
        {unplacedMembers.length > 0 && (
          <>
            <div className="hierarchy-group-heading">
              <strong>Uten aktiv enhet</strong>
              <span className="muted">Flytt brukeren til en aktiv enhet</span>
            </div>
            {unplacedMembers.map(renderMember)}
          </>
        )}
      </section>
      <section className="panel role-list">
        <div className="section-heading">
          <h2>Roller</h2>
          <span className="muted">{access.roles.length}</span>
        </div>
        {units.flatMap(({ unit, depth }) => {
          const roles = access.roles
            .filter((role) => role.organizationUnitId === unit.id)
            .sort(
              (left, right) =>
                Number(right.isLeader) - Number(left.isLeader) ||
                left.name.localeCompare(right.name, "nb"),
            );
          const membersWithoutRole = access.members.filter(
            (member) =>
              member.organizationUnitId === unit.id &&
              !roles.some((role) =>
                role.assignments.some(
                  (assignment) => assignment.personId === member.id,
                ),
              ),
          );
          return [
            <div
              className="hierarchy-group-heading"
              key={`${unit.id}-role-heading`}
              style={{ paddingLeft: `${20 + depth * 24}px` }}
            >
              <strong>
                {depth ? "↳ " : ""}
                {unit.name}
              </strong>
              <span className="muted">
                {roles.length} rolle{roles.length === 1 ? "" : "r"}
              </span>
            </div>,
            ...roles.map((role) => (
              <article className="role-management-row" key={role.id}>
                <div
                  style={{
                    paddingLeft: `${(depth + 1 + (role.isLeader ? 0 : 1)) * 20}px`,
                  }}
                >
                  <strong>{role.name}</strong>
                  <span className="muted">
                    {role.isLeader
                      ? "Lederrolle"
                      : role.hasLeaderAccess
                        ? "Arbeidsrolle med ledertilgang"
                        : "Arbeidsrolle"}
                  </span>
                </div>
                <div className="role-assignees">
                  {role.assignments.length ? (
                    role.assignments.map((assignment) => (
                      <span key={assignment.id}>
                        {assignment.displayName}
                        {assignment.canLeadParentLevel
                          ? " · leder overordnet"
                          : ""}
                      </span>
                    ))
                  ) : (
                    <span className="muted">Ikke bemannet</span>
                  )}
                </div>
                {!canManage || role.isLeader ? (
                  <span className="muted protected-label">
                    {canManage ? "Beskyttet" : "Kun visning"}
                  </span>
                ) : (
                  <button
                    className="link-button"
                    type="button"
                    onClick={() => onEditRole(role)}
                  >
                    Rediger
                  </button>
                )}
              </article>
            )),
            ...(membersWithoutRole.length
              ? [
                  <article
                    className="role-management-row"
                    key={`${unit.id}-without-role`}
                  >
                    <div style={{ paddingLeft: `${(depth + 2) * 20}px` }}>
                      <strong>Ingen rolle</strong>
                      <span className="muted">Enhetstilknytning</span>
                    </div>
                    <div className="role-assignees">
                      {membersWithoutRole.map((member) => (
                        <span key={member.id}>{member.displayName}</span>
                      ))}
                    </div>
                    <span />
                  </article>,
                ]
              : []),
          ];
        })}
      </section>
    </>
  );
}
