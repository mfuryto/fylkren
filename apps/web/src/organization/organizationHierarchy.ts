import type { OrganizationUnitSummary } from "../siteAdmin/models";

export type OrderedOrganizationUnit = {
  unit: OrganizationUnitSummary;
  depth: number;
};

export function orderOrganizationUnits(
  units: OrganizationUnitSummary[],
): OrderedOrganizationUnit[] {
  const ordered: OrderedOrganizationUnit[] = [];
  const visited = new Set<string>();

  function append(parentId: string | null, depth: number) {
    units
      .filter((unit) => unit.parentId === parentId && !visited.has(unit.id))
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "nb"),
      )
      .forEach((unit) => {
        visited.add(unit.id);
        ordered.push({ unit, depth });
        append(unit.id, depth + 1);
      });
  }

  append(null, 0);
  units
    .filter((unit) => !visited.has(unit.id))
    .sort((a, b) => a.name.localeCompare(b.name, "nb"))
    .forEach((unit) => {
      visited.add(unit.id);
      ordered.push({ unit, depth: 0 });
      append(unit.id, 1);
    });
  return ordered;
}
