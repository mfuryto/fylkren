import { RichTextContent } from "../components/RichText";
import type { WorkItem, WorkItemDetails } from "../work/WorkItemModels";
import { StepDocumentLinks, WorkflowTimeline } from "../workflows/WorkflowFields";
import { ExecutionHistoryDetails, type ExecutionHistory } from "./ExecutionHistory";
import { TaskClassifiers } from "./TaskClassifiers";
import { effectiveTaskStatus, requestProgressLabels, taskStatusLabels as statusLabels, workflowProgress } from "./taskPolicy";

export type ChildHistory = { details: WorkItemDetails | null; execution: ExecutionHistory | null; loading: boolean; loaded: boolean };
type NextAction = { status: string; label: string };

export function TaskDelegationTree({ children, history, language, busy, canReassign, actionCount, nextActions, reportDate, onLoadHistory, onReassign, onChangeStatus, onDecision, onReleasePlan }: {
  children: WorkItem[];
  history: Record<string, ChildHistory>;
  language: string;
  busy: boolean;
  canReassign: (item: WorkItem) => boolean;
  actionCount: (item: WorkItem) => number;
  nextActions: (item: WorkItem) => NextAction[];
  reportDate: (value: string) => string;
  onLoadHistory: (item: WorkItem) => void;
  onReassign: (item: WorkItem) => void;
  onChangeStatus: (item: WorkItem, status: string) => void;
  onDecision: (item: WorkItem, status: "on_hold") => void;
  onReleasePlan: (item: WorkItem) => void;
}) {
  return <section className="delegation-tree"><h3>Fordelte oppdrag og anmodninger</h3>{children.map(child => {
    const childHistory=history[child.id];
    const plan=childHistory?.details?.plan;
    const execution=childHistory?.execution;
    return <article className={`delegation-child ${child.status === "completed" ? "delegation-child-returned" : ["reassigned", "cancelled", "rejected"].includes(child.status) ? "delegation-child-history" : "delegation-child-active"}`} key={child.id}>
      <div><strong>{child.isOutgoingRequest ? child.requestRecipientSiteName ?? "Mottakende site" : child.unitName ?? child.title}</strong><TaskClassifiers item={child} delegation /></div>
      <span className={`task-status ${effectiveTaskStatus(child)}`}>{child.isOutgoingRequest ? requestProgressLabels[child.requestProgressStatus ?? "registered"] ?? "Sendt" : statusLabels[child.status]}</span>
      {workflowProgress(child) && <p className="delegation-progress">{workflowProgress(child)}</p>}
      <details className="delegation-record-details" onToggle={event => { if (event.currentTarget.open) onLoadHistory(child); }}><summary>Vis oppdragsgrunnlag og tidligere behandling</summary><div className="delegation-record-content">
        {child.description && <section className="delegation-instruction"><h4>Oppgaver til {child.unitName ?? "mottakeren"}</h4><p>{child.description}</p></section>}
        {child.decisionNote && <p className="task-decision-note"><strong>{child.status === "cancelled" ? "Kansellert:" : child.status === "reassigned" ? "Omfordeling:" : "Beslutning:"}</strong> {child.decisionNote}</p>}
        {plan && <details className="returned-report treatment-history-section"><summary><span>Plan</span><small>Vis planleggingen</small></summary><div className="returned-report-content"><div className="plan-presentation">{plan.steps.map(step => <section key={step.id}><h4>{step.name}</h4>{step.hasTimeline && plan.timelineStartedOn && <WorkflowTimeline language={language} startDate={plan.timelineStartedOn} events={step.timelineEvents ?? []} />}<RichTextContent value={step.content} /><StepDocumentLinks links={step.links ?? []} editable={false} /></section>)}</div>{plan.allocations.length > 0 && <><h4>Oppgavefordeling</h4><ul className="plan-allocations">{plan.allocations.map((allocation, index) => <li key={index}><span><strong>{allocation.unitName}</strong><br />{allocation.instruction}</span></li>)}</ul></>}</div></details>}
        {execution && execution.steps.length > 0 && <details className="returned-report treatment-history-section"><summary><span>Utførelse</span><small>Vis dokumentert utførelse</small></summary><div className="returned-report-content"><ExecutionHistoryDetails execution={execution} language={language} /></div></details>}
        {child.finalReport && <details className="returned-report treatment-history-section"><summary><span>Sluttrapport fra {child.unitName ?? "underenheten"}</span><small>{child.finalReportApprovedAt ? `Godkjent av ${child.finalReportApprovedBy ?? "leder"}` : "Vis sluttrapport"}</small></summary><div className="returned-report-content"><div className="returned-report-meta"><span>Skrevet av {child.finalReportWrittenBy ?? child.createdBy}</span>{child.finalReportUpdatedAt && <span>{reportDate(child.finalReportUpdatedAt)}</span>}{child.finalReportApprovedAt && <span>Godkjent av {child.finalReportApprovedBy ?? "leder"}</span>}</div><RichTextContent value={child.finalReport} /></div></details>}
        {child.isOutgoingRequest && child.requestResponse && <details className="returned-report treatment-history-section request-response-section"><summary><span>Sluttrapport fra {child.requestRecipientSiteName ?? "mottakende site"}</span><small>Les det godkjente offisielle svaret før anmodningen fullføres</small></summary><div className="returned-report-content"><RichTextContent value={child.requestResponse} /></div></details>}
      </div></details>
      {actionCount(child) > 0 && <section className={`task-action-panel task-action-next delegation-next-actions ${actionCount(child) === 1 ? "task-action-compact" : ""}`}><div className="task-action-heading"><span>Neste steg</span><small>Velg videre behandling.</small></div><div className="task-actions">{canReassign(child) && <button className="secondary-button" type="button" onClick={() => onReassign(child)}>Omfordel oppdrag</button>}{nextActions(child).map(action => <button className={["completed", "release"].includes(action.status) ? "primary-button" : "secondary-button"} type="button" disabled={busy} key={action.status} onClick={() => action.status === "on_hold" ? onDecision(child, "on_hold") : action.status === "release" ? onReleasePlan(child) : onChangeStatus(child, action.status)}>{action.label}</button>)}</div></section>}
    </article>;
  })}</section>;
}
