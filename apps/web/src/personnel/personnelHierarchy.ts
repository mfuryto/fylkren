import type { OrganizationUnitSummary } from "../siteAdmin/models";
import { compareActiveLanguage } from "../localization";

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
          compareActiveLanguage(left.name, right.name),
      )
      .forEach((unit) => {
        result.push({ unit, depth });
        append(unit.id, depth + 1);
      });
  }

  append(null, 0);
  return result;
}
