import { useEffect, useMemo, useState } from "react";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import type { WorkItem } from "../work/WorkItemModels";
import { getDescendantWorkload, getOverviewWorkItems, getTaskContext } from "../tasks/taskApi";
import { buildTaskScope } from "../tasks/taskScope";
import { buildOverviewMetrics, canLoadDescendantWorkload, isReceivedRequest, overviewStatusLabels as statusLabels, overviewWorkspaceFor as workspaceFor } from "./overviewModel";
import type { AppPage } from "../navigation/permalinks";
import { useTranslation } from "../localization/LocalizationProvider";
import { errorMessage } from "../api/errors";

const emptyDescendantWorkload = { active: 0, nearDeadline: 0, overdue: 0, unitSummaries: [], siteSummaries: [] };

export function WorkOverview({ onNavigate, language: displayLanguage, timeZone: displayTimeZone, personId }: { onNavigate: (item: AppPage) => void; language: string; timeZone: string; personId?: string }) {
  const t = useTranslation();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [sites, setSites] = useState<TaskSite[]>([]);
  const [units, setUnits] = useState<TaskUnit[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [statisticsYear, setStatisticsYear] = useState(new Date().getFullYear().toString());
  const [descendantWorkload, setDescendantWorkload] = useState<{ active: number; nearDeadline: number; overdue: number; unitSummaries: Array<{ unitId: string; active: number; underway: number; statusCounts: Array<{ status: string; count: number }> }>; siteSummaries: Array<{ siteId: string; active: number; underway: number; statusCounts: Array<{ status: string; count: number }> }> }>({ active: 0, nearDeadline: 0, overdue: 0, unitSummaries: [], siteSummaries: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const preferenceKey = `fylkren:${personId ?? "anonymous"}:subordinate-overview`;
  const [subordinateView, setSubordinateView] = useState<"cards" | "list">(() => window.localStorage.getItem(preferenceKey) === "list" ? "list" : "cards");
  function changeSubordinateView(value: "cards" | "list") {
    setSubordinateView(value);
    window.localStorage.setItem(preferenceKey, value);
  }
  useEffect(() => {
    async function loadContext() {
      try {
        const context = await getTaskContext(personId);
        const operationalSites = context.sites.filter((site) => site.hasOperationalAccess);
        setSites(operationalSites);
        setUnits(context.units);
        const firstSiteId = operationalSites[0]?.siteId ?? "";
        setSelectedSiteId(firstSiteId);
        if (!firstSiteId) setLoading(false);
      } catch (problem) {
        setError(errorMessage(problem,"Arbeidsoversikten kunne ikke lastes."));
        setLoading(false);
      }
    }
    void loadContext();
  }, [personId]);
  useEffect(() => {
    if (!selectedSiteId) return;
    const selectedSite = sites.find((site) => site.siteId === selectedSiteId);
    const mayLoadDescendants = canLoadDescendantWorkload(selectedSite, units, selectedUnitId);
    setLoading(true);
    setError("");
    Promise.all([
      getOverviewWorkItems(selectedSiteId, personId),
      mayLoadDescendants
        ? getDescendantWorkload(selectedSiteId, selectedUnitId, personId).catch(() => emptyDescendantWorkload)
        : Promise.resolve(emptyDescendantWorkload),
    ])
      .then(([workItems, descendant]) => { setItems(workItems); setDescendantWorkload(descendant); })
      .catch(() => setError("Arbeidsoversikten kunne ikke lastes."))
      .finally(() => setLoading(false));
  }, [selectedSiteId, selectedUnitId, personId, sites, units]);
  const selectedSite = sites.find((site) => site.siteId === selectedSiteId);
  const { availableUnits, selectableUnits, directChildUnits, taskLevelCount } = useMemo(
    () => buildTaskScope(units, selectedSiteId, selectedUnitId, selectedSite),
    [units, selectedSiteId, selectedUnitId, selectedSite],
  );
  useEffect(() => {
    if (!selectedSite || selectedSite.hasTopLevelAccess) return;
    if (!selectableUnits.some((unit) => unit.id === selectedUnitId)) setSelectedUnitId(selectableUnits[0]?.id ?? "");
  }, [selectedSiteId, selectedSite?.hasTopLevelAccess, units.length]);
  const { statisticsScope, activeLeafItems, sentRequests, active, nearDeadline, overdue, needsAction } = useMemo(
    () => buildOverviewMetrics(items, selectedUnitId),
    [items, selectedUnitId],
  );
  const descendantUnitIds = (unitId: string) => {
    const ids = new Set<string>([unitId]);
    let changed = true;
    while (changed) { changed = false; for (const unit of availableUnits) if (unit.parentId && ids.has(unit.parentId) && !ids.has(unit.id)) { ids.add(unit.id); changed = true; } }
    return ids;
  };
  const subordinateSummary = directChildUnits.map((unit) => {
    const childSiteSummary = unit.receivingSiteId ? descendantWorkload.siteSummaries.find((summary) => summary.siteId === unit.receivingSiteId) : undefined;
    const levelUnitSummary = descendantWorkload.unitSummaries.find((summary) => summary.unitId === unit.id);
    const subtree = descendantUnitIds(unit.id);
    const unitItems = activeLeafItems.filter((item) => item.assignedUnitId && subtree.has(item.assignedUnitId));
    const statusCounts = Array.from(new Set(unitItems.map((item) => item.status))).map((status) => ({ status, count: unitItems.filter((item) => item.status === status).length }));
    return childSiteSummary
      ? { unit, active: childSiteSummary.active, underway: childSiteSummary.underway, statusCounts: childSiteSummary.statusCounts }
      : levelUnitSummary
        ? { unit, active: levelUnitSummary.active, underway: levelUnitSummary.underway, statusCounts: levelUnitSummary.statusCounts }
      : { unit, active: unitItems.length, underway: unitItems.filter((item) => item.status === "execution" || item.status === "in_progress").length, statusCounts };
  });
  const highestSubordinateLoad = Math.max(0, ...subordinateSummary.map((summary) => summary.active));
  const subordinateLoadScale = Math.max(5, Math.ceil(highestSubordinateLoad / 5) * 5);
  const levelCount = taskLevelCount;
  const statisticsYears = Array.from(new Set(statisticsScope.map((item) => new Date(item.createdAt).getFullYear()))).sort((a, b) => b - a);
  const statisticsItems = statisticsScope.filter((item) => !statisticsYear || new Date(item.createdAt).getFullYear() === Number(statisticsYear));
  if (loading && !selectedSite) {
    return <div className="page overview-page" aria-busy="true"><section className="panel empty-state"><p>Laster oversikt …</p></section></div>;
  }
  return (
    <div className={`page overview-page overview-design-${selectedSite?.overviewDesign ?? "classic"}`}>
      <header className="page-header overview-header">
        <div>
          <span className="overview-eyebrow">Operativt bilde</span>
          <h1>{selectedSite?.name ?? "Oversikt"}</h1>
          <p className="muted">Det som krever handling og oppfølging på valgt arbeidsnivå.</p>
        </div>
      </header>
      {error && <p className="status-message error-message">{error}</p>}
      {(sites.length > 1 || levelCount > 1) && <section className="panel context-bar">
        {sites.length > 1 && <div className="field"><label htmlFor="overview-site">Site</label><select id="overview-site" value={selectedSiteId} onChange={(event) => { setSelectedSiteId(event.target.value); setSelectedUnitId(""); }}>
          {sites.map((site) => <option key={site.siteId} value={site.siteId}>{site.name}</option>)}
        </select></div>}
        {levelCount > 1 && <div className="field"><label htmlFor="overview-level">Arbeidsnivå</label><select id="overview-level" value={selectedUnitId} onChange={(event) => setSelectedUnitId(event.target.value)}>
          {selectedSite?.hasTopLevelAccess && <option value="">Toppnivå</option>}
          {selectableUnits.map((unit) => <option key={unit.id} value={unit.id}>{`${"— ".repeat(unit.depth)}${unit.name}`}</option>)}
        </select></div>}
      </section>}
      <div className="summary-grid overview-summary-grid" aria-label="Oppgavesammendrag">
        <div className="summary-card overview-summary-card overview-summary-action">
          <span><i aria-hidden="true">→</i> Krever handling</span>
          <strong>{loading ? "–" : needsAction.length}</strong>
        </div>
        <div className="summary-card overview-summary-card overview-summary-active">
          <span><i aria-hidden="true">●</i> Aktive</span>
          <strong>{loading ? "–" : selectedUnitId ? active.length : descendantWorkload.active}</strong>
        </div>
        <div className="summary-card overview-summary-card overview-summary-request-sent">
          <span><i aria-hidden="true">↗</i> Sendte anmodninger</span>
          <strong>{loading ? "–" : sentRequests.length}</strong>
        </div>
        <div className="summary-card overview-summary-card overview-summary-deadline">
          <span><i aria-hidden="true">◷</i> Nær frist</span>
          <strong>{loading ? "–" : selectedUnitId ? nearDeadline.length : descendantWorkload.nearDeadline}</strong>
        </div>
        <div className="summary-card overview-summary-card overview-summary-overdue">
          <span><i aria-hidden="true">!</i> Forfalt</span>
          <strong>{loading ? "–" : selectedUnitId ? overdue.length : descendantWorkload.overdue}</strong>
        </div>
      </div>
      {!loading && needsAction.length > 0 && <section className="panel overview-section overview-action-section">
        <div className="section-heading"><div><h2>Krever handling</h2><p className="muted">Nyeste først</p></div></div>
        <div className="admin-list">{needsAction.slice(0, 8).map((item) => <div className="admin-list-row overview-work-row" key={item.id}>
          <span><strong>{item.title}</strong><small className="muted"><b className={`overview-status-dot overview-status-${item.status}`} aria-hidden="true" />{item.isOutgoingRequest ? `Sendt anmodning · ${item.requestProgressStatus === "completed" ? "Besvart" : ["rejected", "cancelled"].includes(item.requestProgressStatus ?? "") ? "Avsluttet" : "Under behandling"}` : isReceivedRequest(item) ? `Mottatt anmodning · ${statusLabels[item.status] ?? item.status}` : statusLabels[item.status] ?? item.status}{item.dueAt ? ` · frist ${new Date(item.dueAt).toLocaleDateString(displayLanguage, { timeZone: displayTimeZone })}` : ""}{item.unitName ? ` · ${item.unitName}` : ""}</small></span>
          <button className="secondary-button" type="button" onClick={() => onNavigate(workspaceFor(item))}>{t("openInWorkspace", { workspace: t(workspaceFor(item) === "Planning" ? "navPlanning" : workspaceFor(item) === "Execution" ? "navExecution" : "navTasks") })}</button>
        </div>)}</div>
      </section>}
      {!loading && subordinateSummary.length > 0 && <section className="panel overview-section overview-units-section">
        <div className="section-heading"><div><h2>Oppdrag i underenhetene</h2><p className="muted">Aktuell arbeidsmengde i direkte underlagte enheter</p></div><div className="view-switch" role="group" aria-label="Visning"><button className={subordinateView === "cards" ? "active" : ""} type="button" onClick={() => changeSubordinateView("cards")}>Kort</button><button className={subordinateView === "list" ? "active" : ""} type="button" onClick={() => changeSubordinateView("list")}>Liste</button></div></div>
        <div className={`overview-unit-grid overview-unit-${subordinateView}`}>{subordinateSummary.map(({ unit, active: activeCount, underway, statusCounts }) => <article className="overview-unit-card" key={unit.id}>
          <div className="overview-unit-heading"><span><strong>{unit.name}</strong><small className="muted">{unit.receivingSiteId ? "Child-site" : "Direkte underenhet"}</small></span><span className="overview-unit-count"><strong className="overview-unit-total">{activeCount}</strong><small className="muted">aktive</small></span></div>
          <div><small className="muted overview-unit-load-label">Aktiv oppdragsbelastning</small><div className="overview-unit-progress" role="meter" aria-label={`Aktiv oppdragsbelastning for ${unit.name}`} aria-valuemin={0} aria-valuemax={subordinateLoadScale} aria-valuenow={activeCount}><span style={{ width: `${activeCount ? Math.max(8, Math.min(100, activeCount / subordinateLoadScale * 100)) : 0}%` }} /></div></div>
          <p><strong>{underway}</strong> under utførelse av {activeCount} aktive</p>
          <small className="muted overview-unit-status">{statusCounts.length ? statusCounts.map(({ status, count }) => `${statusLabels[status] ?? status}: ${count}`).join(" · ") : "Ingen aktive oppdrag"}</small>
          {unit.receivingSiteId && <small className="muted overview-unit-followup">Oppfølging skjer gjennom styring og rapportering.</small>}
        </article>)}</div>
      </section>}
      {!loading && <section className="panel overview-section overview-statistics">
        <div className="section-heading">
          <div><h2>Oppdragsstatistikk</h2><p className="muted">Oppdrag mottatt på valgt arbeidsnivå</p></div>
          <div className="field"><label htmlFor="overview-statistics-year">År</label><select id="overview-statistics-year" value={statisticsYear} onChange={(event) => setStatisticsYear(event.target.value)}>
            <option value="">Alle år</option>
            {Array.from(new Set([...(statisticsYear ? [Number(statisticsYear)] : []), ...statisticsYears])).sort((a, b) => b - a).map((year) => <option key={year} value={year}>{year}</option>)}
          </select></div>
        </div>
        <div className={`summary-grid overview-statistics-grid${selectedUnitId ? " overview-statistics-grid-compact" : ""}`} aria-label="Årsstatistikk for oppdrag">
          <div className="summary-card overview-stat-card"><span>Registrerte og mottatte oppdrag</span><strong>{statisticsItems.filter((item) => !item.isOutgoingRequest && !isReceivedRequest(item)).length}</strong></div>
          <div className="summary-card overview-stat-card"><span>Gjennomførte oppdrag</span><strong>{statisticsItems.filter((item) => !item.isOutgoingRequest && !isReceivedRequest(item) && item.status === "completed").length}</strong></div>
          {!selectedUnitId && <div className="summary-card overview-stat-card"><span>Avviste oppdrag</span><strong>{statisticsItems.filter((item) => !item.isOutgoingRequest && !isReceivedRequest(item) && item.status === "rejected").length}</strong></div>}
          {!selectedUnitId && <div className="summary-card overview-stat-card"><span>Kansellerte oppdrag</span><strong>{statisticsItems.filter((item) => !item.isOutgoingRequest && !isReceivedRequest(item) && item.status === "cancelled").length}</strong></div>}
          <div className="summary-card overview-stat-card overview-stat-request-sent"><span>Sendte anmodninger</span><strong>{statisticsItems.filter((item) => item.isOutgoingRequest).length}</strong></div>
          <div className="summary-card overview-stat-card overview-stat-request-received"><span>Mottatte anmodninger</span><strong>{statisticsItems.filter(isReceivedRequest).length}</strong></div>
        </div>
      </section>}
    </div>
  );
}
