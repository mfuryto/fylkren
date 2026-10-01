import { describe, expect, it } from "vitest";
import type { TaskUnit } from "../work/WorkContextModels";
import type { ExecutionItem } from "./ExecutionModels";
import { executionChildUnits, executionDefinitionOptions, executionStatus } from "./executionQueue";

const item = (values: Partial<ExecutionItem> = {}): ExecutionItem => ({
  id: "item", parentWorkItemId: null, assignedUnitId: null, assignedUnitName: null,
  title: "Task", description: "", requestBasisSnapshot: null, recommendation: null,
  referenceUrl: null, priority: "normal", dueAt: null, decisionNote: null, createdBy: "Test",
  createdAt: "2026-01-01T00:00:00Z", hasPlan: false, run: null, ...values,
});

const unit = (values: Partial<TaskUnit>): TaskUnit => ({
  id: "unit", siteId: "site", name: "Unit", parentId: null, isSiteLeadership: false,
  sortOrder: 0, assignedToMe: true, isLeader: false, ...values,
});

describe("executionQueue", () => {
  it("presents known execution statuses", () => {
    expect(executionStatus(item())).toBe("Available");
    expect(executionStatus(item({ run: { id: "run", definitionId: null, definitionName: null, claimedByPersonId: "person", claimedBy: "Test", status: "in_progress", currentStep: 0, timelineStartedOn: null, steps: [] } }))).toBe("In execution");
  });

  it("finds only direct subunits in the correct site", () => {
    const assigned = item({ assignedUnitId: "section" });
    const child = unit({ id: "child", parentId: "section" });
    const nested = unit({ id: "nested", parentId: "child" });
    const foreign = unit({ id: "foreign", siteId: "other", parentId: "section" });
    expect(executionChildUnits([nested, foreign, child], "site", assigned).map(value => value.id)).toEqual(["child"]);
  });

  it("shows global, own, and leadership workflows", () => {
    const leadership = unit({ id: "leadership", isSiteLeadership: true });
    const definitions = [
      { id: "global", name: "Global", ownerUnitId: null },
      { id: "leadership", name: "Leadership", ownerUnitId: "leadership" },
      { id: "other", name: "Other", ownerUnitId: "other" },
    ];
    expect(executionDefinitionOptions(definitions, [leadership], "site", item()).map(value => value.id))
      .toEqual(["global", "leadership"]);
  });
});
