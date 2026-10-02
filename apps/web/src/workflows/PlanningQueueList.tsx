import { TaskCommentsButton } from "../tasks/TaskCommentsButton";
import { translateActive } from "../localization";
import type { ReactNode } from "react";
import { PaginationNav } from "../components/PaginationNav";
import type { TaskUnit } from "../work/WorkContextModels";
import type { PlanningRun } from "./PlanningModels";
import { PlanningTaskPreview } from "./PlanningTaskPreview";
import { WorkReference } from "../components/WorkReference";

type PlanningQueueListProps = {
  siteId: string;
  runs: PlanningRun[];
  totalItems: number;
  page: number;
  openRunId: string | null;
  previewRunId: string | null;
  canPlan: boolean;
  language: string;
  timeZone: string;
  allocationUnits: (run: PlanningRun) => TaskUnit[];
  renderEditor: (run: PlanningRun) => ReactNode;
  onToggle: (runId: string) => void;
  onCopyLink: (runId: string) => void;
  onTogglePreview: (runId: string) => void;
  onRelease: (run: PlanningRun) => void;
  onReassign: (run: PlanningRun) => void;
  onAllocateDownward: (run: PlanningRun, units: TaskUnit[]) => void;
  onShowAncestor: (itemId: string) => void;
  onClaim: (run: PlanningRun) => void;
  onPageChange: (page: number) => void;
};

function planningStatus(run: PlanningRun) {
  if (run.status === "cancelled") return translateActive("taskStatusCancelled");
  if (run.status === "available") return translateActive("workflowsPlanningQueueListAvailable");
  if (run.status === "awaiting_approval") return translateActive("workflowsPlanningQueueListAwaitingApproval");
  return translateActive("workflowsPlanningQueueListInPlanning");
}

export function PlanningQueueList({
  siteId,
  runs,
  totalItems,
  page,
  openRunId,
  previewRunId,
  canPlan,
  language,
  timeZone,
  allocationUnits,
  renderEditor,
  onToggle,
  onCopyLink,
  onTogglePreview,
  onRelease,
  onReassign,
  onAllocateDownward,
  onShowAncestor,
  onClaim,
  onPageChange,
}: PlanningQueueListProps) {
  return <section className="task-list process-queue heading-toggle-queue" aria-label={translateActive("workflowsPlanningQueueListPlanningQueueNewestFirst")}>
    {totalItems === 0 && <div className="panel empty-state">
      <p className="muted">{translateActive("workflowsPlanningQueueListNoTasksInThePlanningQueue")}</p>
    </div>}
    {runs.map(run => {
      const childUnits = allocationUnits(run);
      const open = openRunId === run.id;
      return <article className={`panel task-card process-card${open ? "" : " minimized"}`} key={run.id}>
        <div className="task-card-heading task-reference-heading task-interactive-heading" onClick={event => { if (!(event.target as HTMLElement).closest("button, a")) onToggle(run.id); }}>
          <WorkReference referenceCode={run.item.referenceCode}/>
          <h2><button className="task-heading-toggle" type="button" title={run.item.title} aria-expanded={open} aria-label={`${open ? translateActive("workflowsPlanningQueueListClosePlanning") : translateActive("workflowsPlanningQueueListOpenPlanning")}: ${run.item.title}`} onClick={() => onToggle(run.id)}><i aria-hidden="true">{open ? "▾" : "▸"}</i><span>{run.item.title}</span></button></h2>
          <div className="task-header-actions"><span className={`task-status ${run.status === "cancelled" ? "cancelled" : "planning"}`}>{planningStatus(run)}</span>{open && <button className="task-icon-action permalink-action" type="button" title={translateActive("workflowsPlanningQueueListCopyLinkToPlanning")} aria-label={translateActive("workflowsPlanningQueueListCopyLinkToPlanning")} onClick={() => onCopyLink(run.id)}><i aria-hidden="true">🔗</i></button>}</div>
        </div>
        {run.status === "cancelled" && <p className="task-decision-note">
          <strong>{translateActive("workflowsPlanningQueueListTheTaskWasCancelledByThe")}</strong> {run.item.decisionNote}
        </p>}
        <div className="task-meta">
          {run.item.originReference && <span><strong>{translateActive("originReferenceLabel")}:</strong> {run.item.originReference}</span>}
          <span><strong>{translateActive("workflowsPlanningQueueListWorkLevel")}</strong> {run.item.assignedUnitName ?? translateActive("topLevel")}</span>
          <span>{run.claimedBy ? `Assignee: ${run.claimedBy}` : translateActive("workflowsPlanningQueueListNoOneHasClaimedResponsibility")}</span>
          <span>{translateActive("workflowsExecutionWorkflowEditorStep")} {Math.min(run.currentStep + 1, run.steps.length)} {translateActive("workflowsExecutionWorkflowEditorOf")} {run.steps.length}</span>
        </div>
        {run.status === "in_progress" && run.claimedByPersonId && run.canManage && <div className="task-actions">
          <button className="secondary-button" type="button" onClick={() => onRelease(run)}>{translateActive("workflowsPlanningQueueListReleasePlanning")}</button>
          <button className="secondary-button" type="button" onClick={() => onReassign(run)}>{translateActive("workflowsPlanningDialogsReassignPlanning")}</button>
        </div>}
        {run.canManage && childUnits.length > 0 && <button className="secondary-button" type="button" onClick={() => onAllocateDownward(run, childUnits)}>{translateActive("workflowsPlanningQueueListClosePlanningAndRouteOnward")}</button>}
        <div className="task-detail-links"><button className="link-button" type="button" onClick={() => onTogglePreview(run.id)}>
          {previewRunId === run.id ? translateActive("workflowsPlanningQueueListHideTask") : translateActive("workflowsPlanningQueueListShowTask")}
        </button><TaskCommentsButton siteId={siteId} itemId={run.item.id} title={run.item.title} timeZone={timeZone} /></div>
        {run.ancestors.length > 0 && <div className="task-detail-links" aria-label={translateActive("parentPlansLabel")}>
          {run.ancestors.map(ancestor => <button className="link-button" type="button" key={ancestor.id} onClick={() => onShowAncestor(ancestor.id)}>
            {ancestor.distance === 1 ? `Show the plan from the level above · ${ancestor.title}` : `Show the plan ${ancestor.distance} levels above · ${ancestor.title}`}
          </button>)}
        </div>}
        {previewRunId === run.id && <PlanningTaskPreview item={run.item} language={language} timeZone={timeZone} />}
        {run.status === "available" && canPlan && <button className="primary-button" type="button" onClick={() => onClaim(run)}>{translateActive("workflowsPlanningQueueListClaimProcessingResponsibility")}</button>}
        {renderEditor(run)}
      </article>;
    })}
    <PaginationNav page={page} totalItems={totalItems} onPageChange={onPageChange} label={translateActive("workflowsPlanningQueueListPlanningPages")} />
  </section>;
}
