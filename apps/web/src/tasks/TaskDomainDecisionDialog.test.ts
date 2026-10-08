import { describe, expect, it } from "vitest";
import { decisionWorkflowActions } from "./TaskDomainDecisionDialog";

describe("decision workflow actions", () => {
  it("gives drafts explicit record and delete actions", () => {
    expect(decisionWorkflowActions("draft")).toEqual({ canRecord: true, canDeleteDraft: true, canWithdraw: false });
  });

  it("keeps recorded decisions revisable and withdrawable without deleting history", () => {
    expect(decisionWorkflowActions("recorded")).toEqual({ canRecord: false, canDeleteDraft: false, canWithdraw: true });
    expect(decisionWorkflowActions("withdrawn")).toEqual({ canRecord: false, canDeleteDraft: false, canWithdraw: false });
  });
});
