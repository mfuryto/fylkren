import type { TaskUnit } from "../work/WorkContextModels";

export function availableReportUnits(units: TaskUnit[], siteId: string) {
  return units
    .filter(unit => unit.siteId === siteId && !unit.isSiteLeadership && unit.assignedToMe)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "nb"));
}

export function availableReportYears(years: number[], selectedYear: string) {
  return Array.from(new Set([...(selectedYear ? [Number(selectedYear)] : []), ...years]))
    .sort((a, b) => b - a);
}
