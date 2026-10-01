import { translateActive } from "../localization";
import type { WorkItem } from "../work/WorkItemModels";

type NextAction = { status: string; label: string };
type DecisionStatus = "assigned" | "on_hold" | "rejected" | "cancelled";

export function TaskActionPanels({ item, canManage, childUnitCount, busy, nextActions, canDelegate, canSendRequest, pendingChildren, onDecision, onStatus, onReview, onDelegate, onSendRequest, onReleasePlan, onPlanDecision, onApprovePlan, onOpenReport, onApproveReport }: {
  item: WorkItem;
  canManage: boolean;
  childUnitCount: number;
  busy: boolean;
  nextActions: NextAction[];
  canDelegate: boolean;
  canSendRequest: boolean;
  pendingChildren: string[];
  onDecision: (status: DecisionStatus) => void;
  onStatus: (status: string) => void;
  onReview: () => void;
  onDelegate: () => void;
  onSendRequest: () => void;
  onReleasePlan: () => void;
  onPlanDecision: (action: "replan" | "hold" | "reject") => void;
  onApprovePlan: () => void;
  onOpenReport: () => void;
  onApproveReport: () => void;
}) {
  const reviewing = canManage && item.status === "under_review";
  const planApproval = canManage && item.status === "planning_approval" && item.hasPlan;
  const reportReview = canManage && item.status === "in_review";
  const nextActionCount = nextActions.length + Number(canDelegate) + Number(canSendRequest) + (reviewing ? 5 : 0) + Number(canManage && item.status === "on_hold") + (planApproval ? 4 : 0) + (reportReview ? 1 + Number(Boolean(item.finalReport && !item.finalReportApprovedAt)) : 0);
  return <>
    {item.status === "in_progress" && pendingChildren.length > 0 && <p className="status-message"><strong>{translateActive("tasksTaskActionPanelsAwaitingReportFrom")}</strong> {pendingChildren.join(", ")}.</p>}
    {nextActionCount > 0 && <section className={`task-action-panel task-action-next ${nextActionCount === 1 ? "task-action-compact" : ""}`}>
      <div className="task-action-heading"><span>{translateActive("tasksTaskActionPanelsNextStep")}</span><small>{translateActive("tasksTaskActionPanelsAvailableActionsInTheCurrentStatus")}</small></div>
      <div className="task-actions">
        {reviewing && <>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => onDecision("rejected")}>{translateActive("tasksTaskActionPanelsReject")}</button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => onDecision("on_hold")}>{translateActive("actionHold")}</button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => onStatus("planning")}>{translateActive("actionSendToPlanning")}</button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => onStatus("execution")}>{translateActive("actionSendToExecution")}</button>
          <button className="primary-button" type="button" disabled={busy || !childUnitCount} onClick={() => onDecision("assigned")}>{translateActive("tasksTaskActionPanelsApproveAndAllocate")}</button>
        </>}
        {canManage && item.status === "on_hold" && <button className="secondary-button" type="button" disabled={busy} onClick={() => onStatus("under_review")}>{translateActive("tasksTaskActionPanelsReopen")}</button>}
        {planApproval && <>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => onPlanDecision("replan")}>{translateActive("tasksTaskActionPanelsReturnWithCorrections")}</button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => onPlanDecision("hold")}>{translateActive("actionHold")}</button>
          <button className="danger-button" type="button" disabled={busy} onClick={() => onPlanDecision("reject")}>{translateActive("tasksTaskActionPanelsReject")}</button>
          <button className="primary-button" type="button" disabled={busy} onClick={onApprovePlan}>{translateActive("tasksTaskActionPanelsApprovePlan")}</button>
        </>}
        {reportReview && <>
          <button className={item.finalReport ? "secondary-button" : "primary-button"} type="button" disabled={busy} onClick={onOpenReport}>{item.finalReport ? translateActive("tasksTaskActionPanelsEditFinalReport") : translateActive("tasksTaskActionPanelsWriteFinalReport")}</button>
          {item.finalReport && !item.finalReportApprovedAt && <button className="primary-button" type="button" disabled={busy} onClick={onApproveReport}>{translateActive("tasksTaskActionPanelsApproveFinalReport")}</button>}
        </>}
        {nextActions.map(action => <button className={["completed", "release"].includes(action.status) ? "primary-button" : "secondary-button"} type="button" disabled={busy} key={action.status} onClick={() => action.status === "under_review" && item.status === "registered" ? onReview() : action.status === "on_hold" ? onDecision("on_hold") : action.status === "release" ? onReleasePlan() : onStatus(action.status)}>{action.label}</button>)}
        {canDelegate && <button className="secondary-button" type="button" onClick={onDelegate}>{translateActive("tasksTaskActionPanelsRouteOnward")}</button>}
        {canSendRequest && <button className="secondary-button" type="button" onClick={onSendRequest}>{translateActive("tasksTaskActionPanelsSendRequest")}</button>}
      </div>
    </section>}
  </>;
}
