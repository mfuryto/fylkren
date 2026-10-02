import { TaskCommentsButton } from "../tasks/TaskCommentsButton";
import { translateActive } from "../localization";
import type { ReactNode } from "react";
import { PaginationNav } from "../components/PaginationNav";
import { RichTextContent } from "../components/RichText";
import type { TaskUnit } from "../work/WorkContextModels";
import type { ExecutionItem } from "./ExecutionModels";
import { executionStatus } from "./executionQueue";
import { WorkReference } from "../components/WorkReference";

type ExecutionQueueListProps = {
  siteId: string;
  items: ExecutionItem[];
  totalItems: number;
  page: number;
  personId?: string;
  openItemId: string | null;
  expandedItemId: string | null;
  managedItemIds: string[];
  planContextIds: Record<string, string>;
  childUnits: (item: ExecutionItem) => TaskUnit[];
  renderEditor: (item: ExecutionItem) => ReactNode;
  onToggle: (itemId: string) => void;
  onCopyLink: (itemId: string) => void;
  onToggleDetails: (itemId: string) => void;
  onShowPlan: (item: ExecutionItem) => void;
  onClaim: (item: ExecutionItem) => void;
  onRelease: (item: ExecutionItem) => void;
  onReassign: (item: ExecutionItem) => void;
  onAllocateDownward: (item: ExecutionItem, units: TaskUnit[]) => void;
  onPageChange: (page: number) => void;
};

export function ExecutionQueueList({
  siteId,
  items,
  totalItems,
  page,
  personId,
  openItemId,
  expandedItemId,
  managedItemIds,
  planContextIds,
  childUnits,
  renderEditor,
  onToggle,
  onCopyLink,
  onToggleDetails,
  onShowPlan,
  onClaim,
  onRelease,
  onReassign,
  onAllocateDownward,
  onPageChange,
}: ExecutionQueueListProps) {
  const managedIds = new Set(managedItemIds);
  return <section className="task-list process-queue heading-toggle-queue" aria-label={translateActive("workflowsExecutionQueueListExecutionQueueNewestFirst")}>
    {totalItems === 0 && <div className="panel empty-state"><p className="muted">{translateActive("workflowsExecutionQueueListNoTasksInTheExecutionQueue")}</p></div>}
    {items.map(item => {
      const run = item.run;
      const mine = run?.claimedByPersonId === personId;
      const open = openItemId === item.id;
      const expanded = expandedItemId === item.id;
      const units = childUnits(item);
      return <article className={`panel task-card process-card${open ? "" : " minimized"}`} key={item.id}>
        <div className="task-card-heading task-reference-heading task-interactive-heading" onClick={event => { if (!(event.target as HTMLElement).closest("button, a")) onToggle(item.id); }}>
          <WorkReference referenceCode={item.referenceCode}/>
          <div className="task-title-cell"><h2><button className="task-heading-toggle" type="button" title={item.title} aria-expanded={open} aria-label={`${open ? translateActive("workflowsExecutionQueueListCloseExecution") : translateActive("workflowsExecutionQueueListOpenExecution")}: ${item.title}`} onClick={() => onToggle(item.id)}><i aria-hidden="true">{open ? "▾" : "▸"}</i><span>{item.title}</span></button></h2><span className="muted">{item.assignedUnitName ?? translateActive("topLevel")}</span></div>
          <div className="task-header-actions"><span className="task-status execution">{executionStatus(item)}</span>{open && <button className="task-icon-action permalink-action" type="button" title={translateActive("workflowsExecutionQueueListCopyLinkToExecution")} aria-label={translateActive("workflowsExecutionQueueListCopyLinkToExecution")} onClick={() => onCopyLink(item.id)}><i aria-hidden="true">🔗</i></button>}</div>
        </div>
        <div className="task-detail-links"><button className="link-button" type="button" onClick={() => onToggleDetails(item.id)}>{expanded ? translateActive("workflowsExecutionQueueListHideTask") : translateActive("workflowsExecutionQueueListReadTask")}</button><TaskCommentsButton siteId={siteId} itemId={item.id} title={item.title} /></div>
        {expanded && <div className="planning-preview">
          {item.originReference && <p className="muted"><strong>{translateActive("originReferenceLabel")}:</strong> {item.originReference}</p>}
          {item.requestBasisSnapshot && <details className="returned-report treatment-history-section"><summary><span>{translateActive("tasksTaskCardPresentationTaskBasisFromSender")}</span><small>{translateActive("tasksTaskCardPresentationShowFrozenDescriptionAndApprovedPlan")}</small></summary><div className="returned-report-content"><RichTextContent value={item.requestBasisSnapshot}/></div></details>}
          {item.description && <details className="returned-report task-description-section"><summary><span>{translateActive("approvalDescription")}</span><small>{translateActive("tasksTaskCardPresentationShowTheTaskText")}</small></summary><div className="returned-report-content"><p>{item.description}</p></div></details>}
          {item.referenceUrl && <a href={item.referenceUrl} target="_blank" rel="noopener noreferrer">{translateActive("workflowsExecutionQueueListOpenSourceLink")}</a>}
          {planContextIds[item.id] && <button className="link-button" type="button" onClick={() => onShowPlan(item)}>{translateActive("workflowsExecutionQueueListShowAvailablePlan")}</button>}
        </div>}
        {(!run || run.status === "available") && <button className="primary-button" type="button" onClick={() => onClaim(item)}>{translateActive("workflowsExecutionQueueListClaimResponsibilityForTheTask")}</button>}
        {run && !mine && run.status !== "available" && <p className="status-message">{translateActive("workflowsExecutionQueueListAssignee")} {run.claimedBy}</p>}
        {run && managedIds.has(item.id) && run.claimedByPersonId && <div className="task-actions">
          <button className="secondary-button" type="button" onClick={() => onRelease(item)}>{translateActive("workflowsExecutionQueueListReleaseExecution")}</button>
          <button className="secondary-button" type="button" onClick={() => onReassign(item)}>{translateActive("workflowsExecutionDialogsReassignExecution")}</button>
        </div>}
        {managedIds.has(item.id) && units.length > 0 && <button className="secondary-button" type="button" onClick={() => onAllocateDownward(item, units)}>{translateActive("workflowsExecutionQueueListCloseExecutionAndRouteOnward")}</button>}
        {renderEditor(item)}
      </article>;
    })}
    <PaginationNav page={page} totalItems={totalItems} onPageChange={onPageChange} label={translateActive("workflowsExecutionQueueListExecutionPages")} />
  </section>;
}
