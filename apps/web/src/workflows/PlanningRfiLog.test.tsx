import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { WorkItemDetails } from "../work/WorkItemModels";
import { TaskPlanContent } from "../tasks/TaskContextDialogs";
import { PlanningRfiLog } from "./PlanningRfiLog";

describe("planning RFI", () => {
  it("offers the same log from the plan-step editor", () => {
    const html = renderToStaticMarkup(<PlanningRfiLog runId="run" entries={[]} onReload={vi.fn()} onError={vi.fn()} />);
    expect(html).toContain("RFI · Request for information");
    expect(html).toContain('aria-expanded="false"');
  });

  it("keeps answered entries readable with the plan", () => {
    const details = {
      task: { id: "task", parentWorkItemId: null },
      plan: {
        id: "plan", ownerWorkItemId: "task", steps: [], allocations: [], requests: [],
        rfi: [{ id: "rfi", who: "Seksjon 1", what: "Kan tankbilen komme?", dueOn: "2026-10-15", answered: true, answer: "Ja." }],
      },
    } as unknown as WorkItemDetails;
    const html = renderToStaticMarkup(<TaskPlanContent details={details} language="nb-NO" />);
    expect(html).toContain("Kan tankbilen komme?");
    expect(html).toContain("Ja.");
    expect(html).toContain("2026-10-15");
  });
});
