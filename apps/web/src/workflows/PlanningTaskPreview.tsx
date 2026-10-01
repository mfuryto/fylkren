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
        {item.senderName && <span>Sender: {item.senderName}</span>}
        <span>Registered av: {item.createdBy}</span>
        <span>
          Registered: {new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone }).format(new Date(item.createdAt))}
        </span>
        <span>Prioritet: {item.priority}</span>
        <span>
          Due date: {item.dueAt ? new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone }).format(new Date(item.dueAt)) : "None"}
        </span>
      </div>
      {item.requestBasisSnapshot && (
        <details className="returned-report treatment-history-section">
          <summary><span>Task basis from sender</span><small>Show frozen description and approved plan</small></summary>
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
          <summary><span>Task for this level</span><small>Show the task text</small></summary>
          <div className="returned-report-content"><p>{item.description}</p></div>
        </details>
      )}
      {item.finalReport && (
        <details className="returned-report">
          <summary><span>Previous final report</span><small>{item.finalReportWrittenBy ? `Written by ${item.finalReportWrittenBy}` : "Retained from previous processing"}</small></summary>
          <div className="returned-report-content"><RichTextContent value={item.finalReport} /></div>
        </details>
      )}
      {item.decisionNote && (
        <p className="status-message"><strong>Manager's corrections/rationale:</strong> {item.decisionNote}</p>
      )}
      {item.referenceUrl && (
        <a href={item.referenceUrl} target="_blank" rel="noopener noreferrer">Open source link ↗</a>
      )}
    </div>
  );
}
