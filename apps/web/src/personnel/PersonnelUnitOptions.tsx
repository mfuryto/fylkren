import type { PersonnelUnit } from "./personnelHierarchy";

export function PersonnelUnitOptions({ units }: { units: PersonnelUnit[] }) {
  return units.map(({ unit, depth }) => (
    <option key={unit.id} value={unit.id}>
      {`${"— ".repeat(depth)}${unit.name}`}
    </option>
  ));
}
