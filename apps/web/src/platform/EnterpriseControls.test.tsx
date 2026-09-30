import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlatformApiPage } from "./PlatformApiPage";

describe("Enterprise controls in the platform UI", () => {
  it("shows disabled Enterprise controls behind consistent notices", () => {
    const html = renderToStaticMarkup(<PlatformApiPage language="nb-NO" timeZone="Europe/Oslo" entitlements={[]} />);
    expect(html).toContain("New API client");
    expect(html).toContain("New webhook");
    expect(html).toContain("New report access grant");
    expect(html).toContain("API clients");
    expect(html).toContain("Assigned report access");
    expect(html).toContain("Delivery history");
    expect(html.match(/Requires an Enterprise license/g)).toHaveLength(2);
  });

  it("removes only the notice for each entitled capability", () => {
    const machineOnly = renderToStaticMarkup(<PlatformApiPage language="nb-NO" timeZone="Europe/Oslo" entitlements={["machine-api"]} />);
    expect(machineOnly).toContain("New API client");
    expect(machineOnly).toContain("New report access grant");
    expect(machineOnly).toContain("New webhook");
    expect(machineOnly.match(/Requires an Enterprise license/g)).toHaveLength(1);
    const all = renderToStaticMarkup(<PlatformApiPage language="nb-NO" timeZone="Europe/Oslo" entitlements={["machine-api", "webhooks"]} />);
    expect(all).toContain("New webhook");
    expect(all).not.toContain("Requires an Enterprise license");
  });
});
