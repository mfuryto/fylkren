import { describe, expect, it } from "vitest";
import type { TaskUnit } from "../work/WorkContextModels";
import type { PlanningRun } from "./PlanningModels";
import { buildPlanningLevels, createPlanningDraft, filterPlanningRuns, planningAllocationUnits } from "./planningQueue";

const run = (values: Partial<PlanningRun> = {}): PlanningRun => ({
  id: "run", status: "available", canManage: true, currentStep: 0, timelineStartedOn: null,
  claimedByPersonId: null, claimedBy: null, proposedUnitId: null, proposedUnit: null,
  proposedPriority: null, proposedDueAt: null, resultNote: null, allocations: [], requests: [], rfi: [],
  ancestors: [], item: { id: "item", parentWorkItemId: null, parentTitle: null,
    parentDescription: null, assignedUnitId: null, assignedUnitName: null, title: "Oppdrag",
    description: "", referenceUrl: null, workItemTypeName: null, sourceTypeName: null,
    senderName: null, requestBasisSnapshot: null, priority: "normal", dueAt: null,
    decisionNote: null, finalReport: null, finalReportWrittenBy: null,
    finalReportUpdatedAt: null, createdBy: "Test", createdAt: "2026-01-01T00:00:00Z" },
  steps: [], ...values,
});

const unit = (values: Partial<TaskUnit>): TaskUnit => ({
  id: "unit", siteId: "site", name: "Enhet", parentId: null, isSiteLeadership: false,
  sortOrder: 0, assignedToMe: true, isLeader: false, ...values,
});

describe("planningQueue", () => {
  it("lager unike og alfabetiske arbeidsnivåer og filtrerer toppnivå", () => {
    const top = run({ id: "top" });
    const section = run({ id: "section", item: { ...run().item, assignedUnitId: "section", assignedUnitName: "Seksjon" } });
    expect(buildPlanningLevels([section, top, section])).toEqual([["section", "Seksjon"], ["top", "Toppnivå"]]);
    expect(filterPlanningRuns([section, top], "top")).toEqual([top]);
  });

  it("finner bare direkte underenheter på riktig site", () => {
    const current = run({ item: { ...run().item, assignedUnitId: "section", assignedUnitName: "Seksjon" } });
    const first = unit({ id: "first", name: "Første", parentId: "section", sortOrder: 1 });
    const second = unit({ id: "second", name: "Andre", parentId: "section", sortOrder: 2 });
    const nested = unit({ id: "nested", parentId: "first" });
    const foreign = unit({ id: "foreign", siteId: "other", parentId: "section" });
    expect(planningAllocationUnits([second, nested, foreign, first], "site", current).map(value => value.id))
      .toEqual(["first", "second"]);
  });

  it("viser mottakende child-site sammen med interne underenheter", () => {
    const own = unit({ id: "own", parentId: null });
    const childSite = unit({ id: "child", name: "Child-site", parentId: null, receivingSiteId: "other-site" });
    const leadership = unit({ id: "leadership", isSiteLeadership: true, parentId: null });
    expect(planningAllocationUnits([own, childSite, leadership], "site", run()).map(value => value.id))
      .toEqual(["child", "own"]);
  });

  it("oppretter et redigerbart utkast fra eksisterende plan", () => {
    const source = run({ proposedPriority: "high", proposedDueAt: "2026-09-20T23:59:59Z", allocations: [
      { stepId: "step", unitId: "unit", instruction: "Utfør" },
    ] });
    expect(createPlanningDraft(source)).toEqual({ priority: "high", dueAt: "2026-09-20", allocations: [
      { stepId: "step", unitId: "unit", instruction: "Utfør" },
    ] });
  });
});
