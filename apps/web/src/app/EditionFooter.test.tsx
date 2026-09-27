import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductShell } from "@fylkren/ui";

describe("edition label in the navigation footer", () => {
  it("defaults to Community below the version", () => {
    const html = renderToStaticMarkup(<ProductShell version="0.68.1" />);
    expect(html).toContain('Fylkren (0.68.1)</span><span class="edition-label">Community</span>');
  });

  it("shows Enterprise only when the effective edition is Enterprise", () => {
    const html = renderToStaticMarkup(<ProductShell version="0.68.1" edition="enterprise" />);
    expect(html).toContain('Fylkren (0.68.1)</span><span class="edition-label">Enterprise</span>');
  });
});
