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

export function TaskCardHeader({ item, open, language, timeZone, onToggle }: {
  item: WorkItem; open: boolean; language: string; timeZone: string; onToggle: () => void;
}) {
  return <>
    {item.parentWorkItemId && <div className="delegation-parent"><strong>{translateActive("tasksTaskCardPresentationSubtaskUnder")}</strong> {item.parentTitle}</div>}
    <div className="task-card-heading task-reference-heading"><WorkReference referenceCode={item.referenceCode}/><div className="task-title-cell"><TaskClassifiers item={item} /><h2 title={item.title}>{item.title}</h2><div className="task-card-summary-meta">
      {item.originReference && <span><strong>{translateActive("originReferenceLabel")}</strong> {item.originReference}</span>}
      <span><strong>{translateActive("tasksTaskCardPresentationReceivedRegistered")}</strong> {new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(item.createdAt))}</span>
      <span><strong>{translateActive("tasksTaskCardPresentationDueDate")}</strong> {item.dueAt ? new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone }).format(new Date(item.dueAt)) : translateActive("none")}</span>
      <span><strong>{translateActive("tasksTaskCardPresentationRegisteredBy")}</strong> {item.createdBy}</span>
    </div></div><div className="task-card-statuses">{item.isBlocked && <span className="task-status blocked">{translateActive("tasksTaskCardPresentationBlocked")}</span>}<span className={`task-status ${effectiveTaskStatus(item)}`}>{item.isOutgoingRequest ? requestProgressLabel(item.requestProgressStatus ?? "registered") : taskStatusLabel(item.status)}</span></div></div>
    <button className="task-card-toggle process-card-toggle" type="button" aria-expanded={open} onClick={onToggle}><i aria-hidden="true">▱</i><span>{open ? translateActive("tasksTaskCardPresentationCloseTask") : translateActive("tasksTaskCardPresentationOpenTask")}</span></button>
  </>;
}

export function TaskBasis({ item, canManage, onShowContext, onShowPlan, onDependencies, onDecisions, onRisks, onVersions }: {
  item: WorkItem; canManage: boolean; onShowContext: () => void; onShowPlan: () => void; onDependencies: () => void; onDecisions: () => void; onRisks: () => void; onVersions: () => void;
}) {
  return <>
    {item.description && <details className="returned-report task-description-section"><summary><span>{translateActive("approvalDescription")}</span><small>{translateActive("tasksTaskCardPresentationShowTheTaskText")}</small></summary><div className="returned-report-content"><p>{item.description}</p></div></details>}
    {item.requestBasisSnapshot && <details className="returned-report treatment-history-section"><summary><span>{translateActive("tasksTaskCardPresentationTaskBasisFromSender")}</span><small>{translateActive("tasksTaskCardPresentationShowFrozenDescriptionAndApprovedPlan")}</small></summary><div className="returned-report-content"><RichTextContent value={item.requestBasisSnapshot} /></div></details>}
    {item.isOutgoingRequest && <section className="planning-result"><h3>{translateActive("tasksTaskCardPresentationRequestTo")} {item.requestRecipientSiteName ?? translateActive("receivingSite")}</h3><p className="status-message"><strong>{translateActive("approvalStatus")}:</strong> {requestProgressLabel(item.requestProgressStatus ?? "registered")}</p>{item.requestRecipientIsExternal ? <p className="muted">{translateActive("tasksTaskCardPresentationTheRecipientSInternalPlanningAllocation")}</p> : <p className="muted">{translateActive("tasksTaskCardPresentationInternalRequestInTheSameSite")}</p>}{item.requestResponse && <details className="returned-report treatment-history-section"><summary><span>{translateActive("tasksTaskCardPresentationFinalReportFrom")} {item.requestRecipientSiteName ?? translateActive("recipientFallback")}</span><small>{item.requestRecipientIsExternal ? translateActive("tasksTaskCardPresentationShowTheApprovedOfficialResponse") : translateActive("tasksTaskCardPresentationShowApprovedResponseAndInternalHistory")}</small></summary><div className="returned-report-content"><RichTextContent value={item.requestResponse} /></div></details>}</section>}
    {item.isBlocked && <p className="status-message dependency-blocked-message"><strong>{translateActive("tasksTaskCardPresentationBlockedLabel")}</strong> {item.blockingDependencyCount === 1 ? translateActive("tasksTaskCardPresentationAnotherTaskMustBeCompletedFirst") : translateActive("tasksTaskCardPresentationOtherTasksMustBeCompletedFirst", { count: item.blockingDependencyCount })}</p>}
    <div className="task-detail-links">{item.parentWorkItemId && <button className="task-icon-action task-context-action" type="button" onClick={onShowContext}><i aria-hidden="true">◎</i><span>{translateActive("tasksTaskCardPresentationShowTheCompleteTaskView")}</span></button>}{item.hasPlan && item.status !== "planning_approval" && <button className="task-icon-action task-plan-action" type="button" onClick={onShowPlan}><i aria-hidden="true">▤</i><span>{translateActive("tasksTaskCardPresentationShowPlan")}</span></button>}{(canManage || item.dependencyCount > 0) && <button className="task-icon-action task-dependency-action" type="button" onClick={onDependencies}><i aria-hidden="true">⛓</i><span>{translateActive("tasksTaskCardPresentationDependencies")}{item.blockingDependencyCount > 0 ? ` (${item.blockingDependencyCount})` : ""}</span></button>}{(canManage || item.decisionCount > 0) && <button className="task-icon-action task-decision-action" type="button" onClick={onDecisions}><i aria-hidden="true">◆</i><span>{translateActive("tasksTaskCardPresentationDecisions")}{item.decisionCount > 0 ? ` (${item.decisionCount})` : ""}</span></button>}<button className="task-icon-action" type="button" onClick={onRisks}><i aria-hidden="true">▲</i><span>{translateActive("tasksTaskCardPresentationRisk")}</span></button><button className="task-icon-action" type="button" onClick={onVersions}><i aria-hidden="true">◫</i><span>{translateActive("tasksTaskCardPresentationVersionsAndApprovals")}</span></button></div>
    {item.parentWorkItemId && <div className="task-meta"><span><strong>{translateActive("tasksTaskCardPresentationUnit")}</strong> {item.unitName ?? translateActive("notAllocated")}</span></div>}
  </>;
}
