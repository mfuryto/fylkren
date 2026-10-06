import { describe, expect, it } from "vitest";
import { roleDisplayName } from "./roleDisplayName";

describe("roleDisplayName", () => {
  it("shows the system leader role in the active language", () => {
    expect(roleDisplayName({ name: "Manager", isLeader: true }, "\u006c\u0065\u0064\u0065\u0072", "nb-NO"))
      .toBe("\u004c\u0065\u0064\u0065\u0072");
  });

  it("preserves customer-defined work role names", () => {
    expect(roleDisplayName({ name: "Vakt\u006c\u0065\u0064\u0065\u0072", isLeader: false }, "\u006c\u0065\u0064\u0065\u0072", "nb-NO"))
      .toBe("Vakt\u006c\u0065\u0064\u0065\u0072");
  });
});
