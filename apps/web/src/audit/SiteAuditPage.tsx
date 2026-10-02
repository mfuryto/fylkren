import { useEffect, useState } from "react";
import { SectionHelp } from "../components/SectionHelp";
import { errorMessage } from "../api/errors";
import { loadAuditSites, loadSiteAudit, type AuditSite, type SiteAuditRow } from "./siteAuditApi";
import { useTranslation } from "../localization/LocalizationProvider";
import type { MessageKey } from "../localization";
import { ListSortControl, type ListSort } from "../components/ListSortControl";

export function SiteAuditPage({ language: displayLanguage, timeZone: displayTimeZone }: { language: string; timeZone: string }) {
  const t = useTranslation();
  const [sites,setSites]=useState<AuditSite[]>([]);
  const [siteId,setSiteId]=useState("");
  const [rows,setRows]=useState<SiteAuditRow[]>([]);
  const [eventTypes,setEventTypes]=useState<string[]>([]);
  const [area,setArea]=useState("");
  const [eventType,setEventType]=useState("");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState<ListSort>("newest");
  const [page,setPage]=useState(1);
  const [totalPages,setTotalPages]=useState(1);
  const [total,setTotal]=useState(0);
  const [error,setError]=useState("");
  const [helpOpen,setHelpOpen]=useState(false);
  useEffect(()=>{loadAuditSites().then(values=>{setSites(values);setSiteId(values[0]?.id??"");}).catch(problem=>setError(errorMessage(problem,t("notificationSitesLoadFailed"))));},[]);
  async function load(nextPage=page,reset=false){if(!siteId)return;const data=await loadSiteAudit(siteId,nextPage,reset?{area:"",eventType:"",from:"",to:"",search:"",sort:"newest"}:{area,eventType,from,to,search,sort});setRows(data.events??[]);setEventTypes(data.eventTypes??[]);setPage(data.page??1);setTotalPages(data.totalPages??1);setTotal(data.total??0);setError("");}
  useEffect(()=>{if(siteId)void load(1).catch(problem=>setError(errorMessage(problem,t("auditLogLoadFailed"))));},[siteId]);
  const eventLabels:Record<string,MessageKey>={
    "local-user.created":"auditLocalUserCreated","local-user.updated":"auditUserUpdated","local-user.password-reset-initiated":"auditPasswordReset","site-member.deactivated":"auditSiteMemberDeactivated","identity.ad.person-added":"auditAdUserAdded","identity.ldap.person-added":"auditLdapUserAdded",
    "organization-role.created":"auditRoleCreated","organization-role.updated":"auditRoleUpdated","organization-role.deactivated":"auditRoleDeactivated","role-assignment.created":"auditRoleAssigned","role-assignment.deactivated":"auditRoleAssignmentRemoved","role-assignment.parent-leadership-updated":"auditParentLeadershipUpdated",
    "site.created":"auditSiteCreated","site.updated":"auditSiteUpdated","site.deactivated":"auditSiteDeactivated","site-manager.assigned":"auditSiteManagerAssigned","site-manager.deactivated":"auditSiteManagerRemoved","organization-unit.created":"auditUnitCreated","organization-unit.updated":"auditUnitUpdated","organization-unit.reordered":"auditUnitsReordered",
    "planning-workflow.configured":"auditPlanningConfigured","execution-workflow.created":"auditExecutionCreated","workflow.revised":"auditWorkflowRevised","workflow.deactivated":"auditWorkflowDeactivated","workflow.claimed":"auditWorkflowClaimed","workflow.reassigned":"auditWorkflowReassigned","workflow.released":"auditWorkflowReleased","workflow.released-on-member-removal":"auditWorkflowReleasedRemoval","workflow.step-documented":"auditPlanningStepDocumented","workflow.approved":"auditPlanApproved","workflow.replanning-requested":"auditReplanningRequested","workflow.put-on-hold":"auditPlanningOnHold","workflow.rejected":"auditPlanRejected",
    "execution.claimed":"auditExecutionClaimed","execution.workflow-started":"auditExecutionStarted","execution.reassigned":"auditExecutionReassigned","execution.released":"auditExecutionReleased","execution.released-on-member-removal":"auditExecutionReleasedRemoval","execution.step-documented":"auditExecutionStepDocumented","execution.step-changed":"auditExecutionStepChanged","execution.external-follow-up-recorded":"auditExternalFollowUp","execution.external-response-recorded":"auditExternalResponse","execution.submitted-for-review":"auditExecutionSubmitted",
    "decision.created":"auditDecisionCreated","decision.revised":"auditDecisionRevised","work-item.comment-added":"taskCommentAdded","work-item.registered":"auditWorkRegistered","work-item.delegated":"auditWorkDelegated","work-item.processing-delegated":"auditWorkProcessingDelegated","work-item.reassigned":"auditWorkReassigned","work-item.reassignment-created":"auditWorkReassignmentCreated","work-item.dependency-added":"auditDependencyAdded","work-item.dependency-removed":"auditDependencyRemoved","work-item.final-report-updated":"auditFinalReportUpdated","work-item.final-report-approved":"auditFinalReportApproved","work-item-chain.cancelled":"auditWorkChainCancelled","work-item-type.created":"auditWorkTypeCreated","work-item-type.updated":"auditWorkTypeUpdated","final-report-template.updated":"auditFinalReportTemplateUpdated"
  };
  const entityLabels:Record<string,MessageKey>={"site":"entitySite","organization-unit":"entityUnit","site-manager-assignment":"entitySiteManager","person":"entityPerson","login-identity":"entityLogin","organization-role":"entityRole","role-assignment":"entityRoleAssignment","workflow-definition":"entityWorkflow","workflow-run":"entityWorkflowRun","workflow-step":"entityWorkflowStep","execution-run":"entityExecutionRun","execution-step":"entityExecutionStep","execution-external-request":"entityExternalRequest","decision":"entityDecision","work-item":"entityWork","work-item-dependency":"entityDependency","work-item-type":"entityWorkType"};
  const eventLabel=(value:string)=>eventLabels[value]?t(eventLabels[value]):value.split(".").map(part=>part.replaceAll("-"," ")).join(" · ");
  const entityLabel=(value:string)=>entityLabels[value]?t(entityLabels[value]):value.replaceAll("-"," ");
  return <div className="page">
    <header className="page-header"><div><h1>{t("siteAudit")}</h1><p className="muted">{t("siteAuditIntro")}</p></div><button className="help-button" type="button" onClick={()=>setHelpOpen(true)}><i aria-hidden="true">?</i><span>{t("help")}</span></button></header>
    {error&&<p className="status-message error-message">{error}</p>}
    <form className="report-toolbar site-audit-toolbar" onSubmit={event=>{event.preventDefault();void load(1).catch(problem=>setError(errorMessage(problem,t("auditFilterFailed"))));}}>
      <div className="field"><label>{t("site")}</label><select value={siteId} onChange={event=>setSiteId(event.target.value)}>{sites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
      <div className="field"><label>{t("auditArea")}</label><select value={area} onChange={event=>setArea(event.target.value)}><option value="">{t("allAreas")}</option><option value="organization">{t("organizationArea")}</option><option value="personnel">{t("personnelArea")}</option><option value="workflows">{t("workflowsArea")}</option><option value="tasks">{t("tasksArea")}</option></select></div>
      <div className="field"><label>{t("auditEvent")}</label><select value={eventType} onChange={event=>setEventType(event.target.value)}><option value="">{t("allEvents")}</option>{eventTypes.map(value=><option key={value} value={value}>{eventLabel(value)}</option>)}</select></div>
      <div className="field"><label>{t("fromDate")}</label><input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></div>
      <div className="field"><label>{t("toDate")}</label><input type="date" value={to} min={from||undefined} onChange={event=>setTo(event.target.value)}/></div>
      <div className="field"><label>{t("search")}</label><input value={search} onChange={event=>setSearch(event.target.value)} placeholder={t("auditSearchPlaceholder")}/></div>
      <ListSortControl id="site-audit-sort" value={sort} onChange={setSort} options={["newest","oldest"]}/>
      <button className="secondary-button" type="submit">{t("filter")}</button>
      <button className="text-button" type="button" onClick={()=>{setArea("");setEventType("");setFrom("");setTo("");setSearch("");setSort("newest");void load(1,true).catch(problem=>setError(errorMessage(problem,t("auditResetFailed"))));}}>{t("clearSearch")}</button>
    </form>
    <section className="panel audit-list-panel">
      <div className="section-heading"><div><h2>{t("events")}</h2><p className="muted">{t("recordedCount",{count:total})}</p></div></div>
      {rows.length===0?<p className="empty-list-message">{t("noAuditMatches")}</p>:<div className="audit-list">{rows.map(row=><article className="audit-row" key={row.id}><time>{new Date(row.occurredAt).toLocaleString(displayLanguage,{timeZone:displayTimeZone})}</time><span><strong>{eventLabel(row.eventType)}</strong><small>{entityLabel(row.entityType)}{row.entityName?` · ${row.entityName}`:""}</small></span><span className="audit-actor"><small>{t("performedBy")}</small><b>{row.actor}</b></span></article>)}</div>}
      <div className="pagination"><button className="secondary-button" type="button" disabled={page<=1} onClick={()=>void load(page-1).catch(problem=>setError(errorMessage(problem,t("previousPageLoadFailed"))))}>{t("previous")}</button><span>{t("pageOf",{page,totalPages})}</span><button className="secondary-button" type="button" disabled={page>=totalPages} onClick={()=>void load(page+1).catch(problem=>setError(errorMessage(problem,t("nextPageLoadFailed"))))}>{t("next")}</button></div>
    </section>
    {helpOpen&&<SectionHelp title={t("siteAuditHelpTitle")} intro={t("siteAuditHelpIntro")} steps={[{title:t("siteAuditHelpSiteTitle"),text:t("siteAuditHelpSiteText")},{title:t("siteAuditHelpScopeTitle"),text:t("siteAuditHelpScopeText")},{title:t("siteAuditHelpSearchTitle"),text:t("siteAuditHelpSearchText")},{title:t("siteAuditHelpReadTitle"),text:t("siteAuditHelpReadText")}]} note={t("siteAuditHelpNote")} onClose={()=>setHelpOpen(false)}/>} 
  </div>;
}
