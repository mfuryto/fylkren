import { afterEach, describe, expect, it } from "vitest";
import { setActiveLanguage, translate } from "../localization";
import { responseErrorMessage } from "./errors";

afterEach(() => setActiveLanguage("en-US"));

describe("API error meaning", () => {
  it("explains locked information in Norwegian instead of suggesting a reload", async () => {
    setActiveLanguage("nb-NO");
    const response = Response.json({ code: "information_locked", detail: "Load the updated data and try the action again." }, { status: 409 });
    const message = await responseErrorMessage(response, "Failed");
    expect(message).toBe(translate("nb-NO", "lifecycleLockedError"));
    expect(message).not.toBe(translate("en-US", "lifecycleLockedError"));
    expect(message).not.toContain("Load the updated data");
  });
  it("preserves unrelated concurrency and validation messages", async () => {
    const conflict = Response.json({ code: "concurrency_conflict", detail: "Load the updated data and try the action again." }, { status: 409 });
    expect(await responseErrorMessage(conflict, "Failed")).toBe("Load the updated data and try the action again.");
    expect(await responseErrorMessage(Response.json({ errors: { reason: ["Explain the change."] } }), "Failed")).toBe("Explain the change.");
  });
  it("explains an unusable AI plan response in the active language", async () => {
    setActiveLanguage("nb-NO");
    const response = Response.json({ code: "ai_provider_invalid_draft", correlationId: "plan-42" }, { status: 502 });
    const message = await responseErrorMessage(response, "Failed");
    expect(message).toContain("AI-svaret kunne ikke fordeles trygt i planmalen");
    expect(message).toContain("plan-42");
  });
});
