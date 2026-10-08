import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiSettingsPage } from "./AiSettingsPage";

describe("AI settings", () => {
  it("keeps the Enterprise capability visible when it is not entitled", () => {
    const html = renderToStaticMarkup(<AiSettingsPage canManage={false} />);
    expect(html).toContain("AI for Sites");
    expect(html).toContain("Requires an Enterprise license");
  });
});
