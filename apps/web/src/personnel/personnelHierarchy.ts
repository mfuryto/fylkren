import type { OrganizationUnitSummary } from "../siteAdmin/models";

export type PersonnelUnit = {
  unit: OrganizationUnitSummary;
  depth: number;
};

export function buildPersonnelUnits(
  units: OrganizationUnitSummary[],
): PersonnelUnit[] {
  const result: PersonnelUnit[] = [];

  function append(parentId: string | null, depth: number) {
    units
      .filter(
        (unit) =>
          unit.isActive && !unit.isChildSite && unit.parentId === parentId,
      )
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          left.name.localeCompare(right.name, "nb"),
      )
      .forEach((unit) => {
        result.push({ unit, depth });
        append(unit.id, depth + 1);
      });
  }

  append(null, 0);
  return result;
}
