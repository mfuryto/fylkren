import { useEffect, useMemo, useState } from "react";
import type { TaskSite } from "../work/WorkContextModels";
import { getTaskContext, getWorkloadHistory } from "../tasks/taskApi";
import { buildWorkloadHistoryLines, type WorkloadHistoryPoint } from "./workloadHistoryModel";
import { errorMessage } from "../api/errors";

const colors = ["#164e63", "#2563eb", "#7c3aed", "#b45309", "#047857", "#be123c", "#4f46e5"];

export function WorkloadHistoryPage({ language, timeZone, personId }: { language: string; timeZone: string; personId?: string }) {
  const [sites, setSites] = useState<TaskSite[]>([]);
  const [siteId, setSiteId] = useState("");
  const [points, setPoints] = useState<WorkloadHistoryPoint[]>([]);
  const [availableFrom, setAvailableFrom] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getTaskContext(personId)
      .then(context => {
        const values = context.sites.filter(site => site.isTopLevelLeader);
        setSites(values);
        setSiteId(values[0]?.siteId ?? "");
        if (!values.length) setLoading(false);
      })
      .catch(problem => { setError(errorMessage(problem,"Belastningskonteksten kunne ikke lastes.")); setLoading(false); });
  }, [personId]);
  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    getWorkloadHistory<WorkloadHistoryPoint>(siteId)
      .then(value => { setAvailableFrom(value.availableFrom); setPoints(value.points); setError(""); })
      .catch(problem => setError(errorMessage(problem,"Belastningshistorikken kunne ikke lastes.")))
      .finally(() => setLoading(false));
  }, [siteId]);

  const { lines, maximum } = useMemo(() => buildWorkloadHistoryLines(points), [points]);
  const x = (index: number) => 46 + index * (828 / Math.max(1, points.length - 1));
  const y = (value: number) => 250 - value / maximum * 210;

  return <div className="page workload-history-page">
    <header className="page-header"><div><h1>Belastning</h1><p className="muted">Registrert oppdragsbelastning de siste 12 månedene.</p></div></header>
    {sites.length > 1 && <div className="field workload-site-select">
      <label htmlFor="workload-site">Site</label>
      <select id="workload-site" value={siteId} onChange={event => setSiteId(event.target.value)}>
        {sites.map(site => <option value={site.siteId} key={site.siteId}>{site.name}</option>)}
      </select>
    </div>}
    {error && <p className="status-message error-message">{error}</p>}
    <section className="panel workload-chart-panel">
      <div className="section-heading"><div><h2>Aktive oppdrag over tid</h2><p className="muted">Månedlige målepunkter. Kurvene viser registrerte oppdrag, ikke bemanning eller samlet kapasitet.</p></div></div>
      {loading ? <p className="muted">Laster belastningshistorikk …</p> : <>
        {availableFrom && <p className="workload-availability">Historikk er tilgjengelig fra {new Date(availableFrom).toLocaleDateString(language, { timeZone })}.</p>}
        <div className="workload-chart-scroll"><svg className="workload-chart" viewBox="0 0 920 300" role="img" aria-label="Registrert oppdragsbelastning de siste 12 månedene">
          {[0, .25, .5, .75, 1].map(part => <g key={part}><line x1="46" x2="874" y1={250 - part * 210} y2={250 - part * 210} className="workload-grid-line"/><text x="38" y={254 - part * 210} textAnchor="end">{Math.round(maximum * part)}</text></g>)}
          {points.map((point, index) => <text key={point.at} x={x(index)} y="277" textAnchor="middle">{new Date(point.at).toLocaleDateString(language, { month: "short", timeZone })}</text>)}
          {lines.map((line, lineIndex) => <polyline key={line.key} points={line.values.map((value, index) => `${x(index)},${y(value)}`).join(" ")} fill="none" stroke={colors[lineIndex % colors.length]} strokeWidth={lineIndex === 0 ? 4 : 2.5}><title>{line.name}</title></polyline>)}
        </svg></div>
        <div className="workload-legend">{lines.map((line, index) => <span key={line.key}><i style={{ background: colors[index % colors.length] }}/>{line.name}{line.kind === "site" ? " (child-site)" : ""}</span>)}</div>
      </>}
    </section>
  </div>;
}
