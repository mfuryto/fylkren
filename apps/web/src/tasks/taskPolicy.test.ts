import { describe, expect, it } from "vitest";
import type { WorkItem } from "../work/WorkItemModels";
import { canSendSideRequestAtStatus, effectiveTaskStatus, getTaskNextActions, hasActiveDirectChildren, rootWorkTitle } from "./taskPolicy";

const item = (values: Partial<WorkItem>): WorkItem => ({
  id: "item", siteId: "site", parentWorkItemId: null, parentTitle: null, workItemTypeId: null, workItemTypeName: null,
  sourceTypeId: null, sourceTypeName: null, senderId: null, senderName: null, senderSiteName: null, senderPersonName: null,
  requestBasisSnapshot: null, isCrossSiteView: false, title: "Task", description: "", recommendation: null,
  referenceUrl: null, priority: "normal", status: "registered", dueAt: null, assignedUnitId: null, unitName: null,
  isAssignedToMe: false, hasPlan: false, workflowCurrentStep: null, workflowStepCount: 0, workflowStepName: null,
  executionStatus: null, executionWorkflowName: null, executionCurrentStep: null, executionStepCount: 0,
  executionStepName: null, awaitingExternalResponses: 0, dependencyCount: 0, isBlocked: false, blockingDependencyCount: 0, decisionCount: 0, decisionNote: null, finalReport: null,
  finalReportClassification: null, finalReportCreatedAt: null, finalReportUpdatedAt: null, finalReportWrittenBy: null,
  finalReportApprovedAt: null, finalReportApprovedBy: null, createdBy: "Test", createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z", isOutgoingRequest: false, requestRecipientSiteName: null,
  requestRecipientIsExternal: false, requestProgressStatus: null, requestResponse: null, ...values,
});

describe("taskPolicy", () => {
  it("does not offer a new request from Tasks while execution is in progress", () => {
    expect(canSendSideRequestAtStatus("under_review")).toBe(true);
    expect(canSendSideRequestAtStatus("execution")).toBe(false);
  });
  it("keeps an outgoing request active until its answer is ready", () => {
    expect(effectiveTaskStatus(item({ isOutgoingRequest: true, status: "assigned", requestProgressStatus: "execution" }))).toBe("in_progress");
    expect(effectiveTaskStatus(item({ isOutgoingRequest: true, status: "assigned", requestProgressStatus: "completed" }))).toBe("in_review");
  });

  it("counts only unfinished direct children as active", () => {
    const parent = item({ id: "parent" });
    expect(hasActiveDirectChildren(parent, [parent, item({ id: "child", parentWorkItemId: "parent", status: "completed" })])).toBe(false);
    expect(hasActiveDirectChildren(parent, [parent, item({ id: "child", parentWorkItemId: "parent", status: "execution" })])).toBe(true);
  });

  it("finds the root task title", () => {
    const root = item({ id: "root", title: "Main task" });
    const child = item({ id: "child", parentWorkItemId: "root", title: "Subtask" });
    expect(rootWorkTitle(child, [root, child])).toBe("Main task");
  });

  it("offers planning and execution when an assigned task has no active children", () => {
    const work = item({ id: "work", status: "assigned" });
    expect(getTaskNextActions(work, [work], { isLeader: true, isOperational: true, canManage: true }).map(action => action.status)).toEqual(["planning", "execution"]);
  });

  it("offers Hold and Start to the leader after approval without sending automatically", () => {
    const work = item({ status: "planning_approved", hasPlan: true });
    expect(getTaskNextActions(work, [work], { isLeader: true, isOperational: true, canManage: true })).toEqual([
      { status: "on_hold", label: "Hold" }, { status: "release", label: "Start" },
    ]);
    expect(getTaskNextActions(work, [work], { isLeader: false, isOperational: true, canManage: false })).toEqual([]);
  });

  it("allows a blocked approved plan to be held but not started", () => {
    const work = item({ status: "planning_approved", hasPlan: true, isBlocked: true });
    expect(getTaskNextActions(work, [work], { isLeader: true, isOperational: true, canManage: true })).toEqual([{ status: "on_hold", label: "Hold" }]);
  });

  it("sends a task for review when all direct children are complete", () => {
    const parent = item({ id: "parent", status: "in_progress" });
    const child = item({ id: "child", parentWorkItemId: "parent", status: "completed" });
    expect(getTaskNextActions(parent, [parent, child], { isLeader: true, isOperational: true, canManage: true })).toEqual([
      { status: "on_hold", label: "Hold" },
      { status: "in_review", label: "Send for review" },
    ]);
  });

  it("shows no progress actions when a task is blocked by a dependency", () => {
    const blocked = item({ status: "assigned", isBlocked: true, blockingDependencyCount: 1 });
    expect(getTaskNextActions(blocked, [blocked], { isLeader: true, isOperational: true, canManage: true })).toEqual([]);
  });

  it("allows the sender to complete a processed request", () => {
    const request = item({ isOutgoingRequest: true, status: "assigned", requestProgressStatus: "completed" });
    expect(getTaskNextActions(request, [request], { isLeader: true, isOperational: true, canManage: false })).toEqual([{ status: "completed", label: "Complete request" }]);
  });
});
