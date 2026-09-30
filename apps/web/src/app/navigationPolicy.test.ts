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
      "Tasks",
    );
    expect(result.effectiveItem).toBe("Platform");
    expect(result.navigationItems).toContain("Sites");
    expect(result.navigationItems).toContain("Federation");
    expect(result.navigationItems).not.toContain("Tasks");
  });

  it("keeps site administration separate from operational navigation", () => {
    const result = buildNavigation(
      session({ managesSites: true }),
      "Organization",
    );
    expect(result.navigationItems).toContain("Personnel");
    expect(result.navigationItems).toContain("Workflows");
    expect(result.navigationItems).not.toContain("Tasks");
  });

  it("forces password changes through the profile", () => {
    const result = buildNavigation(
      session({ mustChangePassword: true, hasOperationalRole: true }),
      "Overview",
    );
    expect(result.effectiveItem).toBe("Profile");
    expect(result.navigationItems).toEqual([]);
  });
});
