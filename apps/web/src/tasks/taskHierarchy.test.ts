import { describe, expect, it } from "vitest";
import type { WorkItem } from "../work/WorkItemModels";
import type { TaskUnit } from "../work/WorkContextModels";
import { buildReportUnitPath, buildWorkContextTree } from "./taskHierarchy";

const item = (values: Partial<WorkItem>): WorkItem => ({
  id: "item", siteId: "site", parentWorkItemId: null, parentTitle: null,
  workItemTypeId: null, workItemTypeName: null, sourceTypeId: null, sourceTypeName: null,
  senderId: null, senderName: null, senderSiteName: null, senderPersonName: null,
  requestBasisSnapshot: null, isCrossSiteView: false, title: "Oppdrag", description: "",
  recommendation: null, referenceUrl: null, priority: "normal", status: "assigned", dueAt: null,
  assignedUnitId: null, unitName: null, isAssignedToMe: true, hasPlan: false,
  workflowCurrentStep: null, workflowStepCount: 0, workflowStepName: null,
  executionStatus: null, executionWorkflowName: null, executionCurrentStep: null,
  executionStepCount: 0, executionStepName: null, awaitingExternalResponses: 0, dependencyCount: 0, isBlocked: false, blockingDependencyCount: 0, decisionCount: 0,
  decisionNote: null, finalReport: null, finalReportClassification: null,
  finalReportCreatedAt: null, finalReportUpdatedAt: null, finalReportWrittenBy: null,
  finalReportApprovedAt: null, finalReportApprovedBy: null, createdBy: "Test",
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  isOutgoingRequest: false, requestRecipientSiteName: null, requestRecipientIsExternal: false,
  requestProgressStatus: null, requestResponse: null, ...values,
});

const unit = (values: Partial<TaskUnit>): TaskUnit => ({
  id: "unit", siteId: "site", name: "Enhet", parentId: null, isSiteLeadership: false,
  sortOrder: 0, assignedToMe: true, isLeader: false, ...values,
});

describe("taskHierarchy", () => {
  it("bygger hele oppdragskjeden fra roten og sorterer søsken kronologisk", () => {
    const root = item({ id: "root" });
    const later = item({ id: "later", parentWorkItemId: "root", createdAt: "2026-01-03T00:00:00Z" });
    const earlier = item({ id: "earlier", parentWorkItemId: "root", createdAt: "2026-01-02T00:00:00Z" });
    const leaf = item({ id: "leaf", parentWorkItemId: "earlier" });
    expect(buildWorkContextTree(leaf, [later, leaf, root, earlier]).map(value => [value.item.id, value.depth]))
      .toEqual([["root", 0], ["earlier", 1], ["leaf", 2], ["later", 1]]);
  });

  it("utelater toppledelsesenheten fra rapportstien", () => {
    const leadership = unit({ id: "leadership", name: "Ledelse", isSiteLeadership: true });
    const section = unit({ id: "section", name: "Seksjon", parentId: "leadership" });
    const team = unit({ id: "team", name: "Team", parentId: "section" });
    expect(buildReportUnitPath([leadership, section, team], "site", "team")).toEqual(["Seksjon", "Team"]);
  });
});
