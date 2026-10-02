import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WorkItem } from "../work/WorkItemModels";
import { TaskReportDocument } from "./TaskReportDocument";

function reportItem(originReference: string | null) {
  return {
    referenceCode: "INS-000123",
    originReference,
    title: "Inspection",
    finalReport: "# Summary\n\nComplete.",
    finalReportCreatedAt: "2026-10-02T09:00:00Z",
    finalReportUpdatedAt: "2026-10-02T10:00:00Z",
    finalReportWrittenBy: "Writer",
    finalReportApprovedBy: "Approver",
    createdBy: "Creator",
    createdAt: "2026-10-01T08:00:00Z",
  } as WorkItem;
}

describe("final-report reference metadata", () => {
  it("includes both the local and external reference when present", () => {
    const html = renderToStaticMarkup(<TaskReportDocument
      item={reportItem("REQ-004291")}
      siteName="Example Site"
      unitPath={[]}
      rootTitle="Inspection"
      language="en-GB"
      timeZone="UTC"
    />);

    expect(html).toContain("INS-000123");
    expect(html).toContain("Origin reference");
    expect(html).toContain("REQ-004291");
  });

  it("does not invent external reference metadata for local work", () => {
    const html = renderToStaticMarkup(<TaskReportDocument
      item={reportItem(null)}
      siteName="Example Site"
      unitPath={[]}
      rootTitle="Inspection"
      language="en-GB"
      timeZone="UTC"
    />);

    expect(html).toContain("INS-000123");
    expect(html).not.toContain("Origin reference");
  });
});
