import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { markdownToEditorHtml, RichTextContent } from "./RichText";

describe("markdownToEditorHtml", () => {
  it.each([
    '<img src=x onerror="synthetic()">',
    '&lt;img src=x onerror="synthetic()"&gt;',
    '%3Cimg%20src=x%20onerror=synthetic()%3E',
    '%253Cimg%2520src=x%2520onerror=synthetic()%253E',
    '</script>\u2028<script>synthetic()</script>',
    '[link](javascript:synthetic())',
    '{{constructor.constructor("synthetic()")()}}',
  ])("keeps literal input inert without decoding it: %s", (payload) => {
    const html = renderToStaticMarkup(createElement(RichTextContent, { value: payload }));
    expect(html).not.toMatch(/<(?:img|script|a)[\s>]/i);
    expect(markdownToEditorHtml(payload)).not.toMatch(/<(?:img|script|a)[\s>]/i);
    if (payload.startsWith('%') || payload.startsWith('[')) expect(html).toContain(payload);
    if (payload.startsWith('{{')) expect(html).toContain('{{constructor.constructor(&quot;synthetic()&quot;)()}}');
    if (payload.startsWith('&lt;')) expect(html).toContain('&amp;lt;');
  });
  it("renders headings and escapes user supplied markup", () => {
    expect(markdownToEditorHtml("# Analysis\n<script>alert(1)</script>"))
      .toBe("<h1>Analysis</h1><p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });

  it("keeps unordered and ordered lists as separate blocks", () => {
    expect(markdownToEditorHtml("- Item 1\n- Item 2\n\n1. First\n2. Second"))
      .toBe("<ul><li>Item 1</li><li>Item 2</li></ul><p><br></p><ol><li>First</li><li>Second</li></ol>");
  });

  it("starts a new ordered list after a heading", () => {
    expect(markdownToEditorHtml("1. First\n2. Second\n## New section\n1. New first"))
      .toBe("<ol><li>First</li><li>Second</li></ol><h2>New section</h2><ol><li>New first</li></ol>");
  });

  it("renders stored active-content payloads as inert text", () => {
    const payload = '# <img data-fylkren-xss src=x onerror="alert(1)">\n<script>alert(2)</script>\n- javascript:alert(3)';
    const html = renderToStaticMarkup(createElement(RichTextContent, { value: payload }));

    expect(html).toContain("&lt;img data-fylkren-xss src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&lt;script&gt;alert(2)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
  });

  it("renders the bounded assistant markdown subset without enabling links or HTML", () => {
    const html = renderToStaticMarkup(createElement(RichTextContent, { value: "**Summary:**\n\n- **Status:** Registered\n\n---\n\n[unsafe](javascript:synthetic())" }));
    expect(html).toContain("<strong>Summary:</strong>");
    expect(html).toContain("<li><strong>Status:</strong><span> Registered</span></li>");
    expect(html).toContain("<hr/>");
    expect(html).toContain("[unsafe](javascript:synthetic())");
    expect(html).not.toContain("<a");
  });
});
