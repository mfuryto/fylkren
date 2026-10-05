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
    expect(result.navigationItems).not.toContain("Learning");
  });

  it("keeps Platform pages available when the same person also manages a Site", () => {
    const dualRole = session({ isPlatformManager: true, managesSites: true, canExecute: true });
    for (const page of ["Sites", "Identity", "Platform"] as const)
      expect(buildNavigation(dualRole, page).effectiveItem).toBe(page);
    expect(buildNavigation(dualRole, "Tasks").effectiveItem).toBe("Platform");
  });

  it("keeps site administration separate from operational navigation", () => {
    const result = buildNavigation(
      session({ managesSites: true }),
      "Organization",
    );
    expect(result.navigationItems).toContain("Personnel");
    expect(result.navigationItems).toContain("Workflows");
    expect(result.navigationItems).not.toContain("Tasks");
    expect(result.navigationItems).not.toContain("Learning");
  });

  it("allows an execution-only member to open internal learning", () => {
    const result = buildNavigation(session({ canExecute: true }), "Learning");
    expect(result.effectiveItem).toBe("Learning");
    expect(result.navigationItems).toContain("Learning");
  });

  it("gives an archive-only custodian a read-only navigation entry", () => {
    const result = buildNavigation(session({ hasArchiveAccess: true }), "Overview");
    expect(result.effectiveItem).toBe("Archives");
    expect(result.navigationItems).toEqual(["Archives"]);
  });

  it("keeps archive custody separate from administrative and operational roles", () => {
    const result = buildNavigation(session({ hasArchiveAccess: true, managesSites: true }), "Archives");
    expect(result.effectiveItem).toBe("Archives");
    expect(result.navigationItems).toContain("Archives");
    expect(result.navigationItems).not.toContain("Tasks");
  });

  it("does not add archive access to an ordinary Platform Manager", () => {
    const result = buildNavigation(session({ isPlatformManager: true }), "Archives");
    expect(result.effectiveItem).toBe("Platform");
    expect(result.navigationItems).not.toContain("Archives");
  });

  it("forces password changes through the profile", () => {
    const result = buildNavigation(
      session({ mustChangePassword: true, hasOperationalRole: true }),
      "Overview",
    );
    expect(result.effectiveItem).toBe("Profile");
    expect(result.navigationItems).toEqual([]);
  });

  it("restricts pending multi-factor enrollment to the profile", () => {
    const result = buildNavigation(
      session({ mfaRequired: true, isPlatformManager: true }),
      "Platform",
    );
    expect(result.effectiveItem).toBe("Profile");
    expect(result.navigationItems).toEqual([]);
  });
});
