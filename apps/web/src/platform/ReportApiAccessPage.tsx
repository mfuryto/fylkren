import { useEffect, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { errorMessage } from "../api/errors";
import { SectionHelp } from "../components/SectionHelp";
import { useTranslation } from "../localization/LocalizationProvider";

type Site = { siteId: string; name: string };
type Client = { id: string; name: string; keyId: string };
type Unit = { id: string; name: string };
type Grant = { id: string; machineIdentityId: string; clientName: string; keyId: string; organizationUnitId: string | null; includeClassified: boolean };

export function ReportApiAccessPage({ embedded = false, canManage = true }: { embedded?: boolean; canManage?: boolean }) {
  const t = useTranslation();
  const [sites, setSites] = useState<Site[]>([]), [siteId, setSiteId] = useState("");
  const [clients, setClients] = useState<Client[]>([]), [units, setUnits] = useState<Unit[]>([]), [grants, setGrants] = useState<Grant[]>([]);
  const [clientId, setClientId] = useState(""), [unitId, setUnitId] = useState(""), [classified, setClassified] = useState(false);
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => { apiGet<Site[]>("/api/report-api/sites", t("sitesLoadFailed")).then(value => { setSites(value); setSiteId(value[0]?.siteId ?? ""); }).catch(error => setMessage(errorMessage(error, t("sitesLoadFailed")))); }, []);
  async function load(id: string) {
    if (!id) return;
    const value = await apiGet<{ clients: Client[]; units: Unit[]; grants: Grant[] }>(`/api/report-api/sites/${id}`, t("reportAccessLoadFailed"));
    setClients(value.clients ?? []); setUnits(value.units ?? []); setGrants(value.grants ?? []);
    setClientId(current => value.clients.some(item => item.id === current) ? current : (value.clients[0]?.id ?? ""));
  }
  useEffect(() => { void load(siteId).catch(error => setMessage(errorMessage(error, t("reportAccessLoadFailed")))); }, [siteId]);
  async function save() {
    setBusy(true); setMessage("");
    try { await apiMutate(`/api/report-api/sites/${siteId}/grants`, "PUT", { machineIdentityId: clientId, organizationUnitId: unitId || null, includeClassified: classified }, t("reportAccessSaveFailed")); await load(siteId); setMessage(t("reportAccessSaved")); }
    catch (error) { setMessage(errorMessage(error, t("reportAccessSaveFailed"))); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setMessage("");
    try { await apiMutate(`/api/report-api/sites/${siteId}/grants/${id}`, "DELETE", undefined, t("reportAccessRemoveFailed")); await load(siteId); setMessage(t("reportAccessRemoved")); }
    catch (error) { setMessage(errorMessage(error, t("reportAccessRemoveFailed"))); } finally { setBusy(false); }
  }
  const levelName = (id: string | null) => id ? units.find(value => value.id === id)?.name ?? t("unavailableWorkLevel") : t("siteTopLevel");
  return <div className={embedded ? "report-api-settings" : "page platform-admin-page"}>
    {embedded ? <div className="section-heading"><div><h2>{t("reportAccessBySite")}</h2><p className="muted">{t("reportAccessBySiteIntro")}</p></div><button className="help-button" type="button" onClick={() => setHelpOpen(true)}><i aria-hidden="true">?</i><span>{t("help")}</span></button></div>
      : <header className="page-header"><div><h1>{t("reportApi")}</h1><p className="muted">{t("reportApiIntro")}</p></div><button className="help-button" type="button" onClick={() => setHelpOpen(true)}><i aria-hidden="true">?</i><span>{t("help")}</span></button></header>}
    {message && <p className="status-message" role="status">{message}</p>}
    <div className="field"><label htmlFor="report-api-site">{t("site")}</label><select id="report-api-site" value={siteId} onChange={event => { setSiteId(event.target.value); setUnitId(""); setMessage(""); }}>{sites.map(site => <option key={site.siteId} value={site.siteId}>{site.name}</option>)}</select></div>
    <section className="panel"><div className="section-heading"><div><h2>{t("newReportAccess")}</h2><p className="muted">{t("reportAccessExactLevel")}</p></div></div>
      {clients.length === 0 ? <p className="empty-state">{t("noReportClients")}</p> : <div className="stacked-form">
        <div className="field"><label htmlFor="report-api-client">{t("apiClient")}</label><select id="report-api-client" disabled={!canManage} value={clientId} onChange={event => setClientId(event.target.value)}>{clients.map(client => <option key={client.id} value={client.id}>{client.name} · {client.keyId}</option>)}</select></div>
        <div className="field"><label htmlFor="report-api-level">{t("workLevel")}</label><select id="report-api-level" disabled={!canManage} value={unitId} onChange={event => setUnitId(event.target.value)}><option value="">{t("siteTopLevel")}</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></div>
        <label className="checkbox-row"><input type="checkbox" disabled={!canManage} checked={classified} onChange={event => setClassified(event.target.checked)} /><span>{t("allowClassifiedReports")}</span></label>
        <div><button className="primary-button" type="button" disabled={busy || !clientId || !siteId || !canManage} onClick={() => void save()}>{t("saveAccess")}</button></div>
      </div>}</section>
    <section className="panel"><div className="section-heading"><div><h2>{t("assignedReportAccess")}</h2><p className="muted">{t("assignedReportAccessIntro")}</p></div></div>
      <div className="admin-list">{grants.length === 0 ? <p className="empty-state">{t("noReportAccess")}</p> : grants.map(grant => <div className="admin-list-row" key={grant.id}><span><strong>{grant.clientName}</strong><small>{t("keyId")}: {grant.keyId} · {levelName(grant.organizationUnitId)} · {grant.includeClassified ? t("includesClassified") : t("unclassifiedOnly")}</small></span><button className="secondary-button danger" type="button" disabled={busy} onClick={() => void remove(grant.id)}>{t("remove")}</button></div>)}</div>
    </section>
    {helpOpen && <SectionHelp title={t("reportApiHelpTitle")} intro={t("reportApiHelpIntro")} steps={[{ title: t("reportApiHelpClientTitle"), text: t("reportApiHelpClientText") }, { title: t("reportApiHelpLevelTitle"), text: t("reportApiHelpLevelText") }, { title: t("reportApiHelpClassifiedTitle"), text: t("reportApiHelpClassifiedText") }, { title: t("reportApiHelpRemoveTitle"), text: t("reportApiHelpRemoveText") }]} note={t("reportApiHelpNote")} onClose={() => setHelpOpen(false)} />}
  </div>;
}
