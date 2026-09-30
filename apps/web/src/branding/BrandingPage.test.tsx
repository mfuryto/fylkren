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
    }} regionalSettings={{
      defaultLanguage: "en",
      timeZone: "UTC",
      clockFormat: "24-hour",
      measurementSystem: "metric",
    }} onChanged={() => undefined} onRegionalChanged={() => undefined} />);

    expect(html).toContain("Custom CSS overrides");
    expect(html).toContain(".panel { border-radius: 8px; }");
    expect(html.indexOf("Custom CSS overrides")).toBeGreaterThan(html.indexOf("<h2>Logo</h2>"));
  });

  it("uses English as the complete fallback and exposes regional controls", () => {
    const html = renderToStaticMarkup(<BrandingPage branding={{
      productName: "Fylkren", instanceName: "Test", theme: "light",
      primaryColor: "#315c53", accentColor: "#174d43",
      topBarColor: "#202020", topBarTextColor: "#ffffff",
      customCss: "", hasLogo: false,
    }} regionalSettings={{
      defaultLanguage: "en", timeZone: "UTC", clockFormat: "24-hour",
      measurementSystem: "metric",
    }} onChanged={() => undefined} onRegionalChanged={() => undefined} />);

    expect(html).toContain("Language and regional settings");
    expect(html).toContain("12-hour clock");
    expect(html).toContain("Measurement system");
  });
});
