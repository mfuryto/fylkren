import { describe, expect, it } from "vitest";
import type { Session } from "../work/WorkContextModels";
import { buildNavigation } from "./navigationPolicy";

const session = (values: Partial<Session>): Session => ({
  authenticated: true,
  isPlatformManager: false,
  ...values,
});

describe("navigation policy", () => {
  it("isolates Platform Manager navigation from operational pages", () => {
    const result = buildNavigation(
      session({ isPlatformManager: true }),
      "Oppgaver",
    );
    expect(result.effectiveItem).toBe("Plattform");
    expect(result.navigationItems).toContain("Sites");
    expect(result.navigationItems).toContain("Federering");
    expect(result.navigationItems).not.toContain("Oppgaver");
  });

  it("keeps site administration separate from operational navigation", () => {
    const result = buildNavigation(
      session({ managesSites: true }),
      "Organisasjon",
    );
    expect(result.navigationItems).toContain("Personell");
    expect(result.navigationItems).toContain("Arbeidsflyter");
    expect(result.navigationItems).not.toContain("Oppgaver");
  });

  it("forces password changes through the profile", () => {
    const result = buildNavigation(
      session({ mustChangePassword: true, hasOperationalRole: true }),
      "Oversikt",
    );
    expect(result.effectiveItem).toBe("Profil");
    expect(result.navigationItems).toEqual([]);
  });
});
