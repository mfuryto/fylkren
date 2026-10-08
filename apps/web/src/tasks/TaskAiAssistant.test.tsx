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
});
