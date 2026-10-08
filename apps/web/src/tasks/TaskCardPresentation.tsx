import { WorkLifecycleButton } from "../components/WorkLifecycleButton";
import { AiAssistButton } from "../components/AiAssistButton";
import { ActivityButton } from "../components/ActivityTimeline";
import { TaskCommentsButton } from "./TaskCommentsButton";
import { translateActive } from "../localization";
import { RichTextContent } from "../components/RichText";
import type { WorkItem } from "../work/WorkItemModels";
import { TaskClassifiers } from "./TaskClassifiers";
import { WorkReference } from "../components/WorkReference";
import { effectiveTaskStatus, isReceivedRequest, requestProgressLabel, taskStatusLabel } from "./taskPolicy";

export function taskCardClassName(item: WorkItem, open: boolean) {
  const variant = item.isOutgoingRequest
    ? "panel task-card request-card request-card-sent"
    : isReceivedRequest(item)
      ? "panel task-card request-card request-card-received"
      : item.parentWorkItemId
        ? "panel task-card delegated-task-card"
        : "panel task-card";
  return `${variant} process-card${open ? "" : " minimized"}`;
}

export function TaskCardHeader({ item, open, language, timeZone, onToggle, onCopyLink }: {
  item: WorkItem; open: boolean; language: string; timeZone: string; onToggle: () => void; onCopyLink: () => void;
}) {
  return <>
    {item.parentWorkItemId && <div className="delegation-parent"><strong>{translateActive("tasksTaskCardPresentationSubtaskUnder")}</strong> {item.parentTitle}</div>}
    <div className="task-card-heading task-reference-heading task-interactive-heading" onClick={event => { if (!(event.target as HTMLElement).closest("button, a")) onToggle(); }}><WorkReference referenceCode={item.referenceCode}/><div className="task-title-cell"><TaskClassifiers item={item} /><h2><button className="task-heading-toggle" type="button" title={item.title} aria-expanded={open} aria-controls={`task-content-${item.id}`} aria-label={`${open ? translateActive("tasksTaskCardPresentationCloseTask") : translateActive("tasksTaskCardPresentationOpenTask")}: ${item.title}`} onClick={onToggle}><i aria-hidden="true">{open ? "▾" : "▸"}</i><span>{item.title}</span></button></h2><div className="task-card-summary-meta">
      {item.originReference && <span><strong>{translateActive("originReferenceLabel")}</strong> {item.originReference}</span>}
      <span><strong>{translateActive("tasksTaskCardPresentationReceivedRegistered")}</strong> {new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(item.createdAt))}</span>
      <span><strong>{translateActive("tasksTaskCardPresentationRegisteredBy")}</strong> {item.createdBy}</span>
    </div></div><div className="task-deadline-cell"><small>{translateActive("tasksTaskCardPresentationDueDate")}</small>{item.dueAt ? <time dateTime={item.dueAt}>{new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone }).format(new Date(item.dueAt))}</time> : <span>{translateActive("none")}</span>}</div><div className="task-header-actions"><div className="task-card-statuses">{item.isBlocked && <span className="task-status blocked">{translateActive("tasksTaskCardPresentationBlocked")}</span>}<span className={`task-status ${effectiveTaskStatus(item)}`}>{item.isOutgoingRequest ? requestProgressLabel(item.requestProgressStatus ?? "registered") : taskStatusLabel(item.status)}</span></div>{open && <button className="task-icon-action permalink-action" type="button" title={translateActive("tasksTaskQueueListCopyLinkToTheTask")} aria-label={translateActive("tasksTaskQueueListCopyLinkToTheTask")} onClick={onCopyLink}><i aria-hidden="true">🔗</i></button>}</div></div>
  </>;
}

export function TaskBasis({ item, canManage, aiEnabled, onAi, onShowContext, onShowPlan, onDependencies, onDecisions, onRisks, onVersions, siteId, timeZone }: {
  item: WorkItem; siteId: string; timeZone: string; canManage: boolean; aiEnabled: boolean; onAi: () => void; onShowContext: () => void; onShowPlan: () => void; onDependencies: () => void; onDecisions: () => void; onRisks: () => void; onVersions: () => void;
}) {
  return <>
    {item.description && <details className="returned-report task-description-section"><summary><span>{translateActive("approvalDescription")}</span><small>{translateActive("tasksTaskCardPresentationShowTheTaskText")}</small></summary><div className="returned-report-content"><p>{item.description}</p></div></details>}
    {item.requestBasisSnapshot && <details className="returned-report treatment-history-section"><summary><span>{translateActive("tasksTaskCardPresentationTaskBasisFromSender")}</span><small>{translateActive("tasksTaskCardPresentationShowFrozenDescriptionAndApprovedPlan")}</small></summary><div className="returned-report-content"><RichTextContent value={item.requestBasisSnapshot} /></div></details>}
    {item.isOutgoingRequest && <section className="planning-result"><h3>{translateActive("tasksTaskCardPresentationRequestTo")} {item.requestRecipientSiteName ?? translateActive("receivingSite")}</h3><p className="status-message"><strong>{translateActive("approvalStatus")}:</strong> {requestProgressLabel(item.requestProgressStatus ?? "registered")}</p>{item.requestRecipientIsExternal ? <p className="muted">{translateActive("tasksTaskCardPresentationTheRecipientSInternalPlanningAllocation")}</p> : <p className="muted">{translateActive("tasksTaskCardPresentationInternalRequestInTheSameSite")}</p>}{item.requestResponse && <details className="returned-report treatment-history-section"><summary><span>{translateActive("tasksTaskCardPresentationFinalReportFrom")} {item.requestRecipientSiteName ?? translateActive("recipientFallback")}</span><small>{item.requestRecipientIsExternal ? translateActive("tasksTaskCardPresentationShowTheApprovedOfficialResponse") : translateActive("tasksTaskCardPresentationShowApprovedResponseAndInternalHistory")}</small></summary><div className="returned-report-content"><RichTextContent value={item.requestResponse} /></div></details>}</section>}
    {item.isBlocked && <p className="status-message dependency-blocked-message"><strong>{translateActive("tasksTaskCardPresentationBlockedLabel")}</strong> {item.blockingDependencyCount === 1 ? translateActive("tasksTaskCardPresentationAnotherTaskMustBeCompletedFirst") : translateActive("tasksTaskCardPresentationOtherTasksMustBeCompletedFirst", { count: item.blockingDependencyCount })}</p>}
    <div className="task-detail-links">{aiEnabled && <AiAssistButton className="task-icon-action" label={translateActive("aiTaskAction")} onClick={onAi}/>} {item.parentWorkItemId && <button className="task-icon-action task-context-action" type="button" onClick={onShowContext}><i aria-hidden="true">◎</i><span>{translateActive("tasksTaskCardPresentationShowTheCompleteTaskView")}</span></button>}{item.hasPlan && item.status !== "planning_approval" && <button className="task-icon-action task-plan-action" type="button" onClick={onShowPlan}><i aria-hidden="true">▤</i><span>{translateActive("tasksTaskCardPresentationShowPlan")}</span></button>}{(canManage || item.dependencyCount > 0) && <button className="task-icon-action task-dependency-action" type="button" onClick={onDependencies}><i aria-hidden="true">⛓</i><span>{translateActive("tasksTaskCardPresentationDependencies")}{item.blockingDependencyCount > 0 ? ` (${item.blockingDependencyCount})` : ""}</span></button>}{(canManage || item.decisionCount > 0) && <button className="task-icon-action task-decision-action" type="button" onClick={onDecisions}><i aria-hidden="true">◆</i><span>{translateActive("tasksTaskCardPresentationDecisions")}{item.decisionCount > 0 ? ` (${item.decisionCount})` : ""}</span></button>}<button className="task-icon-action" type="button" onClick={onRisks}><i aria-hidden="true">▲</i><span>{translateActive("tasksTaskCardPresentationRisk")}</span></button><button className="task-icon-action" type="button" onClick={onVersions}><i aria-hidden="true">◫</i><span>{translateActive("tasksTaskCardPresentationVersionsAndApprovals")}</span></button><TaskCommentsButton siteId={siteId} itemId={item.id} title={item.title} timeZone={timeZone} /><ActivityButton siteId={siteId} itemId={item.id} title={item.title} timeZone={timeZone} />{canManage && <WorkLifecycleButton siteId={siteId} itemId={item.id} name={item.title} />}</div>
    {item.parentWorkItemId && <div className="task-meta"><span><strong>{translateActive("tasksTaskCardPresentationUnit")}</strong> {item.unitName ?? translateActive("notAllocated")}</span></div>}
  </>;
}
