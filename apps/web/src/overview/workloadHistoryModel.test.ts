import { describe, expect, it } from "vitest";
import { buildWorkloadHistoryLines, type WorkloadHistoryPoint } from "./workloadHistoryModel";

describe("workloadHistoryModel", () => {
  it("fills missing measurements with zero", () => {
    const points: WorkloadHistoryPoint[] = [
      { at: "2026-01-01", total: 2, series: [{ key: "unit", name: "Unit", kind: "unit", count: 2 }] },
      { at: "2026-02-01", total: 1, series: [] },
    ];
    const result = buildWorkloadHistoryLines(points);
    expect(result.lines.map(line => [line.key, line.values])).toEqual([["total", [2, 1]], ["unit", [2, 0]]]);
    expect(result.maximum).toBe(2);
  });

  it("uses at least one as the graph scale for empty history", () => {
    expect(buildWorkloadHistoryLines([]).maximum).toBe(1);
  });
});
