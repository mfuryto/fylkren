import { useEffect, useState } from "react";
import { loadBrowserSessions, revokeAllBrowserSessions, revokeBrowserSession, type BrowserSession } from "./profileApi";
import { useTranslation } from "../localization/LocalizationProvider";

export function BrowserSessionsPanel({ disabled, onCurrentSessionRevoked }: { disabled: boolean; onCurrentSessionRevoked: () => void }) {
  const t = useTranslation();
  const [sessions, setSessions] = useState<BrowserSession[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try { setSessions(await loadBrowserSessions()); }
    catch (problem) { setError(problem instanceof Error ? problem.message : t("sessionLoadFailed")); }
  }

  useEffect(() => { void refresh(); }, []);

  async function revoke(session: BrowserSession) {
    setBusy(true); setError("");
    try {
      await revokeBrowserSession(session.id, currentPassword);
      setCurrentPassword("");
      if (session.current) onCurrentSessionRevoked(); else await refresh();
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("terminateSessionsFailed")); }
    setBusy(false);
  }

  async function revokeAll() {
    setBusy(true); setError("");
    try { await revokeAllBrowserSessions(currentPassword); onCurrentSessionRevoked(); }
    catch (problem) { setError(problem instanceof Error ? problem.message : t("terminateSessionsFailed")); setBusy(false); }
  }

  return <section className="panel stacked-form browser-sessions-panel">
    <h2>{t("browserSessions")}</h2>
    <p className="muted modal-note">{t("browserSessionsIntro")}</p>
    {error && <p className="status-message error-message" role="alert">{error}</p>}
    <div className="compact-list">
      {sessions.map((session) => <div className="compact-list-row" key={session.id}>
        <div>
          <strong>{session.current ? t("currentBrowserSession") : t("browserSession")}</strong>
          <span className="muted">{new Date(session.lastSeenAt).toLocaleString()}</span>
          <span className="muted">{session.userAgent || t("unknownBrowser")}</span>
        </div>
        <button className="link-button danger" type="button" disabled={disabled || busy} onClick={() => void revoke(session)}>
          {t("terminateSessions")}
        </button>
      </div>)}
    </div>
    <div className="field">
      <label htmlFor="session-current-password">{t("currentPassword")}</label>
      <input id="session-current-password" type="password" autoComplete="current-password" maxLength={128}
        value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
      <span className="muted modal-note">{t("sessionReauthenticationHelp")}</span>
    </div>
    <button className="danger-button" type="button" disabled={disabled || busy || sessions.length === 0} onClick={() => void revokeAll()}>
      {t("terminateAllSessions")}
    </button>
  </section>;
}
