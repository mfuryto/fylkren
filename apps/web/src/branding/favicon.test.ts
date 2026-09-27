import { describe, expect, it } from "vitest";
import { logoPlacement } from "./favicon";

describe("favicon logo placement", () => {
  it("centres a square logo with padding", () => {
    expect(logoPlacement(256, 256)).toEqual({ x: 4, y: 4, width: 56, height: 56 });
  });

  it("preserves a wide or tall customer's logo without clipping", () => {
    const wide = logoPlacement(200, 100)!;
    const tall = logoPlacement(100, 200)!;
    expect(wide.x).toBeCloseTo(4);
    expect(wide.y).toBeCloseTo(18);
    expect(wide.width).toBeCloseTo(56);
    expect(wide.height).toBeCloseTo(28);
    expect(tall.x).toBeCloseTo(18);
    expect(tall.y).toBeCloseTo(4);
    expect(tall.width).toBeCloseTo(28);
    expect(tall.height).toBeCloseTo(56);
  });

  it("rejects invalid image dimensions", () => {
    expect(logoPlacement(0, 100)).toBeNull();
  });
});
