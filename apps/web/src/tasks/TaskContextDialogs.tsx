import { translateActive } from "../localization";
import { Modal } from "../components/Modal";
import { RichTextContent } from "../components/RichText";
import type { WorkItem, WorkItemDetails } from "../work/WorkItemModels";
import { StepDocumentLinks, WorkflowTimeline } from "../workflows/WorkflowFields";
import { priorityLabel, taskStatusLabel } from "./taskPolicy";

export function TaskPlanContent({ details, language }: { details: WorkItemDetails; language: string }) {
  const { task, plan } = details;
  const isInheritedPlan = Boolean(plan && plan.ownerWorkItemId !== task.id);
  if (!plan) return <p className="muted">{translateActive("tasksTaskContextDialogsThisTaskHasNoSavedPlan")}</p>;
  const planContent = <>
    <div className="plan-presentation">{plan.steps.map(step => <section key={step.id}>
      <h4>{step.name}</h4>
      {step.hasTimeline && plan.timelineStartedOn && <WorkflowTimeline language={language} startDate={plan.timelineStartedOn} events={step.timelineEvents ?? []} />}
      <RichTextContent value={step.content} />
      <StepDocumentLinks links={step.links ?? []} editable={false} />
    </section>)}</div>
    {plan.allocations.length > 0 && <><h4>{isInheritedPlan ? translateActive("tasksTaskContextDialogsTasksAllocatedToThisUnit") : translateActive("tasksTaskContextDialogsTaskAllocation")}</h4>
      <ul className="plan-allocations">{plan.allocations.map((allocation, index) => <li key={index}><span><strong>{allocation.unitName}</strong><br />{allocation.instruction}</span></li>)}</ul></>}
    {plan.requests.length > 0 && !isInheritedPlan && <><h4>{translateActive("tasksTaskContextDialogsRequestsToOtherSites")}</h4><ul className="plan-allocations">{plan.requests.map((request, index) => <li key={index}><span><strong>{request.targetSiteName}</strong><br />{request.instruction}</span></li>)}</ul></>}
    {plan.rfi?.length > 0 && !isInheritedPlan && <section className="planning-rfi-readonly"><h4>{translateActive("rfiTitle")}</h4><div className="planning-rfi-list">{plan.rfi.map(entry => <article className="planning-rfi-row" key={entry.id}><div className="rfi-who"><strong>{translateActive("tasksTaskContextDialogsWho")}</strong><p>{entry.who || "—"}</p></div><div className="rfi-what"><strong>{translateActive("tasksTaskContextDialogsWhat")}</strong><p>{entry.what || "—"}</p></div><div className="rfi-due"><strong>{translateActive("approvalDue")}</strong><p>{entry.dueOn || "—"}</p></div><div className="rfi-answered"><strong>{translateActive("requestProgressAnswered")}</strong><p>{entry.answered ? translateActive("yes") : translateActive("no")}</p></div><div className="rfi-answer"><strong>{translateActive("tasksTaskContextDialogsResponse")}</strong><p>{entry.answer || "—"}</p></div></article>)}</div></section>}
  </>;
  return <>{task.parentWorkItemId && task.description && <section className="delegation-instruction"><h4>{translateActive("tasksTaskContextDialogsTasksInThisSubtask")}</h4><p>{task.description}</p></section>}
    {isInheritedPlan ? <details className="returned-report treatment-history-section"><summary><span>{translateActive("tasksTaskContextDialogsSuperiorPlan")}</span><small>{translateActive("tasksTaskContextDialogsShowThePlanBasisWhenNeeded")}</small></summary><div className="returned-report-content">{planContent}</div></details> : planContent}</>;
}

export function TaskPlanDialog({ details, language, timeZone, onClose }: {
  details: WorkItemDetails;
  language: string;
  timeZone: string;
  onClose: () => void;
}) {
  const { task } = details;
  return <Modal title={translateActive("planLabel")} onClose={onClose}>
    <article className="task-detail-view">
      <h3>{task.title}</h3>
      <div className="task-meta">
        <span><strong>{translateActive("tasksTaskCardPresentationUnit")}</strong> {task.unitName ?? translateActive("topLevel")}</span>
        <span><strong>{translateActive("approvalStatus")}:</strong> {taskStatusLabel(task.status)}</span>
        <span><strong>{translateActive("tasksTaskContextDialogsPriority")}</strong> {priorityLabel(task.priority)}</span>
        <span><strong>{translateActive("tasksTaskCardPresentationDueDate")}</strong> {task.dueAt ? new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone }).format(new Date(task.dueAt)) : translateActive("none")}</span>
      </div>
      <TaskPlanContent details={details} language={language} />
    </article>
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>{translateActive("close")}</button></div>
  </Modal>;
}

export function TaskWorkContextDialog({ selectedItem, tree, onClose, onShowPlan }: {
  selectedItem: WorkItem;
  tree: Array<{ item: WorkItem; depth: number }>;
  onClose: () => void;
  onShowPlan: (item: WorkItem) => void;
}) {
  return <Modal title={translateActive("tasksTaskContextDialogsPrimaryTaskSubtasksAndPlans")} onClose={onClose}>
    <div className="work-context-tree">{tree.map(({ item, depth }) => <article className="delegation-child" key={item.id} style={{ marginLeft: `${Math.min(depth, 6) * 1.25}rem` }}>
      <div>
        <strong>{item.title}</strong>
        {item.id === selectedItem.id && <span className="task-type-badge">{translateActive("tasksTaskContextDialogsYourReceivedTask")}</span>}
        <div className="task-classifiers">
          {item.status !== "registered" && <span className={`task-info-badge task-priority ${item.priority}`}><i aria-hidden="true">◆</i>{priorityLabel(item.priority)}</span>}
          {item.workItemTypeName && <span className="task-info-badge task-type-badge"><i aria-hidden="true">▣</i>{item.workItemTypeName}</span>}
          {item.sourceTypeName && <span className="task-info-badge task-source-badge"><i aria-hidden="true">◈</i>{item.sourceTypeName}</span>}
          {item.senderName && <span className="task-info-badge task-sender-badge"><i aria-hidden="true">●</i>{item.senderName}</span>}
          {item.senderSiteName && <span className="task-info-badge task-source-badge"><i aria-hidden="true">◆</i>{translateActive("tasksTaskClassifiersFrom")} {item.senderSiteName}</span>}
          {item.senderPersonName && <span className="task-info-badge task-sender-badge"><i aria-hidden="true">●</i>{translateActive("tasksTaskClassifiersSentBy")} {item.senderPersonName}</span>}
          {item.referenceUrl && <a className="task-info-badge task-document-badge" href={item.referenceUrl} target="_blank" rel="noopener noreferrer"><i aria-hidden="true">▤</i>{translateActive("tasksTaskClassifiersPrimaryDocument")}</a>}
        </div>
      </div>
      <div className="task-meta"><span>{item.unitName ?? translateActive("topLevel")}</span><span>{taskStatusLabel(item.status)}</span></div>
      {item.description && <details className="returned-report task-description-section"><summary><span>{translateActive("approvalDescription")}</span><small>{translateActive("tasksTaskCardPresentationShowTheTaskText")}</small></summary><div className="returned-report-content"><p>{item.description}</p></div></details>}
      {item.status === "cancelled" && item.decisionNote && <p className="task-decision-note"><strong>{translateActive("tasksTaskContextDialogsCancelled")}</strong> {item.decisionNote}</p>}
      {item.finalReport && <section className="planning-result"><h4>{translateActive("approvalFinalReport")}</h4><RichTextContent value={item.finalReport} /></section>}
      {item.hasPlan && <div className="task-detail-links"><button className="task-icon-action task-plan-action" type="button" onClick={() => onShowPlan(item)}><i aria-hidden="true">▤</i><span>{translateActive("tasksTaskCardPresentationShowPlan")}</span></button></div>}
    </article>)}</div>
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>{translateActive("close")}</button></div>
  </Modal>;
}
