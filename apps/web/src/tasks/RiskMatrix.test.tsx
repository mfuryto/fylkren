import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RiskMatrix, riskCellAt, riskMarkers, type RiskPoint } from "./RiskMatrix";
import { RiskEditor } from "./RiskEditor";
import { emptyRisk, riskLevel } from "./riskModels";

const point: RiskPoint = { id: "one", number: 1, title: "Operational risk", probability: 5, impact: 4, residualProbability: 2, residualImpact: 1 };
describe("risk workspace", () => {
  it("matches the existing product scoring thresholds in every matrix cell", () => {
    for (let probability = 1; probability <= 5; probability++) {
      for (let impact = 1; impact <= 5; impact++) {
        const score = probability * impact;
        expect(riskLevel(probability, impact)).toBe(score <= 4 ? "low" : score <= 9 ? "moderate" : score <= 16 ? "high" : "critical");
      }
    }
  });
  it("places high probability at the top and clamps pointer positions to the assessment scale", () => {
    expect(riskCellAt(73, 23)).toEqual({ probability: 5, impact: 1 });
    expect(riskCellAt(450, 400)).toEqual({ probability: 1, impact: 5 });
    expect(riskCellAt(-100, -100)).toEqual({ probability: 5, impact: 1 });
    expect(riskCellAt(900, 900)).toEqual({ probability: 1, impact: 5 });
  });
  it("keeps coincident before/after assessments and multiple risks individually selectable", () => {
    const points = [point, { ...point, id: "two", number: 2 }, { ...point, id: "three", number: 3, residualProbability: 5, residualImpact: 4 }];
    const markers = riskMarkers(points);
    expect(markers).toHaveLength(6);
    expect(new Set(markers.map(value => `${value.x}:${value.y}`)).size).toBe(6);
    const before = markers.find(value => value.point.id === "one" && value.assessment === "before")!;
    const after = markers.find(value => value.point.id === "one" && value.assessment === "after")!;
    expect(before.x).toBeGreaterThan(after.x);
    expect(before.y).toBeLessThan(after.y);
  });
  it("omits unassessed and invalid coordinates rather than inventing residual risk", () => {
    expect(riskMarkers([{ ...point, residualProbability: null, residualImpact: null }])).toHaveLength(1);
    expect(riskMarkers([{ ...point, probability: 0, residualProbability: null, residualImpact: null }])).toHaveLength(0);
  });
  it("renders linked numbered markers and keyboard-accessible assessment cells", () => {
    const html = renderToStaticMarkup(<RiskMatrix points={[point]} selectedId="one" assessment="before" editable onSelect={vi.fn()} onAssess={vi.fn()} />);
    expect(html.match(/class="risk-cell /g)).toHaveLength(25);
    expect(html).toContain('class="risk-connection selected"');
    expect(html).toContain('class="risk-map-marker before selected"');
    expect(html).toContain('class="risk-map-marker after selected"');
    expect(html).toContain('tabindex="0"');
  });
  it("puts mitigation text and its deadline before residual assessment in the editor", () => {
    const html = renderToStaticMarkup(<RiskEditor draft={emptyRisk} risk={null} busy={false} assessment="before" onAssessment={vi.fn()} onChange={vi.fn()} onSubmit={vi.fn()} onCancel={vi.fn()} onAddMitigation={vi.fn()} onEditMitigation={vi.fn()} />);
    expect(html.indexOf('id="risk-initial-action"')).toBeLessThan(html.indexOf('id="risk-residualProbability"'));
    expect(html.indexOf('id="risk-deadline"')).toBeLessThan(html.indexOf('id="risk-residualProbability"'));
    expect(html).not.toContain('id="risk-probability" type="select"');
  });
});
