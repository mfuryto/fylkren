import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlatformApiPage } from "./PlatformApiPage";

describe("Enterprise controls in the platform UI", () => {
  it("shows disabled Enterprise controls behind consistent notices", () => {
    const html = renderToStaticMarkup(<PlatformApiPage language="nb-NO" timeZone="Europe/Oslo" entitlements={[]} />);
    expect(html).toContain("Ny API-klient");
    expect(html).toContain("Ny webhook");
    expect(html).toContain("Ny rapporttilgang");
    expect(html).toContain("API-klienter");
    expect(html).toContain("Tildelte rapporttilganger");
    expect(html).toContain("Leveringshistorikk");
    expect(html.match(/Krever Enterpriselisens/g)).toHaveLength(2);
  });

  it("removes only the notice for each entitled capability", () => {
    const machineOnly = renderToStaticMarkup(<PlatformApiPage language="nb-NO" timeZone="Europe/Oslo" entitlements={["machine-api"]} />);
    expect(machineOnly).toContain("Ny API-klient");
    expect(machineOnly).toContain("Ny rapporttilgang");
    expect(machineOnly).toContain("Ny webhook");
    expect(machineOnly.match(/Krever Enterpriselisens/g)).toHaveLength(1);
    const all = renderToStaticMarkup(<PlatformApiPage language="nb-NO" timeZone="Europe/Oslo" entitlements={["machine-api", "webhooks"]} />);
    expect(all).toContain("Ny webhook");
    expect(all).not.toContain("Krever Enterpriselisens");
  });
});
