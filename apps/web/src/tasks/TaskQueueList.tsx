import { PaginationNav } from "../components/PaginationNav";
import { RichTextContent } from "../components/RichText";
import type { WorkItem, WorkItemDetails } from "../work/WorkItemModels";
import { TaskActionPanels } from "./TaskActionPanels";
import { TaskPlanContent } from "./TaskContextDialogs";
import { TaskBasis, TaskCardHeader, taskCardClassName } from "./TaskCardPresentation";
import { TaskDelegationTree, type ChildHistory } from "./TaskDelegationTree";
import { ExecutionHistoryDetails } from "./ExecutionHistory";
import type { TaskNextAction } from "./taskPolicy";
import { workflowProgress } from "./taskPolicy";
import type { TaskUnitWithDepth } from "./taskScope";

type DecisionStatus = "assigned" | "on_hold" | "rejected" | "cancelled";

export function TaskQueueList({ items, visibleItems, totalItems, page, openItemId, language, timeZone, busy, history, planDetails, canManage, childUnits, nextActions, canDelegate, canSendRequest, pendingChildren, canReassign, childActionCount, canCancel, onToggle, onCopyLink, onShowContext, onShowPlan, onDependencies, onDecisions, onRisks, onVersions, onLoadHistory, onOpenReport, onApproveReport, onPlanDecision, onApprovePlan, onDecision, onStatus, onReview, onDelegate, onSendRequest, onReleasePlan, onReassign, onCancel, onPageChange, reportDate }: {
  items: WorkItem[];
  visibleItems: WorkItem[];
  totalItems: number;
  page: number;
  openItemId: string | null;
  language: string;
  timeZone: string;
  busy: boolean;
  history: Record<string, ChildHistory>;
  planDetails: Record<string, WorkItemDetails | null>;
  canManage: (item: WorkItem) => boolean;
  childUnits: (item: WorkItem) => TaskUnitWithDepth[];
  nextActions: (item: WorkItem) => TaskNextAction[];
  canDelegate: (item: WorkItem) => boolean;
  canSendRequest: (item: WorkItem) => boolean;
  pendingChildren: (item: WorkItem) => string[];
  canReassign: (item: WorkItem) => boolean;
  childActionCount: (item: WorkItem) => number;
  canCancel: (item: WorkItem) => boolean;
  onToggle: (itemId: string) => void;
  onCopyLink: (itemId: string) => void;
  onShowContext: (item: WorkItem) => void;
  onShowPlan: (item: WorkItem) => void;
  onDependencies: (item: WorkItem) => void;
  onDecisions: (item: WorkItem) => void;
  onRisks: (item: WorkItem) => void;
  onVersions: (item: WorkItem) => void;
  onLoadHistory: (item: WorkItem) => void;
  onOpenReport: (item: WorkItem) => void;
  onApproveReport: (item: WorkItem) => void;
  onPlanDecision: (item: WorkItem, action: "replan" | "hold" | "reject") => void;
  onApprovePlan: (item: WorkItem) => void;
  onDecision: (item: WorkItem, status: DecisionStatus) => void;
  onStatus: (item: WorkItem, status: string) => void;
  onReview: (item: WorkItem) => void;
  onDelegate: (item: WorkItem) => void;
  onSendRequest: (item: WorkItem) => void;
  onReleasePlan: (item: WorkItem) => void;
  onReassign: (item: WorkItem) => void;
  onCancel: (item: WorkItem) => void;
  onPageChange: (page: number) => void;
  reportDate: (value: string) => string;
}) {
  return <section className="task-list process-queue work-queue" aria-label="Task queue, newest first">
    {totalItems === 0 ? <div className="panel empty-state"><div><h2>No tasks in this view</h2><p className="muted">Register a task or select another filter.</p></div></div> : visibleItems.map(item => {
      const itemChildren = items.filter(child => child.parentWorkItemId === item.id);
      const itemChildUnits = childUnits(item);
      return <article className={taskCardClassName(item, openItemId === item.id)} key={item.id}>
        <TaskCardHeader item={item} open={openItemId === item.id} language={language} timeZone={timeZone} onToggle={() => onToggle(item.id)} />
        <div className="task-card-content" hidden={openItemId !== item.id}>
          <div className="permalink-action-row"><button className="task-icon-action permalink-action" type="button" title="Copy link to the task" aria-label="Copy link to the task" onClick={() => onCopyLink(item.id)}><i aria-hidden="true">🔗</i></button></div>
          <TaskBasis item={item} canManage={canManage(item)} onShowContext={() => onShowContext(item)} onShowPlan={() => onShowPlan(item)} onDependencies={() => onDependencies(item)} onDecisions={() => onDecisions(item)} onRisks={() => onRisks(item)} onVersions={() => onVersions(item)} />
          {workflowProgress(item) && <p className="delegation-progress">{workflowProgress(item)}</p>}
          {item.decisionNote && <p className="task-decision-note"><strong>{item.status === "cancelled" ? "Kanselleringsgrunnlag:" : item.status === "reassigned" ? "Omfordeling:" : "Siste beslutningsgrunnlag:"}</strong> {item.decisionNote}</p>}
          {item.finalReport && item.status !== "in_review" && <details className="returned-report treatment-history-section"><summary><span>Final report from this level</span><small>Show the final report</small></summary><div className="returned-report-content"><RichTextContent value={item.finalReport} /></div></details>}
          {item.status === "planning_approval" && <section className="planning-result task-plan-review"><h3>Plan awaiting approval</h3>{planDetails[item.id] ? <TaskPlanContent details={planDetails[item.id]!} language={language} /> : <p className="muted">{item.id in planDetails ? "The proposed plan could not be loaded." : "Loading proposed plan…"}</p>}</section>}
          {canManage(item) && item.status === "in_review" && <section className="planning-result">
            <details className="returned-report treatment-history-section" onToggle={event => { if (event.currentTarget.open) onLoadHistory(item); }}><summary><span>Execution</span><small>Show documented execution before writing the final report</small></summary><div className="returned-report-content"><ExecutionHistoryDetails execution={history[item.id]?.execution ?? null} language={language} loading={history[item.id]?.loading} loaded={history[item.id]?.loaded} /></div></details>
            <h3>Final report</h3><p className="muted">The report becomes visible to the level above when the task is completed.</p>
            {item.finalReport ? <RichTextContent value={item.finalReport} /> : <p className="status-message">The final report must be written and saved before the task can be completed.</p>}
            {item.finalReportApprovedAt && <p className="status-message">Approved by {item.finalReportApprovedBy} {new Date(item.finalReportApprovedAt).toLocaleDateString(language, { timeZone })}.</p>}
          </section>}
          <TaskActionPanels item={item} canManage={canManage(item)} childUnitCount={itemChildUnits.length} busy={busy} nextActions={nextActions(item)} canDelegate={canDelegate(item)} canSendRequest={canSendRequest(item)} pendingChildren={pendingChildren(item)} onDecision={status => onDecision(item, status)} onStatus={status => onStatus(item, status)} onReview={() => onReview(item)} onDelegate={() => onDelegate(item)} onSendRequest={() => onSendRequest(item)} onReleasePlan={() => onReleasePlan(item)} onPlanDecision={action => onPlanDecision(item, action)} onApprovePlan={() => onApprovePlan(item)} onOpenReport={() => onOpenReport(item)} onApproveReport={() => onApproveReport(item)} />
          {itemChildren.length > 0 && <TaskDelegationTree children={itemChildren} history={history} language={language} busy={busy} canReassign={canReassign} actionCount={childActionCount} nextActions={nextActions} reportDate={reportDate} onLoadHistory={onLoadHistory} onReassign={onReassign} onChangeStatus={onStatus} onDecision={onDecision} onReleasePlan={onReleasePlan} />}
          {canCancel(item) && !["completed", "rejected", "cancelled", "reassigned"].includes(item.status) && <div className="task-danger-zone"><span><strong>Special authority</strong><small>{item.isOutgoingRequest ? "The recipient is notified that the request has been withdrawn." : "Cancellation closes the entire task chain."}</small></span><button className="danger-button" type="button" onClick={() => onCancel(item)}>{item.isOutgoingRequest ? "Withdraw request" : "Cancel the entire task chain"}</button></div>}
        </div>
      </article>;
    })}
    <PaginationNav page={page} totalItems={totalItems} onPageChange={onPageChange} label="Tasksider" />
  </section>;
}
