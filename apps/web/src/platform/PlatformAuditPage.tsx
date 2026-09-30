import { useEffect, useState } from "react";
import { apiGet } from "../api/client";
import { errorMessage } from "../api/errors";
import { SectionHelp } from "../components/SectionHelp";
import { useTranslation } from "../localization/LocalizationProvider";

type AuditRow={id:string;occurredAt:string;eventType:string;entityType:string;entityId:string;actor:string;siteName:string|null;correlationId:string|null};

export function PlatformAuditPage({ language: displayLanguage, timeZone: displayTimeZone }: { language: string; timeZone: string }) {
  const t=useTranslation();
  const [rows,setRows]=useState<AuditRow[]>([]);
  const [eventTypes,setEventTypes]=useState<string[]>([]);
  const [eventType,setEventType]=useState("");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(1);
  const [totalPages,setTotalPages]=useState(1);
  const [total,setTotal]=useState(0);
  const [error,setError]=useState("");
  const [helpOpen,setHelpOpen]=useState(false);
  async function load(nextPage=page,reset=false){const query=new URLSearchParams({page:String(nextPage)});if(!reset&&eventType)query.set("eventType",eventType);if(!reset&&search.trim())query.set("search",search.trim());const data=await apiGet<{events:AuditRow[];eventTypes:string[];page:number;totalPages:number;total:number}>(`/api/platform-audit?${query}`,t("platformAuditLoadFailed"));setRows(data.events??[]);setEventTypes(data.eventTypes??[]);setPage(data.page??1);setTotalPages(data.totalPages??1);setTotal(data.total??0);setError("");}
  useEffect(()=>{void load(1).catch(problem=>setError(errorMessage(problem,t("platformAuditLoadFailed"))));},[]);
  const label=(value:string)=>value.split(".").map(part=>part.replaceAll("-"," ")).join(" · ");
  return <div className="page platform-admin-page">
    <header className="page-header"><div><h1>{t("navAudit")}</h1><p className="muted">{t("platformAuditIntro")}</p></div><button className="help-button" type="button" onClick={()=>setHelpOpen(true)}><i aria-hidden="true">?</i><span>{t("help")}</span></button></header>
    {error&&<p className="status-message error-message">{error}</p>}
    <form className="report-toolbar" onSubmit={event=>{event.preventDefault();void load(1).catch(problem=>setError(errorMessage(problem,t("platformAuditFilterFailed"))));}}>
      <div className="field"><label>{t("event")}</label><select value={eventType} onChange={event=>setEventType(event.target.value)}><option value="">{t("allEvents")}</option>{eventTypes.map(value=><option key={value} value={value}>{label(value)}</option>)}</select></div>
      <div className="field"><label>{t("search")}</label><input value={search} onChange={event=>setSearch(event.target.value)} placeholder={t("eventAreaSiteOrUser")}/></div>
      <button className="secondary-button" type="submit">{t("filter")}</button><button className="text-button" type="button" onClick={()=>{setEventType("");setSearch("");void load(1,true).catch(problem=>setError(errorMessage(problem,t("platformAuditResetFailed"))));}}>{t("reset")}</button>
    </form>
    <section className="panel audit-list-panel"><div className="section-heading"><div><h2>{t("platformEvents")}</h2><p className="muted">{t("registeredCount",{count:total})}</p></div></div>
      {rows.length===0?<p className="empty-list-message">{t("noPlatformEvents")}</p>:<div className="audit-list">{rows.map(row=><article className="audit-row" key={row.id}><time>{new Date(row.occurredAt).toLocaleString(displayLanguage,{timeZone:displayTimeZone})}</time><span><strong>{label(row.eventType)}</strong><small>{label(row.entityType)}{row.siteName?` · ${row.siteName}`:` · ${t("platformScope")}`}{row.correlationId?` · ${t("correlation",{id:row.correlationId})}`:""}</small></span><span className="audit-actor"><small>{t("performedBy")}</small><b>{row.actor}</b></span></article>)}</div>}
      <div className="pagination"><button className="secondary-button" type="button" disabled={page<=1} onClick={()=>void load(page-1).catch(problem=>setError(errorMessage(problem,t("previousPageLoadFailed"))))}>{t("previous")}</button><span>{t("pageOf",{page,totalPages})}</span><button className="secondary-button" type="button" disabled={page>=totalPages} onClick={()=>void load(page+1).catch(problem=>setError(errorMessage(problem,t("nextPageLoadFailed"))))}>{t("next")}</button></div>
    </section>
    {helpOpen&&<SectionHelp title={t("platformAuditHelpTitle")} intro={t("platformAuditHelpIntro")} steps={[{title:t("auditFilterTitle"),text:t("auditFilterText")},{title:t("auditActorTitle"),text:t("auditActorText")},{title:t("auditApiTitle"),text:t("auditApiText")},{title:t("auditLogsTitle"),text:t("auditLogsText")}]} note={t("auditSiteManagerNote")} onClose={()=>setHelpOpen(false)}/>}
  </div>;
}
