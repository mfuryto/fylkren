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
  if (run.status === "cancelled") return "Kansellert";
  if (run.status === "available") return "Tilgjengelig";
  if (run.status === "awaiting_approval") return "Til godkjenning";
  return "Under planlegging";
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
  return <section className="task-list process-queue" aria-label="Planleggingskø, nyeste først">
    {totalItems === 0 && <div className="panel empty-state">
      <p className="muted">Ingen oppdrag i planleggingskøen på valgt nivå.</p>
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
          <i aria-hidden="true">▱</i><span>{open ? "Lukk planlegging" : "Åpne planlegging"}</span>
        </button>
        {open && <div className="permalink-action-row"><button className="task-icon-action permalink-action" type="button" title="Kopier lenke til planleggingen" aria-label="Kopier lenke til planleggingen" onClick={() => onCopyLink(run.id)}><i aria-hidden="true">🔗</i></button></div>}
        {run.status === "cancelled" && <p className="task-decision-note">
          <strong>Oppdraget er kansellert av toppleder:</strong> {run.item.decisionNote}
        </p>}
        <div className="task-meta">
          <span><strong>Arbeidsnivå:</strong> {run.item.assignedUnitName ?? "Toppnivå"}</span>
          <span>{run.claimedBy ? `Ansvarlig: ${run.claimedBy}` : "Ingen har tatt ansvar"}</span>
          <span>Steg {Math.min(run.currentStep + 1, run.steps.length)} av {run.steps.length}</span>
        </div>
        {run.status === "in_progress" && run.claimedByPersonId && run.canManage && <div className="task-actions">
          <button className="secondary-button" type="button" onClick={() => onRelease(run)}>Frigjør planlegging</button>
          <button className="secondary-button" type="button" onClick={() => onReassign(run)}>Omfordel planlegging</button>
        </div>}
        {run.canManage && childUnits.length > 0 && <button className="secondary-button" type="button" onClick={() => onAllocateDownward(run, childUnits)}>Avslutt planlegging og fordel videre</button>}
        <button className="link-button" type="button" onClick={() => onTogglePreview(run.id)}>
          {previewRunId === run.id ? "Skjul oppgave" : "Vis oppgave"}
        </button>
        {run.ancestors.length > 0 && <div className="task-detail-links" aria-label="Overordnede planer">
          {run.ancestors.map(ancestor => <button className="link-button" type="button" key={ancestor.id} onClick={() => onShowAncestor(ancestor.id)}>
            {ancestor.distance === 1 ? `Vis planen fra nivået over · ${ancestor.title}` : `Vis planen ${ancestor.distance} nivåer opp · ${ancestor.title}`}
          </button>)}
        </div>}
        {previewRunId === run.id && <PlanningTaskPreview item={run.item} language={language} timeZone={timeZone} />}
        {run.status === "available" && canPlan && <button className="primary-button" type="button" onClick={() => onClaim(run)}>Ta ansvar for behandling</button>}
        {renderEditor(run)}
      </article>;
    })}
    <PaginationNav page={page} totalItems={totalItems} onPageChange={onPageChange} label="Planleggingssider" />
  </section>;
}
