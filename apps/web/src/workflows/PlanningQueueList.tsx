import type { ReactNode } from "react";
import { PaginationNav } from "../components/PaginationNav";
import type { TaskUnit } from "../work/WorkContextModels";
import type { PlanningRun } from "./PlanningModels";
import { PlanningTaskPreview } from "./PlanningTaskPreview";

type PlanningQueueListProps = {
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
  if (run.status === "cancelled") return "Cancelled";
  if (run.status === "available") return "Togjengelig";
  if (run.status === "awaiting_approval") return "Awaiting approval";
  return "In planning";
}

export function PlanningQueueList({
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
  return <section className="task-list process-queue" aria-label="Planning queue, newest first">
    {totalItems === 0 && <div className="panel empty-state">
      <p className="muted">No tasks in the planning queue at the selected level.</p>
    </div>}
    {runs.map(run => {
      const childUnits = allocationUnits(run);
      const open = openRunId === run.id;
      return <article className={`panel task-card process-card${open ? "" : " minimized"}`} key={run.id}>
        <div className="task-card-heading">
          <h2>{run.item.title}</h2>
          <span className={`task-status ${run.status === "cancelled" ? "cancelled" : "planning"}`}>{planningStatus(run)}</span>
        </div>
        <button className="task-card-toggle process-card-toggle" type="button" aria-expanded={open} onClick={() => onToggle(run.id)}>
          <i aria-hidden="true">▱</i><span>{open ? "Close planning" : "Open planning"}</span>
        </button>
        {open && <div className="permalink-action-row"><button className="task-icon-action permalink-action" type="button" title="Copy link to planning" aria-label="Copy link to planning" onClick={() => onCopyLink(run.id)}><i aria-hidden="true">🔗</i></button></div>}
        {run.status === "cancelled" && <p className="task-decision-note">
          <strong>The task was cancelled by the top-level manager:</strong> {run.item.decisionNote}
        </p>}
        <div className="task-meta">
          <span><strong>Work level:</strong> {run.item.assignedUnitName ?? "Top level"}</span>
          <span>{run.claimedBy ? `Ansvarlig: ${run.claimedBy}` : "No one has claimed responsibility"}</span>
          <span>Step {Math.min(run.currentStep + 1, run.steps.length)} of {run.steps.length}</span>
        </div>
        {run.status === "in_progress" && run.claimedByPersonId && run.canManage && <div className="task-actions">
          <button className="secondary-button" type="button" onClick={() => onRelease(run)}>Release planning</button>
          <button className="secondary-button" type="button" onClick={() => onReassign(run)}>Reassign planning</button>
        </div>}
        {run.canManage && childUnits.length > 0 && <button className="secondary-button" type="button" onClick={() => onAllocateDownward(run, childUnits)}>Close planning and route onward</button>}
        <button className="link-button" type="button" onClick={() => onTogglePreview(run.id)}>
          {previewRunId === run.id ? "Hide task" : "Show task"}
        </button>
        {run.ancestors.length > 0 && <div className="task-detail-links" aria-label="Overordnede planer">
          {run.ancestors.map(ancestor => <button className="link-button" type="button" key={ancestor.id} onClick={() => onShowAncestor(ancestor.id)}>
            {ancestor.distance === 1 ? `Show the plan from the level above · ${ancestor.title}` : `Show the plan ${ancestor.distance} levels above · ${ancestor.title}`}
          </button>)}
        </div>}
        {previewRunId === run.id && <PlanningTaskPreview item={run.item} language={language} timeZone={timeZone} />}
        {run.status === "available" && canPlan && <button className="primary-button" type="button" onClick={() => onClaim(run)}>Claim processing responsibility</button>}
        {renderEditor(run)}
      </article>;
    })}
    <PaginationNav page={page} totalItems={totalItems} onPageChange={onPageChange} label="Planning pages" />
  </section>;
}
