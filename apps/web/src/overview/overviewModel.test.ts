import { describe, expect, it } from "vitest";
import type { WorkItem } from "../work/WorkItemModels";
import { buildOverviewMetrics, canLoadDescendantWorkload, isReceivedRequest, overviewWorkspaceFor } from "./overviewModel";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";

const item = (values: Partial<WorkItem>): WorkItem => ({
  id: "item", siteId: "site", parentWorkItemId: null, parentTitle: null, workItemTypeId: null,
  workItemTypeName: null, sourceTypeId: null, sourceTypeName: null, senderId: null, senderName: null,
  senderSiteName: null, senderPersonName: null, requestBasisSnapshot: null, isCrossSiteView: false,
  title: "Work item", description: "", recommendation: null, referenceUrl: null, priority: "normal",
  status: "assigned", dueAt: null, assignedUnitId: null, unitName: null, isAssignedToMe: true,
  hasPlan: false, workflowCurrentStep: null, workflowStepCount: 0, workflowStepName: null,
  executionStatus: null, executionWorkflowName: null, executionCurrentStep: null, executionStepCount: 0,
  executionStepName: null, awaitingExternalResponses: 0, dependencyCount: 0, isBlocked: false, blockingDependencyCount: 0, decisionCount: 0, decisionNote: null, finalReport: null,
  finalReportClassification: null, finalReportCreatedAt: null, finalReportUpdatedAt: null,
  finalReportWrittenBy: null, finalReportApprovedAt: null, finalReportApprovedBy: null, createdBy: "Test",
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", isOutgoingRequest: false,
  requestRecipientSiteName: null, requestRecipientIsExternal: false, requestProgressStatus: null,
  requestResponse: null, ...values,
});

describe("overviewModel", () => {
  it("loads subordinate workload only for leadership access in the selected context", () => {
    const site: TaskSite = {
      siteId: "site", name: "Site", isSiteManager: false, isTopLevelLeader: false,
      hasTopLevelAccess: false, isManager: false,
    };
    const units: TaskUnit[] = [{
      id: "member-unit", siteId: "site", name: "Member", parentId: null,
      isSiteLeadership: false, sortOrder: 0, assignedToMe: true, isLeader: false,
    }, {
      id: "leader-unit", siteId: "site", name: "Leader", parentId: null,
      isSiteLeadership: false, sortOrder: 1, assignedToMe: true, isLeader: true,
    }];

    expect(canLoadDescendantWorkload(site, units, "")).toBe(false);
    expect(canLoadDescendantWorkload(site, units, "member-unit")).toBe(false);
    expect(canLoadDescendantWorkload(site, units, "leader-unit")).toBe(true);
    expect(canLoadDescendantWorkload({ ...site, hasTopLevelAccess: true }, units, "")).toBe(true);
  });

  it("counts the active leaf instead of both parent and active child work", () => {
    const parent = item({ id: "parent" });
    const child = item({ id: "child", parentWorkItemId: "parent", assignedUnitId: "section" });
    const metrics = buildOverviewMetrics([parent, child], "", new Date("2026-01-01").getTime());
    expect(metrics.active.map(value => value.id)).toEqual(["child"]);
  });

  it("deduplicates a received request in the action queue", () => {
    const request = item({ id: "request", workItemTypeName: "Request", senderSiteName: "Sender", status: "registered" });
    const metrics = buildOverviewMetrics([request], "", new Date("2026-01-01").getTime());
    expect(metrics.needsAction.map(value => value.id)).toEqual(["request"]);
    expect(isReceivedRequest(request)).toBe(true);
  });

  it("keeps the parent work item active when a side request is sent", () => {
    const source = item({ id: "source", status: "in_progress" });
    const sent = item({ id: "sent", parentWorkItemId: "source", parentTitle: source.title,
      workItemTypeName: "Request", isOutgoingRequest: true, status: "in_progress",
      requestProgressStatus: "under_review" });
    const metrics = buildOverviewMetrics([source, sent], "", new Date("2026-01-01").getTime());
    expect(metrics.active.map(value => value.id)).toEqual(["source"]);
    expect(metrics.sentRequests.map(value => value.id)).toEqual(["sent"]);
    expect(metrics.statisticsScope.filter(value => value.isOutgoingRequest).map(value => value.id)).toEqual(["sent"]);
    expect(metrics.needsAction).toEqual([]);

    const answered = buildOverviewMetrics([source, { ...sent, requestProgressStatus: "completed" }], "", new Date("2026-01-01").getTime());
    expect(answered.needsAction.map(value => value.id)).toEqual(["sent"]);
    const closed = buildOverviewMetrics([source, { ...sent, status: "completed", requestProgressStatus: "completed" }], "", new Date("2026-01-01").getTime());
    expect(closed.active.map(value => value.id)).toEqual(["source"]);
    expect(closed.sentRequests).toEqual([]);
    expect(closed.statisticsScope.filter(value => value.isOutgoingRequest).map(value => value.id)).toEqual(["sent"]);
    expect(closed.needsAction.map(value => value.id)).toEqual(["source"]);
  });

  it("counts internal allocation and side requests separately without duplicating the parent", () => {
    const source = item({ id: "source", status: "in_progress" });
    const internal = item({ id: "internal", parentWorkItemId: "source", assignedUnitId: "section", status: "assigned" });
    const sent = item({ id: "sent", parentWorkItemId: "source", parentTitle: source.title,
      workItemTypeName: "Request", isOutgoingRequest: true, status: "in_progress", requestProgressStatus: "registered" });
    const metrics = buildOverviewMetrics([source, internal, sent], "", new Date("2026-01-01").getTime());
    expect(metrics.active.map(value => value.id)).toEqual(["internal"]);
    expect(metrics.sentRequests.map(value => value.id)).toEqual(["sent"]);
  });

  it("counts a received request once and removes an acknowledged cancellation from the active queue", () => {
    const received = item({ id: "received", workItemTypeName: "Request", senderSiteName: "Sender", status: "registered" });
    const active = buildOverviewMetrics([received], "", new Date("2026-01-01").getTime());
    expect(active.active.map(value => value.id)).toEqual(["received"]);
    expect(active.statisticsScope.filter(isReceivedRequest).map(value => value.id)).toEqual(["received"]);
    expect(active.needsAction.map(value => value.id)).toEqual(["received"]);
    const withdrawn = buildOverviewMetrics([{ ...received, status: "request_cancelled" }], "", new Date("2026-01-01").getTime());
    expect(withdrawn.needsAction.map(value => value.id)).toEqual(["received"]);
    const acknowledged = buildOverviewMetrics([{ ...received, status: "completed" }], "", new Date("2026-01-01").getTime());
    expect(acknowledged.active).toEqual([]);
    expect(acknowledged.needsAction).toEqual([]);
  });

  it("does not turn active child work into an action requirement at the parent level", () => {
    const parent = item({ id: "parent", status: "in_progress" });
    const child = item({ id: "child", parentWorkItemId: "parent", assignedUnitId: "section", status: "assigned" });
    const metrics = buildOverviewMetrics([parent, child], "", new Date("2026-01-01").getTime());
    expect(metrics.active.map(value => value.id)).toEqual(["child"]);
    expect(metrics.needsAction).toEqual([]);
  });

  it("shows child work as an action requirement at the receiving level", () => {
    const parent = item({ id: "parent", status: "in_progress" });
    const child = item({ id: "child", parentWorkItemId: "parent", assignedUnitId: "section", status: "assigned" });
    const metrics = buildOverviewMetrics([parent, child], "section", new Date("2026-01-01").getTime());
    expect(metrics.needsAction.map(value => value.id)).toEqual(["child"]);
  });

  it("routes planning and execution to the correct workspace", () => {
    expect(overviewWorkspaceFor(item({ status: "planning_approval" }))).toBe("Tasks");
    expect(overviewWorkspaceFor(item({ status: "planning_approved" }))).toBe("Tasks");
    expect(overviewWorkspaceFor(item({ status: "execution" }))).toBe("Execution");
  });

  it("keeps an approved but uninitiated plan visible as an action requirement", () => {
    const work = item({ status: "planning_approved" });
    const metrics = buildOverviewMetrics([work], "", new Date("2026-01-01").getTime());
    expect(metrics.needsAction.map(value => value.id)).toEqual(["item"]);
  });
});
