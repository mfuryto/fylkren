import { describe, expect, it } from "vitest";
import type { WorkItem } from "../work/WorkItemModels";
import { canSendSideRequestAtStatus, effectiveTaskStatus, getTaskNextActions, hasActiveDirectChildren, rootWorkTitle } from "./taskPolicy";

const item = (values: Partial<WorkItem>): WorkItem => ({
  id: "item", siteId: "site", parentWorkItemId: null, parentTitle: null, workItemTypeId: null, workItemTypeName: null,
  sourceTypeId: null, sourceTypeName: null, senderId: null, senderName: null, senderSiteName: null, senderPersonName: null,
  requestBasisSnapshot: null, isCrossSiteView: false, title: "Oppdrag", description: "", recommendation: null,
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
  it("tilbyr ikke ny anmodning på Oppgaver mens utførelse pågår", () => {
    expect(canSendSideRequestAtStatus("under_review")).toBe(true);
    expect(canSendSideRequestAtStatus("execution")).toBe(false);
  });
  it("beholder en utgående anmodning aktiv til svaret er klart", () => {
    expect(effectiveTaskStatus(item({ isOutgoingRequest: true, status: "assigned", requestProgressStatus: "execution" }))).toBe("in_progress");
    expect(effectiveTaskStatus(item({ isOutgoingRequest: true, status: "assigned", requestProgressStatus: "completed" }))).toBe("in_review");
  });

  it("regner bare ikke-avsluttede direkte barn som aktive", () => {
    const parent = item({ id: "parent" });
    expect(hasActiveDirectChildren(parent, [parent, item({ id: "child", parentWorkItemId: "parent", status: "completed" })])).toBe(false);
    expect(hasActiveDirectChildren(parent, [parent, item({ id: "child", parentWorkItemId: "parent", status: "execution" })])).toBe(true);
  });

  it("finner tittelen på rotoppdraget", () => {
    const root = item({ id: "root", title: "Hovedoppdrag" });
    const child = item({ id: "child", parentWorkItemId: "root", title: "Deloppdrag" });
    expect(rootWorkTitle(child, [root, child])).toBe("Hovedoppdrag");
  });

  it("tilbyr planlegging og utførelse når et fordelt oppdrag ikke har aktive barn", () => {
    const work = item({ id: "work", status: "assigned" });
    expect(getTaskNextActions(work, [work], { isLeader: true, isOperational: true, canManage: true }).map(action => action.status)).toEqual(["planning", "execution"]);
  });

  it("gir lederen Avvent og Iverksett etter godkjenning uten å sende automatisk", () => {
    const work = item({ status: "planning_approved", hasPlan: true });
    expect(getTaskNextActions(work, [work], { isLeader: true, isOperational: true, canManage: true })).toEqual([
      { status: "on_hold", label: "Avvent" }, { status: "release", label: "Iverksett" },
    ]);
    expect(getTaskNextActions(work, [work], { isLeader: false, isOperational: true, canManage: false })).toEqual([]);
  });

  it("lar blokkert godkjent plan avventes, men ikke iverksettes", () => {
    const work = item({ status: "planning_approved", hasPlan: true, isBlocked: true });
    expect(getTaskNextActions(work, [work], { isLeader: true, isOperational: true, canManage: true })).toEqual([{ status: "on_hold", label: "Avvent" }]);
  });

  it("sender et oppdrag til kontroll når alle direkte barn er ferdige", () => {
    const parent = item({ id: "parent", status: "in_progress" });
    const child = item({ id: "child", parentWorkItemId: "parent", status: "completed" });
    expect(getTaskNextActions(parent, [parent, child], { isLeader: true, isOperational: true, canManage: true })).toEqual([
      { status: "on_hold", label: "Avvent" },
      { status: "in_review", label: "Send til kontroll" },
    ]);
  });

  it("viser ingen fremdriftshandlinger når oppdraget er blokkert av en avhengighet", () => {
    const blocked = item({ status: "assigned", isBlocked: true, blockingDependencyCount: 1 });
    expect(getTaskNextActions(blocked, [blocked], { isLeader: true, isOperational: true, canManage: true })).toEqual([]);
  });

  it("lar avsender fullføre en ferdigbehandlet anmodning", () => {
    const request = item({ isOutgoingRequest: true, status: "assigned", requestProgressStatus: "completed" });
    expect(getTaskNextActions(request, [request], { isLeader: true, isOperational: true, canManage: false })).toEqual([{ status: "completed", label: "Fullfør anmodning" }]);
  });
});
