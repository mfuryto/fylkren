import { describe, expect, it } from "vitest";
import type { WorkItem } from "../work/WorkItemModels";
import { buildOverviewMetrics, canLoadDescendantWorkload, isReceivedRequest, overviewWorkspaceFor } from "./overviewModel";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";

const item = (values: Partial<WorkItem>): WorkItem => ({
  id: "item", siteId: "site", parentWorkItemId: null, parentTitle: null, workItemTypeId: null,
  workItemTypeName: null, sourceTypeId: null, sourceTypeName: null, senderId: null, senderName: null,
  senderSiteName: null, senderPersonName: null, requestBasisSnapshot: null, isCrossSiteView: false,
  title: "Oppdrag", description: "", recommendation: null, referenceUrl: null, priority: "normal",
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
  it("laster bare underordnet belastning for ledertilgang i valgt kontekst", () => {
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

  it("teller aktivt blad i stedet for både hovedoppdrag og aktivt underoppdrag", () => {
    const parent = item({ id: "parent" });
    const child = item({ id: "child", parentWorkItemId: "parent", assignedUnitId: "section" });
    const metrics = buildOverviewMetrics([parent, child], "", new Date("2026-01-01").getTime());
    expect(metrics.active.map(value => value.id)).toEqual(["child"]);
  });

  it("dedupliserer mottatt anmodning i krever handling", () => {
    const request = item({ id: "request", workItemTypeName: "Anmodning", senderSiteName: "Avsender", status: "registered" });
    const metrics = buildOverviewMetrics([request], "", new Date("2026-01-01").getTime());
    expect(metrics.needsAction.map(value => value.id)).toEqual(["request"]);
    expect(isReceivedRequest(request)).toBe(true);
  });

  it("beholder hovedoppdraget som aktivt når en sideanmodning sendes", () => {
    const source = item({ id: "source", status: "in_progress" });
    const sent = item({ id: "sent", parentWorkItemId: "source", parentTitle: source.title,
      workItemTypeName: "Anmodning", isOutgoingRequest: true, status: "in_progress",
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

  it("teller intern fordeling og sideanmodning hver for seg uten dobbelt hovedoppdrag", () => {
    const source = item({ id: "source", status: "in_progress" });
    const internal = item({ id: "internal", parentWorkItemId: "source", assignedUnitId: "section", status: "assigned" });
    const sent = item({ id: "sent", parentWorkItemId: "source", parentTitle: source.title,
      workItemTypeName: "Anmodning", isOutgoingRequest: true, status: "in_progress", requestProgressStatus: "registered" });
    const metrics = buildOverviewMetrics([source, internal, sent], "", new Date("2026-01-01").getTime());
    expect(metrics.active.map(value => value.id)).toEqual(["internal"]);
    expect(metrics.sentRequests.map(value => value.id)).toEqual(["sent"]);
  });

  it("teller mottatt anmodning én gang og lar kvittert kansellering forlate aktiv kø", () => {
    const received = item({ id: "received", workItemTypeName: "Anmodning", senderSiteName: "Avsender", status: "registered" });
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

  it("gjør ikke et aktivt underoppdrag til et handlingskrav på overordnet nivå", () => {
    const parent = item({ id: "parent", status: "in_progress" });
    const child = item({ id: "child", parentWorkItemId: "parent", assignedUnitId: "section", status: "assigned" });
    const metrics = buildOverviewMetrics([parent, child], "", new Date("2026-01-01").getTime());
    expect(metrics.active.map(value => value.id)).toEqual(["child"]);
    expect(metrics.needsAction).toEqual([]);
  });

  it("viser underoppdraget som handlingskrav på mottakende nivå", () => {
    const parent = item({ id: "parent", status: "in_progress" });
    const child = item({ id: "child", parentWorkItemId: "parent", assignedUnitId: "section", status: "assigned" });
    const metrics = buildOverviewMetrics([parent, child], "section", new Date("2026-01-01").getTime());
    expect(metrics.needsAction.map(value => value.id)).toEqual(["child"]);
  });

  it("ruter planlegging og utførelse til riktig arbeidsflate", () => {
    expect(overviewWorkspaceFor(item({ status: "planning_approval" }))).toBe("Tasks");
    expect(overviewWorkspaceFor(item({ status: "planning_approved" }))).toBe("Tasks");
    expect(overviewWorkspaceFor(item({ status: "execution" }))).toBe("Execution");
  });

  it("holder en godkjent, men ikke utsendt plan synlig som handlingskrav", () => {
    const work = item({ status: "planning_approved" });
    const metrics = buildOverviewMetrics([work], "", new Date("2026-01-01").getTime());
    expect(metrics.needsAction.map(value => value.id)).toEqual(["item"]);
  });
});
