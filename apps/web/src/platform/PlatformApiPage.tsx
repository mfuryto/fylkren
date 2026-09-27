import { useEffect, useState } from "react";
import type React from "react";
import { apiGet, apiMutate } from "../api/client";
import { errorMessage } from "../api/errors";
import { Modal } from "../components/Modal";
import { EnterpriseRequiredNotice } from "../components/EnterpriseRequiredNotice";
import { SectionHelp } from "../components/SectionHelp";
import {
  apiClientScopes,
  apiClientExpiryDate,
  filterApiClients,
  formatPlatformDateTime,
  type ApiClient,
  type ApiClientStatusFilter,
} from "./platformModels";
import { createApiClient, deactivateApiClient, loadApiClients } from "./platformApi";
import { ReportApiAccessPage } from "./ReportApiAccessPage";
import { WebhookSettings } from "./WebhookSettings";

export function PlatformApiPage({ language: displayLanguage, timeZone: displayTimeZone, entitlements }: { language: string; timeZone: string; entitlements: string[] }) {
  const machineApiEnabled = entitlements.includes("machine-api");
  const webhooksEnabled = entitlements.includes("webhooks");
  const [clients,setClients]=useState<ApiClient[]>([]);
  const [creatorOpen,setCreatorOpen]=useState(false);
  const [helpOpen,setHelpOpen]=useState(false);
  const [name,setName]=useState("");
  const [expiresOn,setExpiresOn]=useState(()=>apiClientExpiryDate());
  const [scopes,setScopes]=useState(["sites:read"]);
  const [issuedToken,setIssuedToken]=useState<{name:string;token:string}|null>(null);
  const [deactivating,setDeactivating]=useState<ApiClient|null>(null);
  const [statusFilter,setStatusFilter]=useState<ApiClientStatusFilter>("active");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const load=async()=>setClients(await loadApiClients());
  useEffect(()=>{load().catch(problem=>setMessage(errorMessage(problem,"API-klientene kunne ikke lastes.")));},[]);
  const createClient=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setMessage("");try{const created=await createApiClient({name,scopes,expiresAt:`${expiresOn}T23:59:59Z`});setCreatorOpen(false);setName("");setExpiresOn(apiClientExpiryDate());setScopes(["sites:read"]);setIssuedToken({name:created.name,token:created.token});await load();}catch(problem){setMessage(errorMessage(problem,"API-klienten kunne ikke opprettes."));}finally{setBusy(false);}};
  const deactivate=async()=>{if(!deactivating)return;setBusy(true);setMessage("");try{await deactivateApiClient(deactivating.id);setDeactivating(null);await load();setMessage("API-klienten er deaktivert.");}catch(problem){setMessage(errorMessage(problem,"API-klienten kunne ikke deaktiveres."));}finally{setBusy(false);}};
  const dateTime=(value:string|null)=>formatPlatformDateTime(value,displayLanguage,displayTimeZone);
  const visibleClients=filterApiClients(clients,statusFilter);
  return <div className="page platform-admin-page">
    <header className="page-header"><div><h1>API</h1><p className="muted">Forvalt maskinidentiteter for eksterne administrasjonssystemer.</p></div><div className="inline-actions"><button className="help-button" type="button" onClick={()=>setHelpOpen(true)}><i aria-hidden="true">?</i><span>Hjelp</span></button><button className="primary-button" type="button" disabled={!machineApiEnabled} onClick={()=>setCreatorOpen(true)}>Ny API-klient</button></div></header>
    {!machineApiEnabled&&<EnterpriseRequiredNotice>Enterprise kreves for å opprette API-klienter og tildele rapporttilgang. Eksisterende klienter og tildelinger er fortsatt synlige.</EnterpriseRequiredNotice>}
    {message&&<p className="status-message">{message}</p>}
    <section className="panel"><div className="section-heading api-client-heading"><div><h2>API-klienter</h2><p className="muted">Nøkler kan ikke leses tilbake. Deaktiver en klient straks nøkkelen ikke lenger skal brukes.</p></div><div className="field api-client-filter"><label htmlFor="api-client-status">Vis</label><select id="api-client-status" value={statusFilter} onChange={event=>setStatusFilter(event.target.value as "active"|"inactive"|"all")}><option value="active">Aktive</option><option value="inactive">Deaktiverte</option><option value="all">Alle</option></select></div></div>
      <div className="admin-list">{clients.length===0?<p className="empty-state">Ingen API-klienter er opprettet.</p>:visibleClients.length===0?<p className="empty-state">Ingen API-klienter samsvarer med filteret.</p>:visibleClients.map(client=><div className="admin-list-row api-client-row" key={client.id}><span><strong>{client.name}</strong><small>Nøkkel-ID: {client.keyId} · Scopes: {client.scopes.join(", ")}</small><small>Opprettet {dateTime(client.createdAt)} · Sist brukt {dateTime(client.lastUsedAt)}{client.expiresAt?` · Utløper ${dateTime(client.expiresAt)}`:" · Mangler utløp – erstatt klienten"}</small></span><div className="inline-actions"><span className={client.isActive?"status-active":"muted"}>{client.isActive?"Aktiv":"Deaktivert"}</span>{client.isActive&&<button className="secondary-button danger" type="button" onClick={()=>setDeactivating(client)}>Deaktiver</button>}</div></div>)}</div>
    </section>
    {creatorOpen&&<Modal title="Opprett API-klient" onClose={()=>setCreatorOpen(false)}><form className="stacked-form" onSubmit={createClient}><div className="field"><label htmlFor="api-client-name">Navn</label><input id="api-client-name" required minLength={2} maxLength={120} autoComplete="off" value={name} onChange={event=>setName(event.target.value)} placeholder="Eksternt administrasjonssystem"/></div><div className="field"><label htmlFor="api-client-expiry">Utløpsdato</label><input id="api-client-expiry" required type="date" min={apiClientExpiryDate(1)} max={apiClientExpiryDate(365)} value={expiresOn} onChange={event=>setExpiresOn(event.target.value)}/><small>Maksimalt ett år. Standard er 90 dager.</small></div><div className="site-detail-block"><strong>Tilganger</strong><div className="api-scope-list">{apiClientScopes.map(scope=><label className="checkbox-row" key={scope.key}><input type="checkbox" checked={scopes.includes(scope.key)} onChange={event=>setScopes(current=>event.target.checked?[...current,scope.key]:current.filter(value=>value!==scope.key))}/><span>{scope.label} (<code>{scope.key}</code>)</span></label>)}</div></div><p className="muted modal-note">Gi bare integrasjonen tilgangene den faktisk trenger. Klienthemmeligheten vises bare én gang.</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={()=>setCreatorOpen(false)}>Avbryt</button><button className="primary-button" disabled={busy||name.trim().length<2||scopes.length===0||!expiresOn}>Opprett klient</button></div></form></Modal>}
    {issuedToken&&<Modal title="Lagre klientnøkkelen nå" dismissible={false} onClose={()=>setIssuedToken(null)}><p>Nøkkelen for <strong>{issuedToken.name}</strong> kan ikke hentes frem igjen.</p><div className="field"><label htmlFor="issued-api-token">Klientnøkkel</label><textarea id="issued-api-token" className="api-secret" readOnly rows={4} value={issuedToken.token} onFocus={event=>event.currentTarget.select()}/></div><div className="modal-actions"><button className="secondary-button" type="button" onClick={()=>void navigator.clipboard.writeText(issuedToken.token).then(()=>setMessage("Klientnøkkelen er kopiert.")).catch(()=>setMessage("Kopiering ble blokkert. Marker og kopier nøkkelen manuelt."))}>Kopier nøkkel</button><button className="primary-button" type="button" onClick={()=>setIssuedToken(null)}>Jeg har lagret nøkkelen</button></div></Modal>}
    {deactivating&&<Modal title="Deaktiver API-klient" onClose={()=>setDeactivating(null)}><p><strong>{deactivating.name}</strong> mister tilgangen umiddelbart. Integrasjonen må få en ny klientnøkkel for å koble til igjen.</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={()=>setDeactivating(null)}>Avbryt</button><button className="primary-button danger" type="button" disabled={busy} onClick={()=>void deactivate()}>Deaktiver klient</button></div></Modal>}
    {helpOpen && <SectionHelp
      title="Slik bruker du administrasjons-API-et"
      intro="API-klienter er egne identiteter for eksterne systemer og skal ikke knyttes til en personlig brukerkonto."
      steps={[
        {title:"Opprett én klient per integrasjon.",text:"Gi klienten et gjenkjennelig navn, en utløpsdato og bare nødvendige scopes."},
        {title:"Lagre nøkkelen sikkert.",text:"Hele nøkkelen vises bare én gang. Legg den i integrasjonens hemmelighetslager, ikke i kildekode eller dokumentasjon."},
        {title:"Bruk den versjonerte kontrakten.",text:"Site-grensesnittet ligger under /api/v1/administration/sites. Endringer krever siste ETag i If-Match, og opprettelse krever Idempotency-Key."},
        {title:"Tildel rapporttilgang separat.",text:"En klient med reports:read må i tillegg knyttes til bestemte sites og arbeidsnivåer på siden Rapport-API."},
        {title:"Deaktiver ved mistanke eller avslutning.",text:"Deaktivering stopper nye API-kall umiddelbart og bevarer revisjonsspor."}
      ]}
      note="Site-API-et gir ikke tilgang til oppgaver, planer, utførelse, rapporter eller personell."
      onClose={()=>setHelpOpen(false)}
    />}
    <ReportApiAccessPage embedded canManage={machineApiEnabled} />
    <WebhookSettings canManage={webhooksEnabled} />
  </div>;
}
