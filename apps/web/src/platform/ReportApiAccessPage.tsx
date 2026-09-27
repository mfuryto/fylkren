import { useEffect, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { errorMessage } from "../api/errors";
import { SectionHelp } from "../components/SectionHelp";

type Site = { siteId: string; name: string };
type Client = { id: string; name: string; keyId: string };
type Unit = { id: string; name: string };
type Grant = { id: string; machineIdentityId: string; clientName: string; keyId: string; organizationUnitId: string | null; includeClassified: boolean };

export function ReportApiAccessPage({ embedded = false, canManage = true }: { embedded?: boolean; canManage?: boolean }) {
  const [sites, setSites] = useState<Site[]>([]), [siteId, setSiteId] = useState("");
  const [clients, setClients] = useState<Client[]>([]), [units, setUnits] = useState<Unit[]>([]), [grants, setGrants] = useState<Grant[]>([]);
  const [clientId, setClientId] = useState(""), [unitId, setUnitId] = useState(""), [classified, setClassified] = useState(false);
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => { apiGet<Site[]>("/api/report-api/sites", "Sites kunne ikke lastes.").then(value => { setSites(value); setSiteId(value[0]?.siteId ?? ""); }).catch(error => setMessage(errorMessage(error, "Sites kunne ikke lastes."))); }, []);
  async function load(id: string) {
    if (!id) return;
    const value = await apiGet<{ clients: Client[]; units: Unit[]; grants: Grant[] }>(`/api/report-api/sites/${id}`, "Rapporttilgangene kunne ikke lastes.");
    setClients(value.clients ?? []); setUnits(value.units ?? []); setGrants(value.grants ?? []);
    setClientId(current => value.clients.some(item => item.id === current) ? current : (value.clients[0]?.id ?? ""));
  }
  useEffect(() => { void load(siteId).catch(error => setMessage(errorMessage(error, "Rapporttilgangene kunne ikke lastes."))); }, [siteId]);
  async function save() {
    setBusy(true); setMessage("");
    try { await apiMutate(`/api/report-api/sites/${siteId}/grants`, "PUT", { machineIdentityId: clientId, organizationUnitId: unitId || null, includeClassified: classified }, "Rapporttilgangen kunne ikke lagres."); await load(siteId); setMessage("Rapporttilgangen er lagret."); }
    catch (error) { setMessage(errorMessage(error, "Rapporttilgangen kunne ikke lagres.")); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setMessage("");
    try { await apiMutate(`/api/report-api/sites/${siteId}/grants/${id}`, "DELETE", undefined, "Rapporttilgangen kunne ikke fjernes."); await load(siteId); setMessage("Rapporttilgangen er fjernet."); }
    catch (error) { setMessage(errorMessage(error, "Rapporttilgangen kunne ikke fjernes.")); }
    finally { setBusy(false); }
  }
  const levelName = (id: string | null) => id ? units.find(value => value.id === id)?.name ?? "Deaktivert eller slettet nivå" : "Sitens toppnivå";
  return <div className={embedded ? "report-api-settings" : "page platform-admin-page"}>
    {embedded ? <div className="section-heading"><div><h2>Rapporttilgang per site</h2><p className="muted">Knytt klienter med <code>reports:read</code> til bestemte sites og arbeidsnivåer.</p></div><button className="help-button" type="button" onClick={() => setHelpOpen(true)}><i aria-hidden="true">?</i><span>Hjelp</span></button></div>
      : <header className="page-header"><div><h1>Rapport-API</h1><p className="muted">Gi API-klienter lesetilgang til godkjente sluttrapporter per site og arbeidsnivå.</p></div><button className="help-button" type="button" onClick={() => setHelpOpen(true)}><i aria-hidden="true">?</i><span>Hjelp</span></button></header>}
    {message && <p className="status-message" role="status">{message}</p>}
    <div className="field"><label htmlFor="report-api-site">Site</label><select id="report-api-site" value={siteId} onChange={event => { setSiteId(event.target.value); setUnitId(""); setMessage(""); }}>{sites.map(site => <option key={site.siteId} value={site.siteId}>{site.name}</option>)}</select></div>
    <section className="panel"><div className="section-heading"><div><h2>Ny rapporttilgang</h2><p className="muted">Tilgangen gjelder bare valgt site og nøyaktig valgt arbeidsnivå.</p></div></div>
      {clients.length === 0 ? <p className="empty-state">Ingen aktive API-klienter har tilgangen <code>reports:read</code>. Opprett en klient med denne tilgangen først.</p> : <div className="stacked-form">
        <div className="field"><label htmlFor="report-api-client">API-klient</label><select id="report-api-client" disabled={!canManage} value={clientId} onChange={event => setClientId(event.target.value)}>{clients.map(client => <option key={client.id} value={client.id}>{client.name} · {client.keyId}</option>)}</select></div>
        <div className="field"><label htmlFor="report-api-level">Arbeidsnivå</label><select id="report-api-level" disabled={!canManage} value={unitId} onChange={event => setUnitId(event.target.value)}><option value="">Sitens toppnivå</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></div>
        <label className="checkbox-row"><input type="checkbox" disabled={!canManage} checked={classified} onChange={event => setClassified(event.target.checked)} /><span>Tillat klassifiserte sluttrapporter</span></label>
        <div><button className="primary-button" type="button" disabled={busy || !clientId || !siteId || !canManage} onClick={() => void save()}>Lagre tilgang</button></div>
      </div>}</section>
    <section className="panel"><div className="section-heading"><div><h2>Tildelte rapporttilganger</h2><p className="muted">Eksisterende tildelinger kan leses og fjernes her.</p></div></div>
      <div className="admin-list">{grants.length === 0 ? <p className="empty-state">Ingen rapporttilganger er tildelt for denne siten.</p> : grants.map(grant => <div className="admin-list-row" key={grant.id}><span><strong>{grant.clientName}</strong><small>Nøkkel-ID: {grant.keyId} · {levelName(grant.organizationUnitId)} · {grant.includeClassified ? "Inkluderer klassifiserte" : "Bare ugraderte"}</small></span><button className="secondary-button danger" type="button" disabled={busy} onClick={() => void remove(grant.id)}>Fjern</button></div>)}</div>
    </section>
    {helpOpen && <SectionHelp title="Slik forvalter du rapport-API-et" intro="Platform Manager forvalter maskinklienter og deres avgrensede rapporttilgang." steps={[{ title: "Opprett API-klienten.", text: "Gi klienten reports:read på siden API." }, { title: "Velg site og arbeidsnivå.", text: "Hver tildeling gjelder bare det nøyaktige nivået." }, { title: "Vurder klassifisert innhold.", text: "Dette krever en uttrykkelig tildeling." }, { title: "Fjern når behovet opphører.", text: "Fjerning påvirker ikke rapportene." }]} note="API-et eksponerer bare godkjente sluttrapporter og nødvendig metadata." onClose={() => setHelpOpen(false)} />}
  </div>;
}
