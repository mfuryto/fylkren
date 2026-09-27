import { Modal } from "../components/Modal";
import { RichTextContent } from "../components/RichText";
import type { WorkItem, WorkItemDetails } from "../work/WorkItemModels";
import { StepDocumentLinks, WorkflowTimeline } from "../workflows/WorkflowFields";
import { priorityLabels, taskStatusLabels as statusLabels } from "./taskPolicy";

export function TaskPlanContent({ details, language }: { details: WorkItemDetails; language: string }) {
  const { task, plan } = details;
  const isInheritedPlan = Boolean(plan && plan.ownerWorkItemId !== task.id);
  if (!plan) return <p className="muted">Denne oppgaven har ingen lagret plan.</p>;
  const planContent = <>
    <div className="plan-presentation">{plan.steps.map(step => <section key={step.id}>
      <h4>{step.name}</h4>
      {step.hasTimeline && plan.timelineStartedOn && <WorkflowTimeline language={language} startDate={plan.timelineStartedOn} events={step.timelineEvents ?? []} />}
      <RichTextContent value={step.content} />
      <StepDocumentLinks links={step.links ?? []} editable={false} />
    </section>)}</div>
    {plan.allocations.length > 0 && <><h4>{isInheritedPlan ? "Oppgaver fordelt til denne enheten" : "Oppgavefordeling"}</h4>
      <ul className="plan-allocations">{plan.allocations.map((allocation, index) => <li key={index}><span><strong>{allocation.unitName}</strong><br />{allocation.instruction}</span></li>)}</ul></>}
    {plan.requests.length > 0 && !isInheritedPlan && <><h4>Anmodninger til andre sites</h4><ul className="plan-allocations">{plan.requests.map((request, index) => <li key={index}><span><strong>{request.targetSiteName}</strong><br />{request.instruction}</span></li>)}</ul></>}
    {plan.rfi?.length > 0 && !isInheritedPlan && <section className="planning-rfi-readonly"><h4>RFI · Request for information</h4><div className="planning-rfi-list">{plan.rfi.map(entry => <article className="planning-rfi-row" key={entry.id}><div className="rfi-who"><strong>Hvem</strong><p>{entry.who || "—"}</p></div><div className="rfi-what"><strong>Hva</strong><p>{entry.what || "—"}</p></div><div className="rfi-due"><strong>Frist</strong><p>{entry.dueOn || "—"}</p></div><div className="rfi-answered"><strong>Svart</strong><p>{entry.answered ? "Ja" : "Nei"}</p></div><div className="rfi-answer"><strong>Svar</strong><p>{entry.answer || "—"}</p></div></article>)}</div></section>}
  </>;
  return <>{task.parentWorkItemId && task.description && <section className="delegation-instruction"><h4>Oppgaver i dette deloppdraget</h4><p>{task.description}</p></section>}
    {isInheritedPlan ? <details className="returned-report treatment-history-section"><summary><span>Overordnet plan</span><small>Vis plangrunnlaget ved behov</small></summary><div className="returned-report-content">{planContent}</div></details> : planContent}</>;
}

export function TaskPlanDialog({ details, language, timeZone, onClose }: {
  details: WorkItemDetails;
  language: string;
  timeZone: string;
  onClose: () => void;
}) {
  const { task } = details;
  return <Modal title="Plan" onClose={onClose}>
    <article className="task-detail-view">
      <h3>{task.title}</h3>
      <div className="task-meta">
        <span><strong>Enhet:</strong> {task.unitName ?? "Toppnivå"}</span>
        <span><strong>Status:</strong> {statusLabels[task.status] ?? task.status}</span>
        <span><strong>Prioritet:</strong> {priorityLabels[task.priority] ?? task.priority}</span>
        <span><strong>Frist:</strong> {task.dueAt ? new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone }).format(new Date(task.dueAt)) : "Ingen"}</span>
      </div>
      <TaskPlanContent details={details} language={language} />
    </article>
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Lukk</button></div>
  </Modal>;
}

export function TaskWorkContextDialog({ selectedItem, tree, onClose, onShowPlan }: {
  selectedItem: WorkItem;
  tree: Array<{ item: WorkItem; depth: number }>;
  onClose: () => void;
  onShowPlan: (item: WorkItem) => void;
}) {
  return <Modal title="Hovedoppdrag, underoppdrag og planer" onClose={onClose}>
    <div className="work-context-tree">{tree.map(({ item, depth }) => <article className="delegation-child" key={item.id} style={{ marginLeft: `${Math.min(depth, 6) * 1.25}rem` }}>
      <div>
        <strong>{item.title}</strong>
        {item.id === selectedItem.id && <span className="task-type-badge">Ditt mottatte oppdrag</span>}
        <div className="task-classifiers">
          {item.status !== "registered" && <span className={`task-info-badge task-priority ${item.priority}`}><i aria-hidden="true">◆</i>{priorityLabels[item.priority]}</span>}
          {item.workItemTypeName && <span className="task-info-badge task-type-badge"><i aria-hidden="true">▣</i>{item.workItemTypeName}</span>}
          {item.sourceTypeName && <span className="task-info-badge task-source-badge"><i aria-hidden="true">◈</i>{item.sourceTypeName}</span>}
          {item.senderName && <span className="task-info-badge task-sender-badge"><i aria-hidden="true">●</i>{item.senderName}</span>}
          {item.senderSiteName && <span className="task-info-badge task-source-badge"><i aria-hidden="true">◆</i>Fra {item.senderSiteName}</span>}
          {item.senderPersonName && <span className="task-info-badge task-sender-badge"><i aria-hidden="true">●</i>Sendt av {item.senderPersonName}</span>}
          {item.referenceUrl && <a className="task-info-badge task-document-badge" href={item.referenceUrl} target="_blank" rel="noopener noreferrer"><i aria-hidden="true">▤</i>Hoveddokument</a>}
        </div>
      </div>
      <div className="task-meta"><span>{item.unitName ?? "Toppnivå"}</span><span>{statusLabels[item.status] ?? item.status}</span></div>
      {item.description && <details className="returned-report task-description-section"><summary><span>Beskrivelse</span><small>Vis oppdragsteksten</small></summary><div className="returned-report-content"><p>{item.description}</p></div></details>}
      {item.status === "cancelled" && item.decisionNote && <p className="task-decision-note"><strong>Kansellert:</strong> {item.decisionNote}</p>}
      {item.finalReport && <section className="planning-result"><h4>Sluttrapport</h4><RichTextContent value={item.finalReport} /></section>}
      {item.hasPlan && <div className="task-detail-links"><button className="task-icon-action task-plan-action" type="button" onClick={() => onShowPlan(item)}><i aria-hidden="true">▤</i><span>Vis plan</span></button></div>}
    </article>)}</div>
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Lukk</button></div>
  </Modal>;
}
