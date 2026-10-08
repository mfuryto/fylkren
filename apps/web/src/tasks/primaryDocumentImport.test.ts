import { describe, expect, it } from "vitest";
import { emptyTaskCreateDraft } from "./TaskCreateDialog";
import { taskCreatePayload } from "./taskApi";

describe("primary document import", () => {
  it("defaults AI source use on without sending browser file state in task JSON", () => {
    const draft = emptyTaskCreateDraft();
    expect(draft.usePrimaryDocumentForAi).toBe(true);
    const payload = taskCreatePayload({ ...draft, title: "Document-backed task", referenceUrl: "https://documents.example.invalid/source/42" }, "");
    expect(payload).not.toHaveProperty("primaryDocument");
    expect(payload).not.toHaveProperty("usePrimaryDocumentForAi");
    expect(payload.referenceUrl).toBe("https://documents.example.invalid/source/42");
  });
});
