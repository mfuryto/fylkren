import type { TaskSite, TaskUnit } from "../work/WorkContextModels";

export type TemplateSummary = {
  id: string;
  name: string;
  content: string;
  ownerUnitId: string | null;
  ownerUnitName: string | null;
  canEdit: boolean;
};

export type TemplateForm = {
  id: string;
  name: string;
  content: string;
  ownerUnitId: string;
};

export type FinalReportTemplate = { content: string; canEdit: boolean };

export function defaultTemplateOwnerUnitId(site: TaskSite | undefined, units: TaskUnit[]) {
  if (!site || site.isSiteManager) return "";
  return units.find(unit => unit.siteId === site.siteId && unit.isLeader)?.id ?? "";
}

export function emptyTemplateForm(ownerUnitId = ""): TemplateForm {
  return { id: "", name: "", content: "", ownerUnitId };
}
