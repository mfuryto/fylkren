import { describe, expect, it } from "vitest";
import type { WorkItem } from "../work/WorkItemModels";
import { selectScopedItems } from "./taskQueue";

const item = (values: Partial<WorkItem>): WorkItem => ({
  id: "item", title: "Oppdrag", description: "", status: "registered", createdAt: "2026-01-01T00:00:00Z",
  parentWorkItemId: null, parentTitle: null, assignedUnitId: null, isOutgoingRequest: false,
  requestProgressStatus: null, recommendation: null, workItemTypeName: null, sourceTypeName: null,
  senderName: null, senderSiteName: null, senderPersonName: null, unitName: null, createdBy: "Test",
  finalReport: null, requestResponse: null, ...values,
} as WorkItem);

describe("taskQueue", () => {
  it("does not show the same internal subtask separately at the recipient level", () => {
    const root = item({ id: "root", assignedUnitId: "unit" });
    const child = item({ id: "child", parentWorkItemId: "root", assignedUnitId: "unit" });
    expect(selectScopedItems([root, child], "unit").map(value => value.id)).toEqual(["root"]);
  });
});
