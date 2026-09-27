import { useEffect, useState } from "react";
import { apiGet } from "../api/client";
import { errorMessage } from "../api/errors";
import { SectionHelp } from "../components/SectionHelp";

type AuditRow={id:string;occurredAt:string;eventType:string;entityType:string;entityId:string;actor:string;siteName:string|null;correlationId:string|null};

export function PlatformAuditPage({ language: displayLanguage, timeZone: displayTimeZone }: { language: string; timeZone: string }) {
  const [rows,setRows]=useState<AuditRow[]>([]);
  const [eventTypes,setEventTypes]=useState<string[]>([]);
  const [eventType,setEventType]=useState("");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(1);
  const [totalPages,setTotalPages]=useState(1);
  const [total,setTotal]=useState(0);
  const [error,setError]=useState("");
  const [helpOpen,setHelpOpen]=useState(false);
  async function load(nextPage=page,reset=false){const query=new URLSearchParams({page:String(nextPage)});if(!reset&&eventType)query.set("eventType",eventType);if(!reset&&search.trim())query.set("search",search.trim());const data=await apiGet<{events:AuditRow[];eventTypes:string[];page:number;totalPages:number;total:number}>(`/api/platform-audit?${query}`,"Plattformrevisjonen kunne ikke lastes.");setRows(data.events??[]);setEventTypes(data.eventTypes??[]);setPage(data.page??1);setTotalPages(data.totalPages??1);setTotal(data.total??0);setError("");}
  useEffect(()=>{void load(1).catch(problem=>setError(errorMessage(problem,"Plattformrevisjonen kunne ikke lastes.")));},[]);
  const label=(value:string)=>value.split(".").map(part=>part.replaceAll("-"," ")).join(" · ");
  return <div className="page platform-admin-page">
    <header className="page-header"><div><h1>Revisjon</h1><p className="muted">Sporbare plattformhandlinger fra Platform Manager og API-klienter.</p></div><button className="help-button" type="button" onClick={()=>setHelpOpen(true)}><i aria-hidden="true">?</i><span>Hjelp</span></button></header>
    {error&&<p className="status-message error-message">{error}</p>}
    <form className="report-toolbar" onSubmit={event=>{event.preventDefault();void load(1).catch(problem=>setError(errorMessage(problem,"Plattformrevisjonen kunne ikke filtreres.")));}}>
      <div className="field"><label>Hendelse</label><select value={eventType} onChange={event=>setEventType(event.target.value)}><option value="">Alle hendelser</option>{eventTypes.map(value=><option key={value} value={value}>{label(value)}</option>)}</select></div>
      <div className="field"><label>Søk</label><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Hendelse, område, site eller bruker"/></div>
      <button className="secondary-button" type="submit">Filtrer</button><button className="text-button" type="button" onClick={()=>{setEventType("");setSearch("");void load(1,true).catch(problem=>setError(errorMessage(problem,"Plattformrevisjonen kunne ikke nullstilles.")));}}>Nullstill</button>
    </form>
    <section className="panel audit-list-panel"><div className="section-heading"><div><h2>Plattformhendelser</h2><p className="muted">{total} registrert</p></div></div>
      {rows.length===0?<p className="empty-list-message">Ingen plattformhendelser samsvarer med filteret.</p>:<div className="audit-list">{rows.map(row=><article className="audit-row" key={row.id}><time>{new Date(row.occurredAt).toLocaleString(displayLanguage,{timeZone:displayTimeZone})}</time><span><strong>{label(row.eventType)}</strong><small>{label(row.entityType)}{row.siteName?` · ${row.siteName}`:" · Plattform"}{row.correlationId?` · Korrelasjon ${row.correlationId}`:""}</small></span><span className="audit-actor"><small>Utført av</small><b>{row.actor}</b></span></article>)}</div>}
      <div className="pagination"><button className="secondary-button" type="button" disabled={page<=1} onClick={()=>void load(page-1).catch(problem=>setError(errorMessage(problem,"Forrige side kunne ikke lastes.")))}>Forrige</button><span>Side {page} av {totalPages}</span><button className="secondary-button" type="button" disabled={page>=totalPages} onClick={()=>void load(page+1).catch(problem=>setError(errorMessage(problem,"Neste side kunne ikke lastes.")))}>Neste</button></div>
    </section>
    {helpOpen&&<SectionHelp title="Slik bruker du plattformrevisjonen" intro="Visningen er avgrenset til handlinger utført av Platform Manager og administrasjons-API-et, adskilt fra Site Managers revisjon." steps={[{title:"Filtrer hendelser.",text:"Velg hendelsestype eller søk etter teknisk område, site, bruker eller API-klient."},{title:"Kontroller aktør og tidspunkt.",text:"Hver rad viser hvem eller hvilken API-klient som utførte handlingen, når den skjedde og eventuell berørt site."},{title:"Følg API-kall.",text:"Maskinhandlinger merkes med API-klient og korrelasjons-ID slik at et kall kan spores uten å logge request-innhold eller hemmeligheter."},{title:"Bruk tekniske logger ved driftsfeil.",text:"Revisjon viser administrative handlinger. Feil og varsler fra selve driften finnes under Plattform."}]} note="Site Manager kan ikke se disse plattformhendelsene i sin site-revisjon." onClose={()=>setHelpOpen(false)}/>} 
  </div>;
}
