import { useEffect, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { errorMessage } from "../api/errors";
import { useTranslation } from "../localization/LocalizationProvider";
import { ListSortControl, sortList, type ListSort } from "../components/ListSortControl";

type Site = { siteId: string; name: string };
type Client = { id: string; name: string; keyId: string };
type Unit = { id: string; name: string };
type Grant = { id: string; machineIdentityId: string; clientName: string; keyId: string; organizationUnitId: string | null };

export function WorkApiAccessPage({ canManage = true }: { canManage?: boolean }) {
  const t = useTranslation();
  const [sites, setSites] = useState<Site[]>([]), [siteId, setSiteId] = useState("");
  const [clients, setClients] = useState<Client[]>([]), [units, setUnits] = useState<Unit[]>([]), [grants, setGrants] = useState<Grant[]>([]);
  const [clientId, setClientId] = useState(""), [unitId, setUnitId] = useState("");
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [sort, setSort] = useState<ListSort>("name-asc");
  useEffect(() => { apiGet<Site[]>("/api/work-api/sites", t("sitesLoadFailed")).then(value => { setSites(value); setSiteId(value[0]?.siteId ?? ""); }).catch(error => setMessage(errorMessage(error, t("sitesLoadFailed")))); }, []);
  async function load(id: string) {
    if (!id) return;
    const value = await apiGet<{ clients: Client[]; units: Unit[]; grants: Grant[] }>(`/api/work-api/sites/${id}`, t("workApiAccessLoadFailed"));
    setClients(value.clients ?? []); setUnits(value.units ?? []); setGrants(value.grants ?? []);
    setClientId(current => value.clients.some(item => item.id === current) ? current : (value.clients[0]?.id ?? ""));
  }
  useEffect(() => { void load(siteId).catch(error => setMessage(errorMessage(error, t("workApiAccessLoadFailed")))); }, [siteId]);
  async function save() {
    setBusy(true); setMessage("");
    try { await apiMutate(`/api/work-api/sites/${siteId}/grants`, "PUT", { machineIdentityId: clientId, organizationUnitId: unitId || null }, t("workApiAccessSaveFailed")); await load(siteId); setMessage(t("workApiAccessSaved")); }
    catch (error) { setMessage(errorMessage(error, t("workApiAccessSaveFailed"))); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setMessage("");
    try { await apiMutate(`/api/work-api/sites/${siteId}/grants/${id}`, "DELETE", undefined, t("workApiAccessRemoveFailed")); await load(siteId); setMessage(t("workApiAccessRemoved")); }
    catch (error) { setMessage(errorMessage(error, t("workApiAccessRemoveFailed"))); } finally { setBusy(false); }
  }
  const levelName = (id: string | null) => id ? units.find(value => value.id === id)?.name ?? t("unavailableWorkLevel") : t("siteTopLevel");
  return <div className="report-api-settings">
    <div className="section-heading"><div><h2>{t("workApiAccessBySite")}</h2><p className="muted">{t("workApiAccessIntro")}</p></div></div>
    {message && <p className="status-message" role="status">{message}</p>}
    <div className="field"><label htmlFor="work-api-site">{t("site")}</label><select id="work-api-site" value={siteId} onChange={event => { setSiteId(event.target.value); setUnitId(""); setMessage(""); }}>{sites.map(site => <option key={site.siteId} value={site.siteId}>{site.name}</option>)}</select></div>
    <section className="panel"><div className="section-heading"><div><h2>{t("newWorkApiAccess")}</h2><p className="muted">{t("workApiAccessExactLevel")}</p></div></div>
      {clients.length === 0 ? <p className="empty-state">{t("noWorkApiClients")}</p> : <div className="stacked-form">
        <div className="field"><label htmlFor="work-api-client">{t("apiClient")}</label><select id="work-api-client" disabled={!canManage} value={clientId} onChange={event => setClientId(event.target.value)}>{clients.map(client => <option key={client.id} value={client.id}>{client.name} · {client.keyId}</option>)}</select></div>
        <div className="field"><label htmlFor="work-api-level">{t("workLevel")}</label><select id="work-api-level" disabled={!canManage} value={unitId} onChange={event => setUnitId(event.target.value)}><option value="">{t("siteTopLevel")}</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></div>
        <div><button className="primary-button" type="button" disabled={busy || !clientId || !siteId || !canManage} onClick={() => void save()}>{t("saveAccess")}</button></div>
      </div>}</section>
    <section className="panel"><div className="section-heading"><div><h2>{t("assignedWorkApiAccess")}</h2><p className="muted">{t("assignedWorkApiAccessIntro")}</p></div><ListSortControl id="work-access-sort" value={sort} onChange={setSort} options={["name-asc", "name-desc"]}/></div>
      <div className="admin-list">{grants.length === 0 ? <p className="empty-state">{t("noWorkApiAccess")}</p> : sortList(grants, sort, { name: grant => grant.clientName }).map(grant => <div className="admin-list-row" key={grant.id}><span><strong>{grant.clientName}</strong><small>{t("keyId")}: {grant.keyId} · {levelName(grant.organizationUnitId)}</small></span><button className="secondary-button danger" type="button" disabled={busy} onClick={() => void remove(grant.id)}>{t("remove")}</button></div>)}</div>
    </section>
  </div>;
}
