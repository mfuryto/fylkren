import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocalizationProvider } from "../localization/LocalizationProvider";
import { supportedLanguages, translate } from "../localization";
import { ActivityEntry } from "./ActivityTimeline";
import { executionActivityLabel } from "./executionActivityLabel";

const t = (key: Parameters<typeof translate>[1]) => translate("en-US", key);
describe("execution activity labels shared by timeline and site audit", () => {
  it("distinguishes documentation, navigation and external follow-up", () => {
    expect(executionActivityLabel("execution.step-documented", 2, "Delivery", t)).toBe("Step 2: Delivery – Documentation updated");
    expect(executionActivityLabel("execution.step-changed", 3, "Closing", t)).toBe("Step 3: Closing – Switched to step");
    expect(executionActivityLabel("execution.external-response-recorded", null, null, t)).toBe(t("auditExternalResponse"));
  });
  it("does not invent step details for historical entries", () => {
    expect(executionActivityLabel("execution.step-changed", null, null, t)).toBe("Switched to step");
    expect(executionActivityLabel(undefined, null, null, t)).toBeNull();
  });
  it("renders the correlated action and safely escapes step snapshots", () => {
    const html = renderToStaticMarkup(<LocalizationProvider language="en-US"><ActivityEntry timeZone="UTC" row={{ id: "event", type: "execution.updated", action: "execution.step-changed", stepNumber: 2, stepName: "<img src=x>", occurredAt: "2026-10-04T10:30:00Z", source: "local", actorKind: "person", contextWorkItemId: "task" }} /></LocalizationProvider>);
    expect(html).toContain("Step 2: &lt;img src=x&gt; – Switched to step");
    expect(html).not.toContain("<img"); expect(html).not.toContain("Documentation updated");
  });
  it("provides a generic update label for every language when no specific action exists", () => {
    for (const language of supportedLanguages) expect(translate(language, "auditExecutionUpdated")).not.toBe("auditExecutionUpdated");
    const html = renderToStaticMarkup(<LocalizationProvider language="en-US"><ActivityEntry timeZone="UTC" row={{ id: "event", type: "execution.updated", occurredAt: "2026-10-04T10:30:00Z", source: "legacy", actorKind: "person", contextWorkItemId: "task" }} /></LocalizationProvider>);
    expect(html).toContain("Execution updated");
  });
});
