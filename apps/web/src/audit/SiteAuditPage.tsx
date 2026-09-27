import { useEffect, useState } from "react";
import { SectionHelp } from "../components/SectionHelp";
import { errorMessage } from "../api/errors";
import { loadAuditSites, loadSiteAudit, type AuditSite, type SiteAuditRow } from "./siteAuditApi";

export function SiteAuditPage({ language: displayLanguage, timeZone: displayTimeZone }: { language: string; timeZone: string }) {
  const [sites,setSites]=useState<AuditSite[]>([]);
  const [siteId,setSiteId]=useState("");
  const [rows,setRows]=useState<SiteAuditRow[]>([]);
  const [eventTypes,setEventTypes]=useState<string[]>([]);
  const [area,setArea]=useState("");
  const [eventType,setEventType]=useState("");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(1);
  const [totalPages,setTotalPages]=useState(1);
  const [total,setTotal]=useState(0);
  const [error,setError]=useState("");
  const [helpOpen,setHelpOpen]=useState(false);
  useEffect(()=>{loadAuditSites().then(values=>{setSites(values);setSiteId(values[0]?.id??"");}).catch(problem=>setError(errorMessage(problem,"Tilgjengelige sites kunne ikke lastes.")));},[]);
  async function load(nextPage=page,reset=false){if(!siteId)return;const data=await loadSiteAudit(siteId,nextPage,reset?{area:"",eventType:"",from:"",to:"",search:""}:{area,eventType,from,to,search});setRows(data.events??[]);setEventTypes(data.eventTypes??[]);setPage(data.page??1);setTotalPages(data.totalPages??1);setTotal(data.total??0);setError("");}
  useEffect(()=>{if(siteId)void load(1).catch(problem=>setError(errorMessage(problem,"Audit-loggen kunne ikke lastes.")));},[siteId]);
  const eventLabels:Record<string,string>={
    "local-user.created":"Lokal bruker opprettet","local-user.updated":"Bruker oppdatert","local-user.password-reset-initiated":"Engangskode for passordbytte opprettet","site-member.deactivated":"Bruker fjernet fra siten",
    "identity.ad.person-added":"AD-bruker lagt til i siten","identity.ldap.person-added":"LDAP-bruker lagt til i siten",
    "organization-role.created":"Arbeidsrolle opprettet","organization-role.updated":"Arbeidsrolle endret","organization-role.deactivated":"Arbeidsrolle deaktivert","role-assignment.created":"Rolle tildelt","role-assignment.deactivated":"Rolletildeling fjernet","role-assignment.parent-leadership-updated":"Lederfullmakt endret",
    "site.created":"Site opprettet","site.updated":"Site oppdatert","site.deactivated":"Site deaktivert","site-manager.assigned":"Site Manager tildelt","site-manager.deactivated":"Site Manager fjernet","organization-unit.created":"Intern enhet opprettet","organization-unit.updated":"Intern enhet oppdatert","organization-unit.reordered":"Rekkefølge på interne enheter endret",
    "planning-workflow.configured":"Planleggingsflyt konfigurert","execution-workflow.created":"Utførelsesflyt opprettet","workflow.revised":"Arbeidsflyt revidert","workflow.deactivated":"Arbeidsflyt deaktivert","workflow.claimed":"Planlegging tatt til behandling","workflow.reassigned":"Planlegging omfordelt","workflow.released":"Planlegging frigitt","workflow.released-on-member-removal":"Planlegging frigitt etter brukerfjerning","workflow.step-documented":"Planleggingssteg dokumentert","workflow.approved":"Plan godkjent","workflow.replanning-requested":"Plan sendt tilbake til korrigering","workflow.put-on-hold":"Planlegging satt på vent","workflow.rejected":"Plan avvist",
    "execution.claimed":"Utførelse tatt til behandling","execution.workflow-started":"Utførelsesflyt startet","execution.reassigned":"Utførelse omfordelt","execution.released":"Utførelse frigitt","execution.released-on-member-removal":"Utførelse frigitt etter brukerfjerning","execution.step-documented":"Utførelsessteg dokumentert","execution.step-changed":"Aktivt utførelsessteg endret","execution.external-follow-up-recorded":"Intern oppfølging registrert","execution.external-response-recorded":"Svar på oppfølging registrert","execution.submitted-for-review":"Utførelse sendt til kontroll",
    "decision.created":"Beslutning registrert","decision.revised":"Beslutning revidert","work-item.registered":"Oppdrag registrert","work-item.delegated":"Oppdrag fordelt","work-item.processing-delegated":"Oppdrag flyttet fra behandling","work-item.reassigned":"Oppdrag omfordelt","work-item.reassignment-created":"Nytt oppdrag opprettet ved omfordeling","work-item.dependency-added":"Oppdragsavhengighet lagt til","work-item.dependency-removed":"Oppdragsavhengighet fjernet","work-item.final-report-updated":"Sluttrapport lagret","work-item.final-report-approved":"Sluttrapport godkjent","work-item-chain.cancelled":"Hele oppdragskjeden kansellert","work-item-type.created":"Oppdragstype opprettet","work-item-type.updated":"Oppdragstype oppdatert","final-report-template.updated":"Mal for sluttrapport oppdatert"
  };
  const entityLabels:Record<string,string>={"site":"Site","organization-unit":"Intern enhet","site-manager-assignment":"Site Manager","person":"Bruker","login-identity":"Innlogging","organization-role":"Arbeidsrolle","role-assignment":"Rolletildeling","workflow-definition":"Arbeidsflyt","workflow-run":"Planlegging","workflow-step":"Planleggingssteg","execution-run":"Utførelse","execution-step":"Utførelsessteg","execution-external-request":"Intern oppfølging","decision":"Beslutning","work-item":"Oppdrag","work-item-dependency":"Oppdragsavhengighet","work-item-type":"Oppdragstype"};
  const eventLabel=(value:string)=>eventLabels[value]??value.split(".").map(part=>part.replaceAll("-"," ")).join(" · ");
  const entityLabel=(value:string)=>entityLabels[value]??value.replaceAll("-"," ");
  return <div className="page">
    <header className="page-header"><div><h1>Revisjon</h1><p className="muted">Sporbare hendelser i sites du administrerer.</p></div><button className="help-button" type="button" onClick={()=>setHelpOpen(true)}><i aria-hidden="true">?</i><span>Hjelp</span></button></header>
    {error&&<p className="status-message error-message">{error}</p>}
    <form className="report-toolbar site-audit-toolbar" onSubmit={event=>{event.preventDefault();void load(1).catch(problem=>setError(errorMessage(problem,"Audit-loggen kunne ikke filtreres.")));}}>
      <div className="field"><label>Site</label><select value={siteId} onChange={event=>setSiteId(event.target.value)}>{sites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
      <div className="field"><label>Område</label><select value={area} onChange={event=>setArea(event.target.value)}><option value="">Alle områder</option><option value="organization">Organisasjon</option><option value="personnel">Personell og roller</option><option value="workflows">Arbeidsflyter og maler</option><option value="tasks">Oppdrag og rapporter</option></select></div>
      <div className="field"><label>Hendelse</label><select value={eventType} onChange={event=>setEventType(event.target.value)}><option value="">Alle hendelser</option>{eventTypes.map(value=><option key={value} value={value}>{eventLabel(value)}</option>)}</select></div>
      <div className="field"><label>Fra dato</label><input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></div>
      <div className="field"><label>Til dato</label><input type="date" value={to} min={from||undefined} onChange={event=>setTo(event.target.value)}/></div>
      <div className="field"><label>Søk</label><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Hendelse, område eller bruker"/></div>
      <button className="secondary-button" type="submit">Filtrer</button>
      <button className="text-button" type="button" onClick={()=>{setArea("");setEventType("");setFrom("");setTo("");setSearch("");void load(1,true).catch(problem=>setError(errorMessage(problem,"Audit-loggen kunne ikke nullstilles.")));}}>Nullstill</button>
    </form>
    <section className="panel audit-list-panel">
      <div className="section-heading"><div><h2>Hendelser</h2><p className="muted">{total} registrert</p></div></div>
      {rows.length===0?<p className="empty-list-message">Ingen hendelser samsvarer med filteret.</p>:<div className="audit-list">{rows.map(row=><article className="audit-row" key={row.id}><time>{new Date(row.occurredAt).toLocaleString(displayLanguage,{timeZone:displayTimeZone})}</time><span><strong>{eventLabel(row.eventType)}</strong><small>{entityLabel(row.entityType)}{row.entityName?` · ${row.entityName}`:""}</small></span><span className="audit-actor"><small>Utført av</small><b>{row.actor}</b></span></article>)}</div>}
      <div className="pagination"><button className="secondary-button" type="button" disabled={page<=1} onClick={()=>void load(page-1).catch(problem=>setError(errorMessage(problem,"Forrige side kunne ikke lastes.")))}>Forrige</button><span>Side {page} av {totalPages}</span><button className="secondary-button" type="button" disabled={page>=totalPages} onClick={()=>void load(page+1).catch(problem=>setError(errorMessage(problem,"Neste side kunne ikke lastes.")))}>Neste</button></div>
    </section>
    {helpOpen&&<SectionHelp title="Slik bruker du Revisjon" intro="Revisjon viser hvem som har utført sporbare handlinger i siten, og når de ble utført." steps={[{title:"Velg site.",text:"Hvis du administrerer flere sites, velger du først hvilken hendelseslogg som skal vises."},{title:"Avgrens tidsrom og område.",text:"Bruk dato, område og hendelsestype for å finne endringer i organisasjon, personell, arbeidsflyter, oppdrag og rapporter."},{title:"Søk etter aktør eller hendelse.",text:"Søkefeltet finner hendelsestype, teknisk område eller navnet på personen som utførte handlingen."},{title:"Les hendelseslinjen.",text:"Hver linje viser tidspunkt, en forståelig beskrivelse, berørt objekt og hvem som utførte handlingen."}]} note="Revisjonen er skrivebeskyttet. Hendelser kan ikke redigeres eller slettes fra denne siden." onClose={()=>setHelpOpen(false)}/>}
  </div>;
}
