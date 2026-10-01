import { useEffect, useState } from "react";
import { apiGet } from "../api/client";
import { errorMessage } from "../api/errors";
import { useLanguage, useTranslation } from "../localization/LocalizationProvider";
import type { MessageKey } from "../localization";
import type { MessageVariables } from "../localization";

type Translator = (key: MessageKey, variables?: MessageVariables) => string;

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
    backupWarningHours: number;
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

function formatUptime(seconds: number, t: Translator) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return [days ? `${days} ${t("dayShort")}` : "", hours ? `${hours} ${t("hourShort")}` : "", `${minutes} ${t("minuteShort")}`].filter(Boolean).join(" ");
}

function formatBytes(bytes: number) {
  const gibibytes = bytes / 1024 / 1024 / 1024;
  return `${gibibytes >= 10 ? gibibytes.toFixed(0) : gibibytes.toFixed(1)} GB`;
}

function hostStatusMessage(operations: Operations, t: Translator, language: string) {
  const host = operations.hostIntegration;
  if (!host.configured) return t("hostMonitoringNotConfigured");
  if (host.problem === "stale") return t("hostMeasurementStale");
  if (!host.available) return t("hostMeasurementMissing");
  return t("hostMeasurementFrom", { host: host.hostname ?? t("server"), time: host.collectedAt ? ` · ${new Date(host.collectedAt).toLocaleString(language)}` : "" });
}

export function PlatformPage() {
  const t = useTranslation();
  const language = useLanguage();
  const [operations, setOperations] = useState<Operations | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState("Warning");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const loadStatus = async () => setOperations(await apiGet<Operations>("/api/platform/operations", t("systemStatusLoadFailed")));
  const loadLogs = async () => {
    const query = new URLSearchParams({ level, limit: "100" });
    if (search.trim()) query.set("search", search.trim());
    const data = await apiGet<{ entries: LogEntry[] }>(`/api/platform/operations/logs?${query}`, t("logsLoadFailed"));
    setLogs(data.entries ?? []);
  };

  useEffect(() => {
    Promise.all([loadStatus(), loadLogs()]).catch(problem => setError(errorMessage(problem,t("statusAndLogsLoadFailed"))));
  }, []);

  const refresh = async () => {
    setError("");
    try {
      await Promise.all([loadStatus(), loadLogs()]);
    } catch (problem) {
      setError(errorMessage(problem,t("statusAndLogsRefreshFailed")));
    }
  };

  return <div className="page platform-admin-page">
    <header className="page-header"><div><h1>{t("navPlatform")}</h1><p className="muted">{t("platformIntro")}</p></div><button className="secondary-button" type="button" onClick={() => void refresh()}>{t("refreshStatus")}</button></header>
    {error && <p className="status-message error-message">{error}</p>}
    <div className="summary-grid">
      <div className="summary-card"><span>{t("version")}</span><strong>{operations?.version ?? t("loading")}</strong></div>
      <div className="summary-card"><span>{t("environment")}</span><strong>{operations?.environment ?? t("loading")}</strong></div>
      <div className="summary-card"><span>{t("uptime")}</span><strong>{operations ? formatUptime(operations.uptimeSeconds,t) : t("loading")}</strong></div>
      <div className="summary-card"><span>{t("apiMemory")}</span><strong>{operations ? `${(operations.processMemoryBytes / 1024 / 1024).toFixed(0)} MB` : t("loading")}</strong></div>
      <div className="summary-card"><span>{t("freeDisk")}</span><strong>{operations?.hostIntegration.disk ? formatBytes(operations.hostIntegration.disk.availableBytes) : t("notReported")}</strong></div>
      <div className="summary-card"><span>{t("lastBackup")}</span><strong>{operations?.hostIntegration.backup?.lastCompletedAt ? new Date(operations.hostIntegration.backup.lastCompletedAt).toLocaleString(language) : t("notRegistered")}</strong></div>
    </div>
    <section className="panel platform-health">
      <div className="section-heading"><div><h2>{t("systemStatus")}</h2><p className="muted">{t("checkedAt",{time:operations?new Date(operations.checkedAt).toLocaleString(language):"–"})}</p></div></div>
      <div className="health-service-list">{operations?.services.map(service => <article className="health-service" key={service.key}><span className={`health-indicator ${service.status}`} aria-hidden="true"/><span><strong>{service.name}</strong><small>{service.detail}{service.restartCount !== null ? ` · ${t("restarts",{count:service.restartCount})}` : ""}</small></span><b>{service.status === "healthy" ? t("ready") : service.status === "degraded" ? t("degraded") : service.status === "unknown" ? t("unknown") : t("down")}</b></article>)}</div>
      {operations ? <p className={operations.hostIntegration.available && !operations.hostIntegration.stale ? "muted platform-signal-note" : "status-message warning-message platform-signal-note"}>{hostStatusMessage(operations,t,language)}</p> : null}
      {operations ? <p className="muted platform-signal-note">{t("backupStatusScope",{hours:operations.hostIntegration.backupWarningHours})}</p> : null}
    </section>
    <section className="panel platform-logs">
      <div className="section-heading"><div><h2>{t("technicalLogs")}</h2><p className="muted">{t("technicalLogsIntro")}</p></div></div>
      <form className="log-filter" onSubmit={event => { event.preventDefault(); void loadLogs().catch(() => setError(t("logsFilterFailed"))); }}>
        <div className="field"><label>{t("level")}</label><select value={level} onChange={event => setLevel(event.target.value)}><option value="Warning">{t("warningsAndErrors")}</option><option value="Error">{t("errorsOnly")}</option><option value="Critical">{t("criticalOnly")}</option></select></div>
        <div className="field"><label>{t("search")}</label><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t("categoryOrMessage")}/></div>
        <button className="secondary-button" type="submit">{t("filter")}</button>
      </form>
      <div className="technical-log-list">{logs.length === 0 ? <p className="empty-state">{t("noTechnicalEvents")}</p> : logs.map(entry => <article className="technical-log-entry" key={entry.sequence}><div><span className={`log-level ${entry.level.toLowerCase()}`}>{entry.level}</span><time>{new Date(entry.occurredAt).toLocaleString(language)}</time><strong>{entry.category}</strong></div><p>{entry.message}</p>{entry.exceptionType && <small>{entry.exceptionType}</small>}</article>)}</div>
    </section>
  </div>;
}
