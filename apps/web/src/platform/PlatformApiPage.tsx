import { useEffect, useState } from "react";
import type React from "react";
import { errorMessage } from "../api/errors";
import { EnterpriseRequiredNotice } from "../components/EnterpriseRequiredNotice";
import { Modal } from "../components/Modal";
import { SectionHelp } from "../components/SectionHelp";
import { useTranslation } from "../localization/LocalizationProvider";
import { createApiClient, deactivateApiClient, loadApiClients } from "./platformApi";
import { apiClientExpiryDate, apiClientScopes, filterApiClients, formatPlatformDateTime, type ApiClient, type ApiClientStatusFilter } from "./platformModels";
import { ReportApiAccessPage } from "./ReportApiAccessPage";
import { WorkApiAccessPage } from "./WorkApiAccessPage";
import { WebhookSettings } from "./WebhookSettings";
import { ListSortControl, sortList, type ListSort } from "../components/ListSortControl";

export function PlatformApiPage({ language: displayLanguage, timeZone: displayTimeZone, entitlements }: { language: string; timeZone: string; entitlements: string[] }) {
  const t = useTranslation();
  const machineApiEnabled = entitlements.includes("machine-api"), webhooksEnabled = entitlements.includes("webhooks");
  const [clients, setClients] = useState<ApiClient[]>([]), [creatorOpen, setCreatorOpen] = useState(false), [helpOpen, setHelpOpen] = useState(false);
  const [name, setName] = useState(""), [expiresOn, setExpiresOn] = useState(() => apiClientExpiryDate()), [scopes, setScopes] = useState(["sites:read"]);
  const [issuedToken, setIssuedToken] = useState<{ name: string; token: string } | null>(null), [deactivating, setDeactivating] = useState<ApiClient | null>(null);
  const [statusFilter, setStatusFilter] = useState<ApiClientStatusFilter>("active"), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [sort, setSort] = useState<ListSort>("newest");
  const load = async () => setClients(await loadApiClients());
  useEffect(() => { load().catch(problem => setMessage(errorMessage(problem, t("apiClientsLoadFailed")))); }, []);
  const createClient = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try { const created = await createApiClient({ name, scopes, expiresAt: `${expiresOn}T23:59:59Z` }); setCreatorOpen(false); setName(""); setExpiresOn(apiClientExpiryDate()); setScopes(["sites:read"]); setIssuedToken({ name: created.name, token: created.privateKey }); await load(); }
    catch (problem) { setMessage(errorMessage(problem, t("apiClientCreateFailed"))); } finally { setBusy(false); }
  };
  const deactivate = async () => {
    if (!deactivating) return; setBusy(true); setMessage("");
    try { await deactivateApiClient(deactivating.id); setDeactivating(null); await load(); setMessage(t("apiClientDeactivated")); }
    catch (problem) { setMessage(errorMessage(problem, t("apiClientDeactivateFailed"))); } finally { setBusy(false); }
  };
  const dateTime = (value: string | null) => formatPlatformDateTime(value, displayLanguage, displayTimeZone, t("never"));
  const visibleClients = sortList(filterApiClients(clients, statusFilter), sort, { name: client => client.name, createdAt: client => client.createdAt });
  return <div className="page platform-admin-page">
    <header className="page-header"><div><h1>API</h1><p className="muted">{t("apiIntro")}</p></div><div className="inline-actions"><button className="help-button" type="button" onClick={() => setHelpOpen(true)}><i aria-hidden="true">?</i><span>{t("help")}</span></button><button className="primary-button" type="button" disabled={!machineApiEnabled} onClick={() => setCreatorOpen(true)}>{t("newApiClient")}</button></div></header>
    {!machineApiEnabled && <EnterpriseRequiredNotice>{t("machineApiEnterpriseNotice")}</EnterpriseRequiredNotice>}
    {message && <p className="status-message">{message}</p>}
    <section className="panel"><div className="section-heading api-client-heading"><div><h2>{t("apiClients")}</h2><p className="muted">{t("apiSecretsHelp")}</p></div><div className="inline-actions"><div className="field api-client-filter"><label htmlFor="api-client-status">{t("show")}</label><select id="api-client-status" value={statusFilter} onChange={event => setStatusFilter(event.target.value as ApiClientStatusFilter)}><option value="active">{t("activePlural")}</option><option value="inactive">{t("inactivePlural")}</option><option value="all">{t("all")}</option></select></div><ListSortControl id="api-client-sort" value={sort} onChange={setSort}/></div></div>
      <div className="admin-list">{clients.length === 0 ? <p className="empty-state">{t("noApiClients")}</p> : visibleClients.length === 0 ? <p className="empty-state">{t("noApiClientMatches")}</p> : visibleClients.map(client => <div className="admin-list-row api-client-row" key={client.id}><span><strong>{client.name}</strong><small>{t("keyId")}: {client.keyId} · {client.authenticationMode}{client.legacyBearerAcceptedUntil ? ` (${t("expiresDate", { date: dateTime(client.legacyBearerAcceptedUntil) })})` : ""} · {t("scopes")}: {client.scopes.join(", ")}</small><small>{t("createdDate", { date: dateTime(client.createdAt) })} · {t("lastUsedDate", { date: dateTime(client.lastUsedAt) })} · {client.expiresAt ? t("expiresDate", { date: dateTime(client.expiresAt) }) : t("missingExpiry")}</small></span><div className="inline-actions"><span className={client.isActive ? "status-active" : "muted"}>{client.isActive ? t("active") : t("inactive")}</span>{client.isActive && <button className="secondary-button danger" type="button" onClick={() => setDeactivating(client)}>{t("deactivate")}</button>}</div></div>)}</div>
    </section>
    {creatorOpen && <Modal title={t("createApiClient")} onClose={() => setCreatorOpen(false)}><form className="stacked-form" onSubmit={createClient}><div className="field"><label htmlFor="api-client-name">{t("name")}</label><input id="api-client-name" required minLength={2} maxLength={120} autoComplete="off" value={name} onChange={event => setName(event.target.value)} placeholder={t("externalAdministrationSystem")} /></div><div className="field"><label htmlFor="api-client-expiry">{t("expiryDate")}</label><input id="api-client-expiry" required type="date" min={apiClientExpiryDate(1)} max={apiClientExpiryDate(365)} value={expiresOn} onChange={event => setExpiresOn(event.target.value)} /><small>{t("expiryHelp")}</small></div><div className="site-detail-block"><strong>{t("permissions")}</strong><div className="api-scope-list">{apiClientScopes.map(scope => <label className="checkbox-row" key={scope.key}><input type="checkbox" checked={scopes.includes(scope.key)} onChange={event => setScopes(current => event.target.checked ? [...current, scope.key] : current.filter(value => value !== scope.key))} /><span>{t(scope.labelKey)} (<code>{scope.key}</code>)</span></label>)}</div></div><p className="muted modal-note">{t("leastPrivilegeHelp")}</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setCreatorOpen(false)}>{t("cancel")}</button><button className="primary-button" disabled={busy || name.trim().length < 2 || scopes.length === 0 || !expiresOn}>{t("createClient")}</button></div></form></Modal>}
    {issuedToken && <Modal title={t("saveClientKeyNow")} dismissible={false} onClose={() => setIssuedToken(null)}><p>{t("clientKeyOneTime", { name: issuedToken.name })}</p><div className="field"><label htmlFor="issued-api-token">{t("clientKey")}</label><textarea id="issued-api-token" className="api-secret" readOnly rows={4} value={issuedToken.token} onFocus={event => event.currentTarget.select()} /></div><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => void navigator.clipboard.writeText(issuedToken.token).then(() => setMessage(t("clientKeyCopied"))).catch(() => setMessage(t("copyBlockedManual")))}>{t("copyKey")}</button><button className="primary-button" type="button" onClick={() => setIssuedToken(null)}>{t("keyStored")}</button></div></Modal>}
    {deactivating && <Modal title={t("deactivateApiClient")} onClose={() => setDeactivating(null)}><p>{t("deactivateClientWarning", { name: deactivating.name })}</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setDeactivating(null)}>{t("cancel")}</button><button className="primary-button danger" type="button" disabled={busy} onClick={() => void deactivate()}>{t("deactivateClient")}</button></div></Modal>}
    {helpOpen && <SectionHelp title={t("apiHelpTitle")} intro={t("apiHelpIntro")} steps={[
      { title: t("apiHelpCreateTitle"), text: t("apiHelpCreateText") }, { title: t("apiHelpStoreTitle"), text: t("apiHelpStoreText") },
      { title: t("apiHelpContractTitle"), text: t("apiHelpContractText") }, { title: t("apiHelpReportTitle"), text: t("apiHelpReportText") },
      { title: t("apiHelpDeactivateTitle"), text: t("apiHelpDeactivateText") },
    ]} note={t("apiHelpNote")} onClose={() => setHelpOpen(false)} />}
    <ReportApiAccessPage embedded canManage={machineApiEnabled} />
    <WorkApiAccessPage canManage={machineApiEnabled} />
    <WebhookSettings canManage={webhooksEnabled} />
  </div>;
}
