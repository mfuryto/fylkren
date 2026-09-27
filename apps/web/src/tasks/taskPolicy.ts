import type { WorkItem } from "../work/WorkItemModels";

export const taskStatusLabels: Record<string, string> = {
  registered: "Registrert", under_review: "Til vurdering", on_hold: "Avventer",
  rejected: "Avvist", planning: "Planlegging", planning_approval: "Plan til godkjenning", planning_approved: "Plan godkjent · avventer iverksetting",
  execution: "Utførelse", assigned: "Fordelt", in_progress: "Pågår", in_review: "Til kontroll",
  completed: "Fullført", cancelled: "Kansellert", request_cancelled: "Trukket av avsender", reassigned: "Omfordelt",
};

export const priorityLabels: Record<string, string> = { low: "Lav", normal: "Normal", high: "Høy", critical: "Kritisk" };
export const unassignedStatuses = ["registered", "under_review", "on_hold", "planning", "planning_approved", "execution"];
export const terminalChildStatuses = ["completed", "reassigned", "cancelled", "rejected"];
export type TaskNextAction = { status: string; label: string };

export function canSendSideRequestAtStatus(status: string) {
  return !["registered", "on_hold", "planning", "planning_approval", "planning_approved", "execution", "in_review", "completed", "rejected", "cancelled", "reassigned", "request_cancelled"].includes(status);
}

export const requestProgressLabels: Record<string, string> = {
  registered: "Mottatt", under_review: "Under vurdering", on_hold: "Under vurdering", rejected: "Avsluttet",
  planning: "Under behandling", planning_approval: "Under behandling", planning_approved: "Under behandling", execution: "Under behandling",
  assigned: "Fordelt", in_progress: "Under behandling", in_review: "Under behandling",
  completed: "Besvart", cancelled: "Avsluttet", reassigned: "Under behandling",
};

export function effectiveTaskStatus(item: WorkItem) {
  if (!item.isOutgoingRequest) return item.status;
  if (["completed", "cancelled"].includes(item.status)) return item.status;
  return ["completed", "rejected", "cancelled"].includes(item.requestProgressStatus ?? "") ? "in_review" : "in_progress";
}

export function isReceivedRequest(item: WorkItem) {
  return !item.isOutgoingRequest && item.workItemTypeName === "Anmodning" && Boolean(item.senderSiteName);
}

export function hasActiveDirectChildren(item: WorkItem, items: WorkItem[]) {
  return items.some(candidate => candidate.parentWorkItemId === item.id && !terminalChildStatuses.includes(candidate.status));
}

export function getTaskNextActions(item: WorkItem, items: WorkItem[], permissions: { isLeader: boolean; isOperational: boolean; canManage: boolean }) {
  const actions: TaskNextAction[] = [];
  if (item.isBlocked) return permissions.canManage && ["planning_approved", "in_progress"].includes(item.status) ? [{ status: "on_hold", label: "Avvent" }] : actions;
  if (item.isOutgoingRequest && permissions.isLeader && !["completed", "cancelled"].includes(item.status) && item.requestProgressStatus && ["completed", "rejected", "cancelled"].includes(item.requestProgressStatus))
    return [{ status: "completed", label: "Fullfør anmodning" }];
  if (!permissions.isOperational) return actions;
  if (item.status === "registered" && permissions.canManage)
    actions.push({ status: "under_review", label: "Ta til vurdering" });
  if (item.status === "assigned" && permissions.canManage && !hasActiveDirectChildren(item, items))
    actions.push({ status: "planning", label: "Send til planlegging" }, { status: "execution", label: "Send til utførelse" });
  if (item.status === "planning_approved" && permissions.canManage)
    actions.push({ status: "on_hold", label: "Avvent" }, { status: "release", label: "Iverksett" });
  const directChildren = items.filter(candidate => candidate.parentWorkItemId === item.id);
  if (item.status === "in_progress" && permissions.canManage) {
    actions.push({ status: "on_hold", label: "Avvent" });
    if (directChildren.length > 0 && directChildren.every(child => ["completed", "reassigned"].includes(child.status)))
      actions.push({ status: "in_review", label: "Send til kontroll" });
    else if (directChildren.length === 0 && !item.executionStatus)
      actions.push({ status: "execution", label: "Send til utførelse" });
  }
  if (item.status === "in_review" && permissions.canManage)
    actions.push(item.finalReportApprovedAt ? { status: "completed", label: "Fullfør" } : { status: "in_progress", label: "Returner" });
  if (item.status === "rejected" && permissions.canManage)
    actions.push({ status: "under_review", label: "Gjenåpne til ny vurdering" });
  if (item.status === "request_cancelled" && permissions.canManage)
    actions.push({ status: "completed", label: "Kvitter og fullfør" });
  return actions;
}

export function rootWorkTitle(item: WorkItem, items: WorkItem[]) {
  const itemMap = new Map(items.map(value => [value.id, value]));
  const visited = new Set<string>();
  let current = item;
  while (current.parentWorkItemId && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = itemMap.get(current.parentWorkItemId);
    if (!parent) break;
    current = parent;
  }
  return current.title;
}

export function workflowProgress(item: WorkItem) {
  if (item.executionStatus === "claimed") return "Utførelse · ansvar tatt, arbeidsflyt ikke valgt";
  if (item.executionStatus === "available") return "Utførelse · frigjort og tilgjengelig";
  if (item.executionStatus === "submitted") return "Utførelse ferdig · til kontroll";
  if (item.executionStatus) return `Utførelse${item.executionWorkflowName ? ` · ${item.executionWorkflowName}` : ""}${item.executionStepCount > 0 && item.executionCurrentStep !== null ? ` · steg ${Math.min(item.executionCurrentStep + 1, item.executionStepCount)} av ${item.executionStepCount}${item.executionStepName ? ` · ${item.executionStepName}` : ""}` : ""}${item.awaitingExternalResponses ? ` · venter på ${item.awaitingExternalResponses} eksterne svar` : ""}`;
  return item.workflowStepCount > 0 && item.workflowCurrentStep !== null
    ? `Plansteg ${Math.min(item.workflowCurrentStep + 1, item.workflowStepCount)} av ${item.workflowStepCount}${item.workflowStepName ? ` · ${item.workflowStepName}` : ""}`
    : null;
}
