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
    nextActions={status === "in_review" ? [{ status: options.approved ? "completed" : "in_progress", label: options.approved ? "Fullfør" : "Returner" }] : []}
    canDelegate={false} canSendRequest={options.canSendRequest ?? false} pendingChildren={[]}
    onDecision={noop} onStatus={noop} onReview={noop} onDelegate={noop} onSendRequest={noop}
    onReleasePlan={noop} onPlanDecision={noop} onApprovePlan={noop} onOpenReport={noop} onApproveReport={noop}
  />);
}

describe("Neste steg på Oppgaver", () => {
  it("samler lederbeslutning og anmodning i én boks", () => {
    const html = renderActions("under_review", { canSendRequest: true });
    expect(html.match(/task-action-panel/g)).toHaveLength(1);
    expect(html).toContain("Neste steg");
    expect(html).toContain("Godkjenn og fordel");
    expect(html).toContain("Send anmodning");
    expect(html).not.toContain("Lederbeslutning");
  });

  it("viser planbeslutninger bare for leder", () => {
    expect(renderActions("planning_approval", { hasPlan: true })).toContain("Godkjenn plan");
    expect(renderActions("planning_approval", { hasPlan: true, canManage: false })).not.toContain("Godkjenn plan");
  });

  it("samler rapportskriving, retur og godkjenning", () => {
    const empty = renderActions("in_review");
    expect(empty).toContain("Skriv sluttrapport");
    expect(empty).toContain("Returner");
    const written = renderActions("in_review", { finalReport: "Rapport" });
    expect(written).toContain("Rediger sluttrapport");
    expect(written).toContain("Godkjenn sluttrapport");
  });
});
