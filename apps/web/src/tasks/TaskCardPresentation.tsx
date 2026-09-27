import { RichTextContent } from "../components/RichText";
import type { WorkItem } from "../work/WorkItemModels";
import { TaskClassifiers } from "./TaskClassifiers";
import { effectiveTaskStatus, isReceivedRequest, requestProgressLabels, taskStatusLabels } from "./taskPolicy";

export function taskCardClassName(item: WorkItem, open: boolean) {
  const variant = item.isOutgoingRequest
    ? "panel task-card request-card request-card-sent"
    : isReceivedRequest(item)
      ? "panel task-card request-card request-card-received"
      : item.parentWorkItemId
        ? "panel task-card delegated-task-card"
        : "panel task-card";
  return `${variant} process-card${open ? "" : " minimized"}`;
}

export function TaskCardHeader({ item, open, language, timeZone, onToggle }: {
  item: WorkItem; open: boolean; language: string; timeZone: string; onToggle: () => void;
}) {
  return <>
    {item.parentWorkItemId && <div className="delegation-parent"><strong>Deloppdrag under:</strong> {item.parentTitle}</div>}
    <div className="task-card-heading"><div><TaskClassifiers item={item} /><h2>{item.title}</h2><div className="task-card-summary-meta">
      <span><strong>Mottatt/registrert:</strong> {new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(item.createdAt))}</span>
      <span><strong>Frist:</strong> {item.dueAt ? new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone }).format(new Date(item.dueAt)) : "Ingen"}</span>
      <span><strong>Registrert av:</strong> {item.createdBy}</span>
    </div></div><div className="task-card-statuses">{item.isBlocked && <span className="task-status blocked">Blokkert</span>}<span className={`task-status ${effectiveTaskStatus(item)}`}>{item.isOutgoingRequest ? requestProgressLabels[item.requestProgressStatus ?? "registered"] ?? "Sendt" : taskStatusLabels[item.status]}</span></div></div>
    <button className="task-card-toggle process-card-toggle" type="button" aria-expanded={open} onClick={onToggle}><i aria-hidden="true">▱</i><span>{open ? "Lukk oppdrag" : "Åpne oppdrag"}</span></button>
  </>;
}

export function TaskBasis({ item, canManage, onShowContext, onShowPlan, onDependencies, onDecisions, onRisks, onVersions }: {
  item: WorkItem; canManage: boolean; onShowContext: () => void; onShowPlan: () => void; onDependencies: () => void; onDecisions: () => void; onRisks: () => void; onVersions: () => void;
}) {
  return <>
    {item.description && <details className="returned-report task-description-section"><summary><span>Beskrivelse</span><small>Vis oppdragsteksten</small></summary><div className="returned-report-content"><p>{item.description}</p></div></details>}
    {item.requestBasisSnapshot && <details className="returned-report treatment-history-section"><summary><span>Oppdragsgrunnlag fra avsender</span><small>Vis frosset beskrivelse og godkjent plan</small></summary><div className="returned-report-content"><RichTextContent value={item.requestBasisSnapshot} /></div></details>}
    {item.isOutgoingRequest && <section className="planning-result"><h3>Anmodning til {item.requestRecipientSiteName ?? "mottakende site"}</h3><p className="status-message"><strong>Status:</strong> {requestProgressLabels[item.requestProgressStatus ?? "registered"] ?? "Sendt"}</p>{item.requestRecipientIsExternal ? <p className="muted">Mottakers interne planlegging, fordeling, utførelse og rapportering er skjermet.</p> : <p className="muted">Intern anmodning i samme site. Oppdragsgrunnlag og tidligere behandling følger sitens ordinære tilgangsregler.</p>}{item.requestResponse && <details className="returned-report treatment-history-section"><summary><span>Sluttrapport fra {item.requestRecipientSiteName ?? "mottaker"}</span><small>{item.requestRecipientIsExternal ? "Vis det godkjente offisielle svaret" : "Vis godkjent svar og intern historikk"}</small></summary><div className="returned-report-content"><RichTextContent value={item.requestResponse} /></div></details>}</section>}
    {item.isBlocked && <p className="status-message dependency-blocked-message"><strong>Blokkert:</strong> {item.blockingDependencyCount === 1 ? "Ett annet oppdrag må fullføres først." : `${item.blockingDependencyCount} andre oppdrag må fullføres først.`}</p>}
    <div className="task-detail-links">{item.parentWorkItemId && <button className="task-icon-action task-context-action" type="button" onClick={onShowContext}><i aria-hidden="true">◎</i><span>Vis hele oppdragsbildet</span></button>}{item.hasPlan && item.status !== "planning_approval" && <button className="task-icon-action task-plan-action" type="button" onClick={onShowPlan}><i aria-hidden="true">▤</i><span>Vis plan</span></button>}{(canManage || item.dependencyCount > 0) && <button className="task-icon-action task-dependency-action" type="button" onClick={onDependencies}><i aria-hidden="true">⛓</i><span>Avhengigheter{item.blockingDependencyCount > 0 ? ` (${item.blockingDependencyCount})` : ""}</span></button>}{(canManage || item.decisionCount > 0) && <button className="task-icon-action task-decision-action" type="button" onClick={onDecisions}><i aria-hidden="true">◆</i><span>Beslutninger{item.decisionCount > 0 ? ` (${item.decisionCount})` : ""}</span></button>}<button className="task-icon-action" type="button" onClick={onRisks}><i aria-hidden="true">▲</i><span>Risiko</span></button><button className="task-icon-action" type="button" onClick={onVersions}><i aria-hidden="true">◫</i><span>Versjoner og godkjenninger</span></button></div>
    {item.parentWorkItemId && <div className="task-meta"><span><strong>Enhet:</strong> {item.unitName ?? "Ikke fordelt"}</span></div>}
  </>;
}
