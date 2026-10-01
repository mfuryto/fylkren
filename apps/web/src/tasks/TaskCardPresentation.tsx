import { RichTextContent } from "../components/RichText";
import type { WorkItem } from "../work/WorkItemModels";
import { TaskClassifiers } from "./TaskClassifiers";
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
    {item.parentWorkItemId && <div className="delegation-parent"><strong>Subtask under:</strong> {item.parentTitle}</div>}
    <div className="task-card-heading"><div><TaskClassifiers item={item} /><h2>{item.title}</h2><div className="task-card-summary-meta">
      <span><strong>Received/registered:</strong> {new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(item.createdAt))}</span>
      <span><strong>Due date:</strong> {item.dueAt ? new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone }).format(new Date(item.dueAt)) : "None"}</span>
      <span><strong>Registered av:</strong> {item.createdBy}</span>
    </div></div><div className="task-card-statuses">{item.isBlocked && <span className="task-status blocked">Blokkert</span>}<span className={`task-status ${effectiveTaskStatus(item)}`}>{item.isOutgoingRequest ? requestProgressLabel(item.requestProgressStatus ?? "registered") : taskStatusLabel(item.status)}</span></div></div>
    <button className="task-card-toggle process-card-toggle" type="button" aria-expanded={open} onClick={onToggle}><i aria-hidden="true">▱</i><span>{open ? "Close task" : "Open task"}</span></button>
  </>;
}

export function TaskBasis({ item, canManage, onShowContext, onShowPlan, onDependencies, onDecisions, onRisks, onVersions }: {
  item: WorkItem; canManage: boolean; onShowContext: () => void; onShowPlan: () => void; onDependencies: () => void; onDecisions: () => void; onRisks: () => void; onVersions: () => void;
}) {
  return <>
    {item.description && <details className="returned-report task-description-section"><summary><span>Beskrivelse</span><small>Show the task text</small></summary><div className="returned-report-content"><p>{item.description}</p></div></details>}
    {item.requestBasisSnapshot && <details className="returned-report treatment-history-section"><summary><span>Task basis from sender</span><small>Show frozen description and approved plan</small></summary><div className="returned-report-content"><RichTextContent value={item.requestBasisSnapshot} /></div></details>}
    {item.isOutgoingRequest && <section className="planning-result"><h3>Request to {item.requestRecipientSiteName ?? "receiving site"}</h3><p className="status-message"><strong>Status:</strong> {requestProgressLabel(item.requestProgressStatus ?? "registered")}</p>{item.requestRecipientIsExternal ? <p className="muted">The recipient's internal planning, allocation, execution, and reporting are protected.</p> : <p className="muted">Internal request in the same site. The task basis and previous processing follow the site's ordinary access rules.</p>}{item.requestResponse && <details className="returned-report treatment-history-section"><summary><span>Final report from {item.requestRecipientSiteName ?? "recipient"}</span><small>{item.requestRecipientIsExternal ? "Show the approved official response" : "Show approved response and internal history"}</small></summary><div className="returned-report-content"><RichTextContent value={item.requestResponse} /></div></details>}</section>}
    {item.isBlocked && <p className="status-message dependency-blocked-message"><strong>Blocked:</strong> {item.blockingDependencyCount === 1 ? "Another task must be completed first." : `${item.blockingDependencyCount} other tasks must be completed first.`}</p>}
    <div className="task-detail-links">{item.parentWorkItemId && <button className="task-icon-action task-context-action" type="button" onClick={onShowContext}><i aria-hidden="true">◎</i><span>Show the complete task view</span></button>}{item.hasPlan && item.status !== "planning_approval" && <button className="task-icon-action task-plan-action" type="button" onClick={onShowPlan}><i aria-hidden="true">▤</i><span>Vis plan</span></button>}{(canManage || item.dependencyCount > 0) && <button className="task-icon-action task-dependency-action" type="button" onClick={onDependencies}><i aria-hidden="true">⛓</i><span>Avhengigheter{item.blockingDependencyCount > 0 ? ` (${item.blockingDependencyCount})` : ""}</span></button>}{(canManage || item.decisionCount > 0) && <button className="task-icon-action task-decision-action" type="button" onClick={onDecisions}><i aria-hidden="true">◆</i><span>Beslutninger{item.decisionCount > 0 ? ` (${item.decisionCount})` : ""}</span></button>}<button className="task-icon-action" type="button" onClick={onRisks}><i aria-hidden="true">▲</i><span>Risiko</span></button><button className="task-icon-action" type="button" onClick={onVersions}><i aria-hidden="true">◫</i><span>Versioner og godkjenninger</span></button></div>
    {item.parentWorkItemId && <div className="task-meta"><span><strong>Enhet:</strong> {item.unitName ?? "Not allocated"}</span></div>}
  </>;
}
