import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyTaskCreateDraft, TaskCreateDialog } from "./TaskCreateDialog";
import { taskCreatePayload } from "./taskApi";
import { primaryDocumentIndicator, primaryDocumentStructuredUrl } from "./PrimaryDocumentButton";

describe("primary document import", () => {
  it("defaults AI source use on without sending browser file state in task JSON", () => {
    const draft = emptyTaskCreateDraft();
    expect(draft.usePrimaryDocumentForAi).toBe(true);
    const payload = taskCreatePayload({ ...draft, title: "Document-backed task", referenceUrl: "https://documents.example.invalid/source/42" }, "");
    expect(payload).not.toHaveProperty("primaryDocument");
    expect(payload).not.toHaveProperty("usePrimaryDocumentForAi");
    expect(payload.referenceUrl).toBe("https://documents.example.invalid/source/42");
  });
  it("presents the original link before the related AI file import", () => {
    const html = renderToStaticMarkup(createElement(TaskCreateDialog, {
      form: emptyTaskCreateDraft(), setForm: () => undefined, types: [], sourceTypes: [], senders: [],
      requestTypeSelected: false, recipientQuery: "", setRecipientQuery: () => undefined, recipients: [],
      clearRecipients: () => undefined, selectedUnitId: "", classificationMarkings: [], busy: false,
      aiEnabled: true, onClose: () => undefined, onSubmit: () => undefined,
    }));
    expect(html.indexOf("Link to original document")).toBeGreaterThan(-1);
    expect(html.indexOf("Import primary document")).toBeGreaterThan(html.indexOf("Link to original document"));
    expect(html).toContain("The link above opens the original document for users");
  });
  it("makes import state and version explicit without exposing extracted content", () => {
    expect(primaryDocumentIndicator(2, true, false, "Imported", "Not imported")).toBe("Imported v2");
    expect(primaryDocumentIndicator(null, true, false, "Imported", "Not imported")).toBe("Not imported");
    expect(primaryDocumentIndicator(null, true, true, "Imported", "Not imported")).toBe("?");
    expect(primaryDocumentStructuredUrl("site", "task", "snapshot")).toBe("/api/work/sites/site/items/task/primary-document/snapshot/structured");
  });
});
