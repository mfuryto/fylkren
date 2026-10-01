import type { TaskUnit } from "../work/WorkContextModels";

export function availableReportUnits(units: TaskUnit[], siteId: string, language = "en") {
  return units
    .filter(unit => unit.siteId === siteId && !unit.isSiteLeadership && unit.assignedToMe)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, language));
}

export function availableReportYears(years: number[], selectedYear: string) {
  return Array.from(new Set([...(selectedYear ? [Number(selectedYear)] : []), ...years]))
    .sort((a, b) => b - a);
}
