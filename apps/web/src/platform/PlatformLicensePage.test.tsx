import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LicenseCertificate } from "./PlatformLicensePage";

describe("Platform license certificate", () => {
  it("presents a verified Enterprise license as a branded certificate", () => {
    const html = renderToStaticMarkup(<LicenseCertificate response={{
      trustedIssuerConfigured: true,
      status: {
        edition: "enterprise",
        state: "valid",
        instanceId: "11111111-1111-1111-1111-111111111111",
        licenseId: "22222222-2222-2222-2222-222222222222",
        customer: "Example Preparedness Ltd",
        expiresAt: "2027-09-28T00:00:00Z",
        entitlements: ["external-identity", "instance-federation"],
      },
    }} />);

    expect(html).toContain("Digital license certificate");
    expect(html).toContain("Fylkren Enterprise");
    expect(html).toContain("Example Preparedness Ltd");
    expect(html).toContain("Signature and instance binding verified");
    expect(html).toContain("External identity");
    expect(html).toContain("Instance federation");
    expect(html).toContain("thunold-olsen-licensing-mark");
  });

  it("does not present Community as a signed commercial license", () => {
    const html = renderToStaticMarkup(<LicenseCertificate response={{
      trustedIssuerConfigured: true,
      status: {
        edition: "community",
        state: "none",
        instanceId: "11111111-1111-1111-1111-111111111111",
        licenseId: null,
        customer: null,
        expiresAt: null,
        entitlements: [],
      },
    }} />);

    expect(html).toContain("Fylkren Community");
    expect(html).toContain("Community can be used without a commercial license");
    expect(html).toContain("No signed license");
    expect(html).not.toContain("Digital license certificate");
  });
});
