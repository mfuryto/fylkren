import { apiGet, apiGetCached, apiMutate } from "../api/client";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import type { DomainDecision, WorkItem, WorkItemDependency, WorkItemDependencyCandidate, WorkItemDetails, WorkItemType } from "../work/WorkItemModels";
import type { TaskCreateDraft } from "./TaskCreateDialog";

export async function getTaskContext(personId?: string) {
  return apiGetCached<{ sites: TaskSite[]; units: TaskUnit[] }>(`work-context:${personId ?? "current"}`, "/api/work/context", "Oppgavekonteksten kunne ikke lastes.");
}

export type WorkItemPage = {
  items: WorkItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: { active: number; inProgress: number; inReview: number; overdue: number };
};

export async function getWorkItems(siteId: string, query: { unitId: string; filter: string; search: string; page: number; focusItemId?: string }) {
  const parameters = new URLSearchParams({ filter: query.filter, page: String(query.page) });
  if (query.unitId) parameters.set("unitId", query.unitId);
  if (query.search) parameters.set("search", query.search);
  if (query.focusItemId && query.page === 1) parameters.set("focusItemId", query.focusItemId);
  return apiGet<WorkItemPage>(`/api/work/sites/${siteId}/items?${parameters}`, "Oppgavene kunne ikke lastes.");
}

export async function getOverviewWorkItems(siteId: string, personId?: string) {
  return apiGetCached<WorkItem[]>(`overview-items:${personId ?? "current"}:${siteId}`, `/api/work/sites/${siteId}/items/overview`, "Oppgavegrunnlaget for oversikten kunne ikke lastes.");
}

export async function getWorkItemTypes(siteId: string) {
  return apiGet<WorkItemType[]>(`/api/work/sites/${siteId}/types`, "Oppgavetypene kunne ikke lastes.");
}

export async function getWorkItemLookups(siteId: string) {
  const [sourceTypes, senders] = await Promise.all([
    apiGet<WorkItemType[]>(`/api/work/sites/${siteId}/lookups/source-type`, "Kildetypene kunne ikke lastes."),
    apiGet<WorkItemType[]>(`/api/work/sites/${siteId}/lookups/sender`, "Avsenderne kunne ikke lastes."),
  ]);
  return { sourceTypes, senders };
}

export async function taskMutation(path: string, method: "POST" | "PUT" | "DELETE", body: object | undefined, fallback: string) {
  await apiMutate(path, method, body, fallback);
}

export async function getTaskDetails(siteId: string, itemId: string) {
  return apiGet<WorkItemDetails>(`/api/work/sites/${siteId}/items/${itemId}/details`, "Oppdragsdetaljene kunne ikke lastes.");
}

export function taskCreatePayload(form: TaskCreateDraft, assignedUnitId: string) {
  return {
    ...form,
    workItemTypeId: form.workItemTypeId || null,
    sourceTypeId: form.sourceTypeId || null,
    senderId: form.senderId || null,
    targetSiteId: form.targetSiteId || null,
    targetInstanceId: form.targetInstanceId || null,
    targetUnitId: form.targetUnitId || null,
    assignedUnitId: assignedUnitId || null,
    referenceUrl: form.referenceUrl || null,
    dueAt: form.dueAt ? new Date(`${form.dueAt}T23:59:59`).toISOString() : null,
  };
}

export async function approvedPlanRunId(siteId: string, itemId: string) {
  const details = await getTaskDetails(siteId, itemId);
  if (details.task.status !== "planning_approved" || !details.plan || details.plan.ownerWorkItemId !== itemId || details.plan.status !== "approved")
    throw new Error("Oppdraget har ingen godkjent plan som kan iverksettes.");
  return details.plan.id;
}

export async function addHoldDependencies(siteId: string, itemId: string, predecessorIds: string[]) {
  if (!predecessorIds.length) return;
  const existing = new Set((await getTaskDependencies(siteId, itemId)).map(value => value.predecessorWorkItemId));
  for (const predecessorWorkItemId of predecessorIds) {
    if (existing.has(predecessorWorkItemId)) continue;
    await taskMutation(`/api/work/sites/${siteId}/items/${itemId}/dependencies`, "POST", { predecessorWorkItemId, type: "finish_to_start" }, "Avhengigheten kunne ikke legges til.");
    existing.add(predecessorWorkItemId);
  }
}

export async function getTaskDependencies(siteId: string, itemId: string) {
  return apiGet<WorkItemDependency[]>(`/api/work/sites/${siteId}/items/${itemId}/dependencies`, "Avhengighetene kunne ikke lastes.");
}

export async function searchTaskDependencyCandidates(siteId: string, itemId: string, search: string) {
  return apiGet<WorkItemDependencyCandidate[]>(`/api/work/sites/${siteId}/items/${itemId}/dependency-candidates?search=${encodeURIComponent(search)}`, "Oppdragssøket kunne ikke gjennomføres.");
}

export async function getTaskDecisions(siteId: string, itemId: string) {
  return apiGet<DomainDecision[]>(`/api/decisions/sites/${siteId}/tasks/${itemId}`, "Beslutningene kunne ikke lastes.");
}

export async function getExecutionHistory(itemId: string) {
  return apiGet<any>(`/api/execution/items/${itemId}/history`, "Utførelseshistorikken kunne ikke lastes.");
}

export async function getFinalReportTemplate(siteId: string) {
  return apiGet<{ content: string | null }>(`/api/templates/sites/${siteId}/final-report`, "Sluttrapportmalen kunne ikke lastes.");
}

export async function getDescendantWorkload(siteId: string, unitId: string, personId?: string) {
  const query = unitId ? `?unitId=${encodeURIComponent(unitId)}` : "";
  return apiGetCached<{ active: number; nearDeadline: number; overdue: number; unitSummaries: Array<{ unitId: string; active: number; underway: number; statusCounts: Array<{ status: string; count: number }> }>; siteSummaries: Array<{ siteId: string; active: number; underway: number; statusCounts: Array<{ status: string; count: number }> }> }>(`descendant-workload:${personId ?? "current"}:${siteId}:${unitId || "top"}`, `/api/work/sites/${siteId}/descendant-workload${query}`, "Belastningen i underenhetene kunne ikke lastes.");
}

export async function getWorkloadHistory<T>(siteId: string) {
  return apiGet<{ availableFrom: string | null; points: T[] }>(`/api/work/sites/${siteId}/workload-history`, "Belastningshistorikken kunne ikke lastes.");
}
