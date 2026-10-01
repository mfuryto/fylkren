import { Modal } from "../components/Modal";
import { RichTextContent } from "../components/RichText";
import type { PlanningContextDetails } from "./PlanningModels";
import { StepDocumentLinks, WorkflowTimeline } from "./WorkflowFields";

export function PlanningContextModal({
  details,
  language,
  onClose,
}: {
  details: PlanningContextDetails;
  language: string;
  onClose: () => void;
}) {
  return (
    <Modal title="Superior task and plan" onClose={onClose}>
      <article className="task-detail-view">
        <h3>{details.task.title}</h3>
        <p className="document-content">
          {details.task.description || "No description"}
        </p>
        {details.task.referenceUrl && (
          <a href={details.task.referenceUrl} target="_blank" rel="noopener noreferrer">
            Open primary document or task text ↗
          </a>
        )}
        {details.plan ? (
          <>
            <div className="plan-presentation">
              {details.plan.steps.map((step) => (
                <section key={step.id}>
                  <h4>{step.name}</h4>
                  {step.hasTimeline && details.plan?.timelineStartedOn && (
                    <WorkflowTimeline
                      language={language}
                      startDate={details.plan.timelineStartedOn}
                      events={step.timelineEvents}
                    />
                  )}
                  {step.content && <RichTextContent value={step.content} />}
                  <StepDocumentLinks links={step.links} editable={false} />
                </section>
              ))}
            </div>
            {details.plan.allocations.length > 0 && (
              <>
                <h4>Task allocation</h4>
                <ul className="plan-allocations">
                  {details.plan.allocations.map((allocation, index) => (
                    <li key={`${allocation.unitName}-${index}`}>
                      <span><strong>{allocation.unitName}</strong><br />{allocation.instruction}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {details.plan.requests.length > 0 && (
              <>
                <h4>Requests to other sites</h4>
                <ul className="plan-allocations">
                  {details.plan.requests.map((request, index) => (
                    <li key={`${request.targetSiteName}-${index}`}>
                      <span><strong>{request.targetSiteName}</strong><br />{request.instruction}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <p className="muted">The superior task has no saved plan.</p>
        )}
      </article>
      <div className="modal-actions">
        <button className="secondary-button" type="button" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
