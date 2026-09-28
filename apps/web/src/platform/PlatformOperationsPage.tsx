import { useEffect, useState } from "react";
import { apiGet } from "../api/client";
import { errorMessage } from "../api/errors";

type Operations = {
  checkedAt: string;
  version: string;
  environment: string;
  startedAt: string;
  uptimeSeconds: number;
  processMemoryBytes: number;
  services: Array<{ key: string; name: string; status: "healthy" | "degraded" | "down" | "unknown"; detail: string; restartCount: number | null }>;
  hostIntegration: {
    configured: boolean; available: boolean; stale: boolean; problem: string | null;
    collectedAt: string | null; platform: string | null; hostname: string | null;
    disk: { name: string; totalBytes: number; availableBytes: number } | null;
    backup: { lastCompletedAt: string | null } | null;
  };
};

type LogEntry = {
  sequence: number;
  occurredAt: string;
  level: string;
  category: string;
  eventId: number;
  message: string;
  exceptionType: string | null;
};

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return [days ? `${days} d` : "", hours ? `${hours} t` : "", `${minutes} min`].filter(Boolean).join(" ");
}

function formatBytes(bytes: number) {
  const gibibytes = bytes / 1024 / 1024 / 1024;
  return `${gibibytes >= 10 ? gibibytes.toFixed(0) : gibibytes.toFixed(1)} GB`;
}

function hostStatusMessage(operations: Operations) {
  const host = operations.hostIntegration;
  if (!host.configured) return "Vertsovervåking er ikke konfigurert.";
  if (host.problem === "stale") return "Vertsmålingen er for gammel. Kontroller fylkren-host-status.timer på serveren.";
  if (!host.available) return "Ingen gyldig vertsmåling er mottatt. Kjør sudo ./deploy/host-status/install.sh på serveren.";
  return `Vertsmåling fra ${host.hostname ?? "serveren"}${host.collectedAt ? ` · ${new Date(host.collectedAt).toLocaleString()}` : ""}.`;
}

export function PlatformPage() {
  const [operations, setOperations] = useState<Operations | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState("Warning");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const loadStatus = async () => setOperations(await apiGet<Operations>("/api/platform/operations", "Systemstatus kunne ikke lastes."));
  const loadLogs = async () => {
    const query = new URLSearchParams({ level, limit: "100" });
    if (search.trim()) query.set("search", search.trim());
    const data = await apiGet<{ entries: LogEntry[] }>(`/api/platform/operations/logs?${query}`, "Loggene kunne ikke lastes.");
    setLogs(data.entries ?? []);
  };

  useEffect(() => {
    Promise.all([loadStatus(), loadLogs()]).catch(problem => setError(errorMessage(problem,"Systemstatus og logger kunne ikke lastes.")));
  }, []);

  const refresh = async () => {
    setError("");
    try {
      await Promise.all([loadStatus(), loadLogs()]);
    } catch (problem) {
      setError(errorMessage(problem,"Systemstatus og logger kunne ikke oppdateres."));
    }
  };

  return <div className="page platform-admin-page">
    <header className="page-header"><div><h1>Plattform</h1><p className="muted">Drift og konfigurasjon av denne installasjonen.</p></div><button className="secondary-button" type="button" onClick={() => void refresh()}>Oppdater status</button></header>
    {error && <p className="status-message error-message">{error}</p>}
    <div className="summary-grid">
      <div className="summary-card"><span>Versjon</span><strong>{operations?.version ?? "Laster …"}</strong></div>
      <div className="summary-card"><span>Miljø</span><strong>{operations?.environment ?? "Laster …"}</strong></div>
      <div className="summary-card"><span>Oppetid</span><strong>{operations ? formatUptime(operations.uptimeSeconds) : "Laster …"}</strong></div>
      <div className="summary-card"><span>API-minne</span><strong>{operations ? `${(operations.processMemoryBytes / 1024 / 1024).toFixed(0)} MB` : "Laster …"}</strong></div>
      <div className="summary-card"><span>Ledig disk</span><strong>{operations?.hostIntegration.disk ? formatBytes(operations.hostIntegration.disk.availableBytes) : "Ikke rapportert"}</strong></div>
      <div className="summary-card"><span>Siste backup</span><strong>{operations?.hostIntegration.backup?.lastCompletedAt ? new Date(operations.hostIntegration.backup.lastCompletedAt).toLocaleString() : "Ikke registrert"}</strong></div>
    </div>
    <section className="panel platform-health">
      <div className="section-heading"><div><h2>Systemstatus</h2><p className="muted">Kontrollert {operations ? new Date(operations.checkedAt).toLocaleString() : "–"}</p></div></div>
      <div className="health-service-list">{operations?.services.map(service => <article className="health-service" key={service.key}><span className={`health-indicator ${service.status}`} aria-hidden="true"/><span><strong>{service.name}</strong><small>{service.detail}{service.restartCount !== null ? ` · ${service.restartCount} omstarter` : ""}</small></span><b>{service.status === "healthy" ? "Klar" : service.status === "degraded" ? "Redusert" : service.status === "unknown" ? "Ukjent" : "Nede"}</b></article>)}</div>
      {operations ? <p className={operations.hostIntegration.available && !operations.hostIntegration.stale ? "muted platform-signal-note" : "status-message warning-message platform-signal-note"}>{hostStatusMessage(operations)}</p> : null}
    </section>
    <section className="panel platform-logs">
      <div className="section-heading"><div><h2>Tekniske logger</h2><p className="muted">Filtrerte advarsler og feil fra gjeldende API-prosess. Faglig innhold og hemmeligheter skal ikke vises her.</p></div></div>
      <form className="log-filter" onSubmit={event => { event.preventDefault(); void loadLogs().catch(() => setError("Loggene kunne ikke filtreres.")); }}>
        <div className="field"><label>Nivå</label><select value={level} onChange={event => setLevel(event.target.value)}><option value="Warning">Advarsler og feil</option><option value="Error">Bare feil</option><option value="Critical">Bare kritiske feil</option></select></div>
        <div className="field"><label>Søk</label><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Kategori eller melding"/></div>
        <button className="secondary-button" type="submit">Filtrer</button>
      </form>
      <div className="technical-log-list">{logs.length === 0 ? <p className="empty-state">Ingen tekniske hendelser samsvarer med filteret.</p> : logs.map(entry => <article className="technical-log-entry" key={entry.sequence}><div><span className={`log-level ${entry.level.toLowerCase()}`}>{entry.level}</span><time>{new Date(entry.occurredAt).toLocaleString()}</time><strong>{entry.category}</strong></div><p>{entry.message}</p>{entry.exceptionType && <small>{entry.exceptionType}</small>}</article>)}</div>
    </section>
  </div>;
}
