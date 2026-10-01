import type { ReactNode } from "react";
import { PaginationNav } from "../components/PaginationNav";
import { RichTextContent } from "../components/RichText";
import type { TaskUnit } from "../work/WorkContextModels";
import type { ExecutionItem } from "./ExecutionModels";
import { executionStatus } from "./executionQueue";

type ExecutionQueueListProps = {
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
  return <section className="task-list process-queue" aria-label="Execution queue, newest first">
    {totalItems === 0 && <div className="panel empty-state"><p className="muted">No tasks in the execution queue.</p></div>}
    {items.map(item => {
      const run = item.run;
      const mine = run?.claimedByPersonId === personId;
      const open = openItemId === item.id;
      const expanded = expandedItemId === item.id;
      const units = childUnits(item);
      return <article className={`panel task-card process-card${open ? "" : " minimized"}`} key={item.id}>
        <div className="task-card-heading">
          <div><h2>{item.title}</h2><span className="muted">{item.assignedUnitName ?? "Top level"}</span></div>
          <span className="task-status execution">{executionStatus(item)}</span>
        </div>
        <button className="task-card-toggle process-card-toggle" type="button" aria-expanded={open} onClick={() => onToggle(item.id)}>
          <i aria-hidden="true">▱</i><span>{open ? "Close execution" : "Open execution"}</span>
        </button>
        {open && <div className="permalink-action-row"><button className="task-icon-action permalink-action" type="button" title="Copy link to execution" aria-label="Copy link to execution" onClick={() => onCopyLink(item.id)}><i aria-hidden="true">🔗</i></button></div>}
        <button className="link-button" type="button" onClick={() => onToggleDetails(item.id)}>{expanded ? "Hide task" : "Read task"}</button>
        {expanded && <div className="planning-preview">
          {item.requestBasisSnapshot && <details className="returned-report treatment-history-section"><summary><span>Task basis from sender</span><small>Show frozen description and approved plan</small></summary><div className="returned-report-content"><RichTextContent value={item.requestBasisSnapshot}/></div></details>}
          {item.description && <details className="returned-report task-description-section"><summary><span>Beskrivelse</span><small>Show the task text</small></summary><div className="returned-report-content"><p>{item.description}</p></div></details>}
          {item.referenceUrl && <a href={item.referenceUrl} target="_blank" rel="noopener noreferrer">Open source link ↗</a>}
          {planContextIds[item.id] && <button className="link-button" type="button" onClick={() => onShowPlan(item)}>Vis tilgjengelig plan</button>}
        </div>}
        {(!run || run.status === "available") && <button className="primary-button" type="button" onClick={() => onClaim(item)}>Claim responsibility for the task</button>}
        {run && !mine && run.status !== "available" && <p className="status-message">Ansvarlig: {run.claimedBy}</p>}
        {run && managedIds.has(item.id) && run.claimedByPersonId && <div className="task-actions">
          <button className="secondary-button" type="button" onClick={() => onRelease(item)}>Release execution</button>
          <button className="secondary-button" type="button" onClick={() => onReassign(item)}>Reassign execution</button>
        </div>}
        {managedIds.has(item.id) && units.length > 0 && <button className="secondary-button" type="button" onClick={() => onAllocateDownward(item, units)}>Close execution and route onward</button>}
        {renderEditor(item)}
      </article>;
    })}
    <PaginationNav page={page} totalItems={totalItems} onPageChange={onPageChange} label="Execution pages" />
  </section>;
}
