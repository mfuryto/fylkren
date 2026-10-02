import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocalizationProvider } from "../localization/LocalizationProvider";
import { TaskCommentsButton, TaskCommentEntry } from "./TaskCommentsButton";

describe("task comments", () => {
  it("shows a compact dialog action without requiring an assignment", () => {
    const html = renderToStaticMarkup(<LocalizationProvider language="en-US"><TaskCommentsButton siteId="site" itemId="task" title="Task" /></LocalizationProvider>);
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('class="task-icon-action"');
    expect(html).toContain("Comments");
    expect(html).not.toContain("textarea");
  });

  it("renders contributor text and names as text, preserving line breaks and a timestamp", () => {
    const html = renderToStaticMarkup(<TaskCommentEntry language="en-GB" timeZone="UTC" comment={{ id: "comment", authorName: '<img src=x onerror="alert(1)">', text: '<script>alert(1)</script>\nAlready solved', createdAt: "2026-10-02T10:30:00Z" }} />);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("\nAlready solved");
    expect(html).toContain("white-space:pre-wrap");
    expect(html).toContain('dateTime="2026-10-02T10:30:00Z"');
    expect(html).toContain("10:30");
  });
});
