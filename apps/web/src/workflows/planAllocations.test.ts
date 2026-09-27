import { describe, expect, it } from "vitest";
import { addPlanAllocation } from "./planAllocations";

describe("addPlanAllocation", () => {
  it("bevarer alle linjene i ett deloppdrag og kan fordele til flere enheter", () => {
    const tasks = Array.from({ length: 10 }, (_, index) => `${index + 1}. Oppgave ${index + 1}`).join("\n");
    const first = addPlanAllocation([], "plan", "seksjon-1", tasks);
    const result = addPlanAllocation(first, "plan", "seksjon-2", "Støtt seksjon 1");
    expect(result).toHaveLength(2);
    expect(result[0].instruction).toBe(tasks);
    expect(result[0].instruction.split("\n")).toHaveLength(10);
    expect(result[1].instruction).toBe("Støtt seksjon 1");
  });

  it("unngår dupliserte deloppdrag til samme mottaker i ett steg", () => {
    const first = addPlanAllocation([], "plan", "seksjon-1", "Oppgave");
    expect(() => addPlanAllocation(first, "plan", "seksjon-1", "Mer arbeid")).toThrow("allerede et deloppdrag");
  });
});
