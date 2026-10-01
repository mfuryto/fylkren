import { translateActive } from "../localization";
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
        {item.workItemTypeName && <span>{translateActive("taskTypeLabel")}: {item.workItemTypeName}</span>}
        {item.sourceTypeName && <span>{translateActive("workflowsPlanningTaskPreviewSource")} {item.sourceTypeName}</span>}
        {item.senderName && <span>{translateActive("workflowsPlanningTaskPreviewSender")} {item.senderName}</span>}
        <span>{translateActive("tasksTaskCardPresentationRegisteredBy")} {item.createdBy}</span>
        <span>
          {translateActive("workflowsPlanningTaskPreviewRegistered")} {new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone }).format(new Date(item.createdAt))}
        </span>
        <span>{translateActive("tasksTaskContextDialogsPriority")} {item.priority}</span>
        <span>
          {translateActive("tasksTaskCardPresentationDueDate")} {item.dueAt ? new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone }).format(new Date(item.dueAt)) : translateActive("none")}
        </span>
      </div>
      {item.requestBasisSnapshot && (
        <details className="returned-report treatment-history-section">
          <summary><span>{translateActive("tasksTaskCardPresentationTaskBasisFromSender")}</span><small>{translateActive("tasksTaskCardPresentationShowFrozenDescriptionAndApprovedPlan")}</small></summary>
          <div className="returned-report-content"><RichTextContent value={item.requestBasisSnapshot} /></div>
        </details>
      )}
      {item.parentDescription && (
        <details className="returned-report task-description-section">
          <summary><span>{translateActive("workflowsPlanningTaskPreviewPrimaryTaskDescription")}</span><small>{translateActive("workflowsPlanningTaskPreviewShowOriginalTaskBasis")}</small></summary>
          <div className="returned-report-content"><p>{item.parentDescription}</p></div>
        </details>
      )}
      {item.description && (
        <details className="returned-report task-description-section">
          <summary><span>{translateActive("workflowsPlanningTaskPreviewTaskForThisLevel")}</span><small>{translateActive("tasksTaskCardPresentationShowTheTaskText")}</small></summary>
          <div className="returned-report-content"><p>{item.description}</p></div>
        </details>
      )}
      {item.finalReport && (
        <details className="returned-report">
          <summary><span>{translateActive("workflowsPlanningTaskPreviewPreviousFinalReport")}</span><small>{item.finalReportWrittenBy ? `Written by ${item.finalReportWrittenBy}` : translateActive("workflowsPlanningTaskPreviewRetainedFromPreviousProcessing")}</small></summary>
          <div className="returned-report-content"><RichTextContent value={item.finalReport} /></div>
        </details>
      )}
      {item.decisionNote && (
        <p className="status-message"><strong>{translateActive("workflowsPlanningTaskPreviewManagerSCorrectionsRationale")}</strong> {item.decisionNote}</p>
      )}
      {item.referenceUrl && (
        <a href={item.referenceUrl} target="_blank" rel="noopener noreferrer">{translateActive("workflowsExecutionQueueListOpenSourceLink")}</a>
      )}
    </div>
  );
}
