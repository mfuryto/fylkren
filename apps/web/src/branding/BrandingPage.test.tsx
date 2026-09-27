import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandingPage } from "./BrandingPage";

describe("appearance administration", () => {
  it("shows customer CSS overrides below the logo box", () => {
    const html = renderToStaticMarkup(<BrandingPage branding={{
      productName: "Fylkren",
      instanceName: "Test",
      theme: "light",
      primaryColor: "#315c53",
      accentColor: "#174d43",
      topBarColor: "#202020",
      topBarTextColor: "#ffffff",
      customCss: ".panel { border-radius: 8px; }",
      hasLogo: false,
    }} onChanged={() => undefined} />);

    expect(html).toContain("Egne CSS-overstyringer");
    expect(html).toContain(".panel { border-radius: 8px; }");
    expect(html.indexOf("Egne CSS-overstyringer")).toBeGreaterThan(html.indexOf("<h2>Logo</h2>"));
  });
});
