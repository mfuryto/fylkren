import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WorkItem } from "../work/WorkItemModels";
import { TaskAiAssistant } from "./TaskAiAssistant";

describe("Task AI assistant", () => {
  it("presents planning, risk and decision drafts as separate bounded actions", () => {
    const item = { id: "00000000-0000-0000-0000-000000000001", title: "Synthetic task" } as WorkItem;
    const html = renderToStaticMarkup(<TaskAiAssistant siteId="00000000-0000-0000-0000-000000000002" item={item}
      features={["planning", "risks", "decisions"]} language="en-US" timeZone="UTC" onClose={() => undefined} />);
    expect(html).toContain("Plan draft");
    expect(html).toContain("Risk and mitigation draft");
    expect(html).toContain("Decision basis draft");
    expect(html).not.toContain("Draft suggestions</option>");
  });

  it("locks a contextual planning request to the planning action", () => {
    const item = { id: "00000000-0000-0000-0000-000000000001", title: "Synthetic task" } as WorkItem;
    const html = renderToStaticMarkup(<TaskAiAssistant siteId="00000000-0000-0000-0000-000000000002" item={item}
      features={["planning"]} fixedFeature="planning" contextId="00000000-0000-0000-0000-000000000003"
      targetId="00000000-0000-0000-0000-000000000004" language="en-US" timeZone="UTC"
      onUseDraft={() => undefined} onClose={() => undefined} />);
    expect(html).toContain("Plan draft: Synthetic task");
    expect(html).not.toContain("ai-assistant-feature");
  });
});
