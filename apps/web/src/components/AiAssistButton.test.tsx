import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiAssistButton } from "./AiAssistButton";

describe("AI assistance button", () => {
  it("uses the common visible icon and working state", () => {
    const html = renderToStaticMarkup(<AiAssistButton label="AI is working" working disabled/>);
    expect(html).toContain("ai-assist-button working");
    expect(html).toContain("ai-assist-icon");
    expect(html).toContain("AI is working");
    expect(html).not.toContain("✦");
  });
});
