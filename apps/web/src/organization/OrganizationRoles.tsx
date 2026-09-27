import type { AccessSummary } from "../siteAdmin/models";
import type { OrderedOrganizationUnit } from "./organizationHierarchy";

export function OrganizationRoles({
  orderedUnits,
  access,
}: {
  orderedUnits: OrderedOrganizationUnit[];
  access: AccessSummary;
}) {
  return (
    <div className="panel access-overview organization-roles">
      <h2>Roller og bemanning</h2>
      {orderedUnits
        .filter(({ unit }) => unit.isActive && !unit.isChildSite)
        .flatMap(({ unit, depth }) => {
          const unitRoles = access.roles
            .filter((role) => role.organizationUnitId === unit.id)
            .sort(
              (a, b) =>
                Number(b.isLeader) - Number(a.isLeader) ||
                a.name.localeCompare(b.name, "nb"),
            );
          const withoutRole = access.members.filter(
            (member) =>
              member.organizationUnitId === unit.id &&
              !unitRoles.some((role) =>
                role.assignments.some((assignment) => assignment.personId === member.id),
              ),
          );
          return [
            <div
              className="hierarchy-group-heading"
              key={`${unit.id}-heading`}
              style={{ paddingLeft: `${20 + depth * 24}px` }}
            >
              <strong>{depth ? "↳ " : ""}{unit.name}</strong>
              <span className="muted">
                {unit.worksAtParentLevel ? "Arbeider på overordnet nivå" : "Eget nivå"}
              </span>
            </div>,
            ...unitRoles.map((role) => {
              const roleDepth = depth + 1 + (role.isLeader ? 0 : 1);
              return (
                <div className="role-row" key={role.id}>
                  <strong style={{ paddingLeft: `${roleDepth * 20}px` }}>
                    {role.name}
                  </strong>
                  <span className="muted">
                    {role.isLeader ? "Lederrolle" : "Arbeidsrolle"}
                  </span>
                  <span>
                    {role.assignments
                      .map((assignment) => `${assignment.displayName}${assignment.canLeadParentLevel ? " (leder overordnet)" : ""}`)
                      .join(", ") || "Ikke bemannet"}
                  </span>
                </div>
              );
            }),
            ...(withoutRole.length
              ? [
                  <div className="role-row" key={`${unit.id}-without-role`}>
                    <strong style={{ paddingLeft: `${(depth + 2) * 20}px` }}>
                      Ingen rolle
                    </strong>
                    <span className="muted">Enhetstilknytning</span>
                    <span>{withoutRole.map((member) => member.displayName).join(", ")}</span>
                  </div>,
                ]
              : []),
          ];
        })}
    </div>
  );
}
