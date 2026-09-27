import { RichTextContent } from "../components/RichText";
import type { PlanningRun } from "./PlanningModels";

export function PlanningTaskPreview({
  item,
  language,
  timeZone,
}: {
  item: PlanningRun["item"];
  language: string;
  timeZone: string;
}) {
  return (
    <div className="planning-preview">
      <div className="task-meta">
        {item.workItemTypeName && <span>Type: {item.workItemTypeName}</span>}
        {item.sourceTypeName && <span>Kilde: {item.sourceTypeName}</span>}
        {item.senderName && <span>Avsender: {item.senderName}</span>}
        <span>Registrert av: {item.createdBy}</span>
        <span>
          Registrert: {new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone }).format(new Date(item.createdAt))}
        </span>
        <span>Prioritet: {item.priority}</span>
        <span>
          Frist: {item.dueAt ? new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone }).format(new Date(item.dueAt)) : "Ingen"}
        </span>
      </div>
      {item.requestBasisSnapshot && (
        <details className="returned-report treatment-history-section">
          <summary><span>Oppdragsgrunnlag fra avsender</span><small>Vis frosset beskrivelse og godkjent plan</small></summary>
          <div className="returned-report-content"><RichTextContent value={item.requestBasisSnapshot} /></div>
        </details>
      )}
      {item.parentDescription && (
        <details className="returned-report task-description-section">
          <summary><span>Hovedoppdragets beskrivelse</span><small>Vis opprinnelig oppdragsgrunnlag</small></summary>
          <div className="returned-report-content"><p>{item.parentDescription}</p></div>
        </details>
      )}
      {item.description && (
        <details className="returned-report task-description-section">
          <summary><span>Oppdrag til dette nivået</span><small>Vis oppdragsteksten</small></summary>
          <div className="returned-report-content"><p>{item.description}</p></div>
        </details>
      )}
      {item.finalReport && (
        <details className="returned-report">
          <summary><span>Tidligere sluttrapport</span><small>{item.finalReportWrittenBy ? `Skrevet av ${item.finalReportWrittenBy}` : "Bevart fra tidligere behandling"}</small></summary>
          <div className="returned-report-content"><RichTextContent value={item.finalReport} /></div>
        </details>
      )}
      {item.decisionNote && (
        <p className="status-message"><strong>Lederens korrigeringer/begrunnelse:</strong> {item.decisionNote}</p>
      )}
      {item.referenceUrl && (
        <a href={item.referenceUrl} target="_blank" rel="noopener noreferrer">Åpne kildelenke ↗</a>
      )}
    </div>
  );
}
