import { useRef, type PointerEvent } from "react";
import { useTranslation } from "../localization/LocalizationProvider";
import { riskLevel, type Assessment } from "./riskModels";

export type RiskPoint = { id: string; number: number; title: string; probability: number; impact: number; residualProbability: number | null; residualImpact: number | null };
type Marker = { point: RiskPoint; assessment: Assessment; x: number; y: number };
const left = 72, top = 22, cell = 76, size = cell * 5;

export function riskCellAt(x: number, y: number) {
  return { impact: Math.max(1, Math.min(5, Math.floor((x - left) / cell) + 1)), probability: Math.max(1, Math.min(5, 5 - Math.floor((y - top) / cell))) };
}
export function riskMarkers(points: RiskPoint[]): Marker[] {
  const buckets = new Map<string, Array<{ point: RiskPoint; assessment: Assessment }>>();
  for (const point of points) {
    for (const assessment of ["before", "after"] as const) {
      const probability = assessment === "before" ? point.probability : point.residualProbability;
      const impact = assessment === "before" ? point.impact : point.residualImpact;
      if (probability === null || impact === null || !Number.isInteger(probability) || !Number.isInteger(impact) || probability < 1 || probability > 5 || impact < 1 || impact > 5) continue;
      const key = `${probability}:${impact}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push({ point, assessment }); buckets.set(key, bucket);
    }
  }
  return [...buckets].flatMap(([key, bucket]) => {
    const [probability, impact] = key.split(":").map(Number);
    const columns = Math.ceil(Math.sqrt(bucket.length)), rows = Math.ceil(bucket.length / columns);
    return bucket.map((value, index) => ({ ...value,
      x: left + (impact - 1) * cell + cell * ((index % columns) + 1) / (columns + 1),
      y: top + (5 - probability) * cell + cell * (Math.floor(index / columns) + 1) / (rows + 1),
    }));
  });
}

export function RiskMatrix({ points, selectedId, assessment, editable, onSelect, onAssess }: {
  points: RiskPoint[]; selectedId: string | null; assessment: Assessment; editable: boolean;
  onSelect: (id: string) => void; onAssess: (assessment: Assessment, probability: number, impact: number) => void;
}) {
  const t = useTranslation();
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef<Assessment | null>(null);
  const markers = riskMarkers(points);
  function move(event: PointerEvent<SVGSVGElement>) {
    if (!dragging.current || !svg.current) return;
    const transform = svg.current.getScreenCTM()?.inverse();
    if (!transform) return;
    const position = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform);
    const value = riskCellAt(position.x, position.y);
    onAssess(dragging.current, value.probability, value.impact);
  }
  return <section className="risk-map-section">
    <div className="risk-map-heading"><h3>{t("riskMatrix")}</h3><div className="risk-map-legend"><span><i className="risk-marker-before" />{t("riskBeforeMitigation")}</span><span><i className="risk-marker-after" />{t("residualRiskAfterMitigation")}</span></div></div>
    <svg ref={svg} className="risk-matrix" viewBox="0 0 482 464" aria-label={t("riskMatrix")} onPointerMove={move} onPointerUp={event => { move(event); dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }}>
      {Array.from({ length: 25 }, (_, index) => {
        const impact = index % 5 + 1, probability = 5 - Math.floor(index / 5);
        const label = `${t("riskProbability")}: ${probability}, ${t("riskImpact")}: ${impact}`;
        return <rect key={index} x={left + (impact - 1) * cell} y={top + (5 - probability) * cell} width={cell} height={cell} className={`risk-cell risk-cell-${riskLevel(probability, impact)}`} role={editable ? "button" : undefined} tabIndex={editable ? 0 : undefined} aria-label={label} onClick={() => { if (editable) onAssess(assessment, probability, impact); }} onKeyDown={event => { if (editable && ["Enter", " "].includes(event.key)) { event.preventDefault(); onAssess(assessment, probability, impact); } }}><title>{label}</title></rect>;
      })}
      {[1, 2, 3, 4, 5].map(value => <g key={value}><text x={left + (value - .5) * cell} y={top + size + 24} textAnchor="middle">{value}</text><text x={left - 20} y={top + (5 - value + .5) * cell + 5} textAnchor="middle">{value}</text></g>)}
      <text x={left + size / 2} y={top + size + 51} textAnchor="middle" className="risk-axis">{t("riskImpact")}</text>
      <text transform={`translate(20 ${top + size / 2}) rotate(-90)`} textAnchor="middle" className="risk-axis">{t("riskProbability")}</text>
      {points.map(point => {
        const before = markers.find(marker => marker.point.id === point.id && marker.assessment === "before");
        const after = markers.find(marker => marker.point.id === point.id && marker.assessment === "after");
        return before && after && <line key={point.id} x1={before.x} y1={before.y} x2={after.x} y2={after.y} className={`risk-connection${selectedId === point.id ? " selected" : ""}`} />;
      })}
      {markers.map(marker => {
        const label = `${marker.point.number}: ${marker.point.title} · ${t(marker.assessment === "before" ? "riskBeforeMitigation" : "residualRiskAfterMitigation")} · ${t("riskProbability")}: ${marker.assessment === "before" ? marker.point.probability : marker.point.residualProbability} · ${t("riskImpact")}: ${marker.assessment === "before" ? marker.point.impact : marker.point.residualImpact}`;
        return <g key={`${marker.point.id}:${marker.assessment}`} transform={`translate(${marker.x} ${marker.y})`} className={`risk-map-marker ${marker.assessment}${selectedId === marker.point.id ? " selected" : ""}`} role="button" tabIndex={0} aria-label={label} aria-pressed={selectedId === marker.point.id} onClick={event => { event.stopPropagation(); onSelect(marker.point.id); }} onKeyDown={event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); onSelect(marker.point.id); } }} onPointerDown={event => {
          if (editable && selectedId === marker.point.id && svg.current) { event.preventDefault(); dragging.current = marker.assessment; svg.current.setPointerCapture(event.pointerId); }
        }}><title>{label}</title><circle r={13} /><text textAnchor="middle" dominantBaseline="central">{marker.point.number}</text></g>;
      })}
    </svg>
    <div className="risk-map-levels">{(["low", "moderate", "high", "critical"] as const).map(level => <span key={level}><i className={`risk-cell-${level}`} />{t(({ low: "riskLevelLow", moderate: "riskLevelModerate", high: "riskLevelHigh", critical: "riskLevelCritical" } as const)[level])}</span>)}</div>
    {editable && <p className="muted">{t("riskMapHelp")}</p>}
  </section>;
}
