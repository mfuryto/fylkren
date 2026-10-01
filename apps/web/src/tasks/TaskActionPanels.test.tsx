import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { WorkItem } from "../work/WorkItemModels";
import { TaskActionPanels } from "./TaskActionPanels";

function renderActions(status: string, options: { canManage?: boolean; hasPlan?: boolean; finalReport?: string | null; approved?: boolean; canSendRequest?: boolean } = {}) {
  const item = {
    status,
    hasPlan: options.hasPlan ?? false,
    finalReport: options.finalReport ?? null,
    finalReportApprovedAt: options.approved ? "2026-09-23T00:00:00Z" : null,
  } as WorkItem;
  const noop = vi.fn();
  return renderToStaticMarkup(<TaskActionPanels
    item={item} canManage={options.canManage ?? true} childUnitCount={1} busy={false}
    nextActions={status === "in_review" ? [{ status: options.approved ? "completed" : "in_progress", label: options.approved ? "Complete" : "Return" }] : []}
    canDelegate={false} canSendRequest={options.canSendRequest ?? false} pendingChildren={[]}
    onDecision={noop} onStatus={noop} onReview={noop} onDelegate={noop} onSendRequest={noop}
    onReleasePlan={noop} onPlanDecision={noop} onApprovePlan={noop} onOpenReport={noop} onApproveReport={noop}
  />);
}

describe("Next step in Tasks", () => {
  it("combines manager decision and request in one box", () => {
    const html = renderActions("under_review", { canSendRequest: true });
    expect(html.match(/task-action-panel/g)).toHaveLength(1);
    expect(html).toContain("Next step");
    expect(html).toContain("Approve and allocate");
    expect(html).toContain("Send request");
    expect(html).not.toContain("Manager decision");
  });

  it("shows plan decisions only to managers", () => {
    expect(renderActions("planning_approval", { hasPlan: true })).toContain("Approve plan");
    expect(renderActions("planning_approval", { hasPlan: true, canManage: false })).not.toContain("Approve plan");
  });

  it("combines report writing, return, and approval", () => {
    const empty = renderActions("in_review");
    expect(empty).toContain("Write final report");
    expect(empty).toContain("Return");
    const written = renderActions("in_review", { finalReport: "Report" });
    expect(written).toContain("Edit final report");
    expect(written).toContain("Approve final report");
  });
});
