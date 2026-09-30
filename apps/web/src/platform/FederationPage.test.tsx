import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FederationPage } from "./FederationPage";

describe("federation administration", () => {
  it("shows the complete GUI and contextual help", () => {
    const html = renderToStaticMarkup(<FederationPage canManage />);
    expect(html).toContain("Help");
    expect(html).toContain("This instance");
    expect(html).toContain("Add peer");
    expect(html).toContain("Peers and connection");
    expect(html).toContain("active top-level site");
    expect(html).not.toContain("Site grants");
    expect(html).toContain("Work routing");
    expect(html).toContain("Retrieve signed identity");
    expect(html).not.toContain("Open License");
  });

  it("keeps federation visible behind one Enterprise notice", () => {
    const html = renderToStaticMarkup(<FederationPage canManage={false} />);
    expect(html).toContain("Requires an Enterprise license");
    expect(html).toContain("Create federation key");
    expect(html).toContain("Retrieve signed identity");
    expect(html).toContain("Work routing");
    expect(html.match(/Requires an Enterprise license/g)).toHaveLength(1);
  });
});
