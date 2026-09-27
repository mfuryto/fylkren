import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { markdownToEditorHtml, RichTextContent } from "./RichText";

describe("markdownToEditorHtml", () => {
  it("renders headings and escapes user supplied markup", () => {
    expect(markdownToEditorHtml("# Analyse\n<script>alert(1)</script>"))
      .toBe("<h1>Analyse</h1><p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });

  it("keeps unordered and ordered lists as separate blocks", () => {
    expect(markdownToEditorHtml("- Punkt 1\n- Punkt 2\n\n1. Første\n2. Andre"))
      .toBe("<ul><li>Punkt 1</li><li>Punkt 2</li></ul><p><br></p><ol><li>Første</li><li>Andre</li></ol>");
  });

  it("starts a new ordered list after a heading", () => {
    expect(markdownToEditorHtml("1. Første\n2. Andre\n## Ny del\n1. Ny første"))
      .toBe("<ol><li>Første</li><li>Andre</li></ol><h2>Ny del</h2><ol><li>Ny første</li></ol>");
  });

  it("renders stored active-content payloads as inert text", () => {
    const payload = '# <img data-fylkren-xss src=x onerror="alert(1)">\n<script>alert(2)</script>\n- javascript:alert(3)';
    const html = renderToStaticMarkup(createElement(RichTextContent, { value: payload }));

    expect(html).toContain("&lt;img data-fylkren-xss src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&lt;script&gt;alert(2)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
  });
});
