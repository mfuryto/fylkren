import { translateActive } from "../localization";
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
  return <section className="task-list process-queue work-queue" aria-label={translateActive("tasksTaskQueueListTaskQueueNewestFirst")}>
    {totalItems === 0 ? <div className="panel empty-state"><div><h2>{translateActive("tasksTaskQueueListNoTasksInThisView")}</h2><p className="muted">{translateActive("tasksTaskQueueListRegisterATaskOrSelectAnother")}</p></div></div> : visibleItems.map(item => {
      const itemChildren = items.filter(child => child.parentWorkItemId === item.id);
      const itemChildUnits = childUnits(item);
      return <article className={taskCardClassName(item, openItemId === item.id)} key={item.id}>
        <TaskCardHeader item={item} open={openItemId === item.id} language={language} timeZone={timeZone} onToggle={() => onToggle(item.id)} onCopyLink={() => onCopyLink(item.id)} />
        <div id={`task-content-${item.id}`} className="task-card-content" hidden={openItemId !== item.id}>
          <TaskBasis siteId={item.siteId} timeZone={timeZone} item={item} canManage={canManage(item)} onShowContext={() => onShowContext(item)} onShowPlan={() => onShowPlan(item)} onDependencies={() => onDependencies(item)} onDecisions={() => onDecisions(item)} onRisks={() => onRisks(item)} onVersions={() => onVersions(item)} />
          {workflowProgress(item) && <p className="delegation-progress">{workflowProgress(item)}</p>}
          {item.decisionNote && <p className="task-decision-note"><strong>{item.status === "cancelled" ? translateActive("cancellationBasis") : item.status === "reassigned" ? translateActive("tasksTaskDelegationTreeReassigning") : translateActive("latestDecisionBasis")}</strong> {item.decisionNote}</p>}
          {item.finalReport && item.status !== "in_review" && <details className="returned-report treatment-history-section"><summary><span>{translateActive("tasksTaskQueueListFinalReportFromThisLevel")}</span><small>{translateActive("tasksTaskQueueListShowTheFinalReport")}</small></summary><div className="returned-report-content"><RichTextContent value={item.finalReport} /></div></details>}
          {item.status === "planning_approval" && <section className="planning-result task-plan-review"><h3>{translateActive("taskStatusPlanningApproval")}</h3>{planDetails[item.id] ? <TaskPlanContent details={planDetails[item.id]!} language={language} /> : <p className="muted">{item.id in planDetails ? translateActive("tasksTaskQueueListTheProposedPlanCouldNotBe") : translateActive("tasksTaskQueueListLoadingProposedPlan")}</p>}</section>}
          {canManage(item) && item.status === "in_review" && <section className="planning-result">
            <details className="returned-report treatment-history-section" onToggle={event => { if (event.currentTarget.open) onLoadHistory(item); }}><summary><span>{translateActive("taskStatusExecution")}</span><small>{translateActive("tasksTaskQueueListShowDocumentedExecutionBeforeWritingThe")}</small></summary><div className="returned-report-content"><ExecutionHistoryDetails execution={history[item.id]?.execution ?? null} language={language} loading={history[item.id]?.loading} loaded={history[item.id]?.loaded} /></div></details>
            <h3>{translateActive("approvalFinalReport")}</h3><p className="muted">{translateActive("tasksTaskQueueListTheReportBecomesVisibleToThe")}</p>
            {item.finalReport ? <RichTextContent value={item.finalReport} /> : <p className="status-message">{translateActive("tasksTaskQueueListTheFinalReportMustBeWritten")}</p>}
            {item.finalReportApprovedAt && <p className="status-message">{translateActive("tasksTaskDelegationTreeApprovedBy")} {item.finalReportApprovedBy} {new Date(item.finalReportApprovedAt).toLocaleDateString(language, { timeZone })}.</p>}
          </section>}
          <TaskActionPanels item={item} canManage={canManage(item)} childUnitCount={itemChildUnits.length} busy={busy} nextActions={nextActions(item)} canDelegate={canDelegate(item)} canSendRequest={canSendRequest(item)} pendingChildren={pendingChildren(item)} onDecision={status => onDecision(item, status)} onStatus={status => onStatus(item, status)} onReview={() => onReview(item)} onDelegate={() => onDelegate(item)} onSendRequest={() => onSendRequest(item)} onReleasePlan={() => onReleasePlan(item)} onPlanDecision={action => onPlanDecision(item, action)} onApprovePlan={() => onApprovePlan(item)} onOpenReport={() => onOpenReport(item)} onApproveReport={() => onApproveReport(item)} />
          {itemChildren.length > 0 && <TaskDelegationTree children={itemChildren} history={history} language={language} busy={busy} canReassign={canReassign} actionCount={childActionCount} nextActions={nextActions} reportDate={reportDate} onLoadHistory={onLoadHistory} onReassign={onReassign} onChangeStatus={onStatus} onDecision={onDecision} onReleasePlan={onReleasePlan} />}
          {canCancel(item) && !["completed", "rejected", "cancelled", "reassigned"].includes(item.status) && <div className="task-danger-zone"><span><strong>{translateActive("tasksTaskQueueListSpecialAuthority")}</strong><small>{item.isOutgoingRequest ? translateActive("tasksTaskQueueListTheRecipientIsNotifiedThatThe") : translateActive("tasksTaskQueueListCancellationClosesTheEntireTaskChain")}</small></span><button className="danger-button" type="button" onClick={() => onCancel(item)}>{item.isOutgoingRequest ? translateActive("tasksTaskDecisionDialogsWithdrawRequest") : translateActive("tasksTaskDecisionDialogsCancelTheEntireTaskChain")}</button></div>}
        </div>
      </article>;
    })}
    <PaginationNav page={page} totalItems={totalItems} onPageChange={onPageChange} label={translateActive("tasksTaskQueueListTaskPages")} />
  </section>;
}
