import type {
  AccessSummary,
  MemberSummary,
  RoleAssignmentSummary,
  RoleSummary,
} from "../siteAdmin/models";
import type { PersonnelUnit } from "./personnelHierarchy";
import { useLanguage, useTranslation } from "../localization/LocalizationProvider";
import { useState } from "react";
import { ListSortControl, sortList, type ListSort } from "../components/ListSortControl";

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
  const t = useTranslation();
  const language = useLanguage();
  const [memberSort,setMemberSort]=useState<ListSort>("name-asc"),[roleSort,setRoleSort]=useState<ListSort>("name-asc");
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
            : ` · ${t("localAccount")}`}
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
                    aria-label={t("removeNamedRole", { name: role.name })}
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
          ) && <span className="muted">{t("noRole")}</span>}
        {!member.organizationUnitId && (
          <span className="muted">{t("noUnit")}</span>
        )}
      </div>
      {canManage && (
        <div className="row-actions">
          <button
            className="link-button"
            type="button"
            onClick={() => onEditMember(member)}
          >
            {t("edit")}
          </button>
          {!member.directoryProvider && (
            <button
              className="link-button"
              type="button"
              onClick={() => onResetPassword(member)}
            >
              {t("resetPassword")}
            </button>
          )}
          <button
            className="link-button danger"
            type="button"
            onClick={() => onRemoveMember(member)}
          >
            {t("remove")}
          </button>
        </div>
      )}
    </article>
  );

  return (
    <>
      <section className="panel personnel-list">
        <div className="section-heading">
          <h2>{t("users")}</h2>
          <div className="inline-actions"><ListSortControl id="personnel-user-sort" value={memberSort} onChange={setMemberSort} options={["name-asc","name-desc"]}/><span className="muted">{access.members.length}</span></div>
        </div>
        {units.flatMap(({ unit, depth }) => {
          const members = sortList(access.members.filter(
            (member) => member.organizationUnitId === unit.id,
          ),memberSort,{name:member=>member.displayName},language);
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
                {members.length === 1 ? t("userCountOne") : t("userCountMany", { count: members.length })}
              </span>
            </div>,
            ...members.map(renderMember),
          ];
        })}
        {unplacedMembers.length > 0 && (
          <>
            <div className="hierarchy-group-heading">
              <strong>{t("withoutActiveUnit")}</strong>
              <span className="muted">{t("moveUserToActiveUnit")}</span>
            </div>
            {sortList(unplacedMembers,memberSort,{name:member=>member.displayName},language).map(renderMember)}
          </>
        )}
      </section>
      <section className="panel role-list">
        <div className="section-heading">
          <h2>{t("roles")}</h2>
          <div className="inline-actions"><ListSortControl id="personnel-role-sort" value={roleSort} onChange={setRoleSort} options={["name-asc","name-desc"]}/><span className="muted">{access.roles.length}</span></div>
        </div>
        {units.flatMap(({ unit, depth }) => {
          const roles = sortList(access.roles
            .filter((role) => role.organizationUnitId === unit.id),roleSort,{name:role=>role.name},language);
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
                {roles.length === 1 ? t("roleCountOne") : t("roleCountMany", { count: roles.length })}
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
                      ? t("leaderRole")
                      : role.hasLeaderAccess
                        ? t("workRoleWithLeaderAccess")
                        : t("workRole")}
                  </span>
                </div>
                <div className="role-assignees">
                  {role.assignments.length ? (
                    role.assignments.map((assignment) => (
                      <span key={assignment.id}>
                        {assignment.displayName}
                        {assignment.canLeadParentLevel
                          ? ` · ${t("parentLeaderShort")}`
                          : ""}
                      </span>
                    ))
                  ) : (
                    <span className="muted">{t("unstaffed")}</span>
                  )}
                </div>
                {!canManage || role.isLeader ? (
                  <span className="muted protected-label">
                    {canManage ? t("protected") : t("viewOnly")}
                  </span>
                ) : (
                  <button
                    className="link-button"
                    type="button"
                    onClick={() => onEditRole(role)}
                  >
                    {t("edit")}
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
                      <strong>{t("noRole")}</strong>
                      <span className="muted">{t("unitMembership")}</span>
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
