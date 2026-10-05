import { describe, expect, it } from "vitest";
import { roleDisplayName } from "./roleDisplayName";

describe("roleDisplayName", () => {
  it("shows the system leader role in the active language", () => {
    expect(roleDisplayName({ name: "Manager", isLeader: true }, "leder", "nb-NO"))
      .toBe("Leder");
  });

  it("preserves customer-defined work role names", () => {
    expect(roleDisplayName({ name: "Vaktleder", isLeader: false }, "leder", "nb-NO"))
      .toBe("Vaktleder");
  });
});
