import { translateActive } from "../localization";
import type { Dispatch, SetStateAction } from "react";
import { RichTextEditor } from "../components/RichText";
import type {
  ExecutionDefinition,
  ExecutionItem,
  ExecutionStep,
  ExternalRequestDraft,
  ExternalResponseDraft,
} from "./ExecutionModels";
import { WorkflowTimeline, type TimelineEvent } from "./WorkflowFields";

type Props = {
  item: ExecutionItem;
  language: string;
  definitions: ExecutionDefinition[];
  selectedDefinitions: Record<string, string>;
  setSelectedDefinitions: Dispatch<SetStateAction<Record<string, string>>>;
  drafts: Record<string, string>;
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  timelineDrafts: Record<string, TimelineEvent[]>;
  setTimelineDrafts: Dispatch<SetStateAction<Record<string, TimelineEvent[]>>>;
  externalDraft: ExternalRequestDraft | null;
  setExternalDraft: Dispatch<SetStateAction<ExternalRequestDraft | null>>;
  responseDraft: ExternalResponseDraft | null;
  setResponseDraft: Dispatch<SetStateAction<ExternalResponseDraft | null>>;
  onMutate: (path: string, method?: "POST" | "PUT", body?: object) => Promise<void>;
  onSaveStep: (runId: string, step: ExecutionStep) => Promise<void>;
  onError: (message: string) => void;
  canSendRequest: boolean;
  onSendRequest: (item: ExecutionItem) => void;
};

export function ExecutionWorkflowEditor({
  item,
  language,
  definitions,
  selectedDefinitions,
  setSelectedDefinitions,
  drafts,
  setDrafts,
  timelineDrafts,
  setTimelineDrafts,
  externalDraft,
  setExternalDraft,
  responseDraft,
  setResponseDraft,
  onMutate,
  onSaveStep,
  onError,
  canSendRequest,
  onSendRequest,
}: Props) {
  const run = item.run;
  if (!run) return null;

  if (run.definitionId === null) {
    return (
      <section className="stacked-form planning-result">
        <div className="field">
          <label>{translateActive("workflowsExecutionWorkflowEditorSelectExecutionWorkflow")}</label>
          <select
            value={selectedDefinitions[run.id] ?? ""}
            onChange={(event) =>
              setSelectedDefinitions((current) => ({
                ...current,
                [run.id]: event.target.value,
              }))
            }
          >
            <option value="">{translateActive("workflowsExecutionWorkflowEditorSelectWorkflow")}</option>
            {definitions.map((flow) => (
              <option key={flow.id} value={flow.id}>{flow.name}</option>
            ))}
          </select>
        </div>
        <button
          className="primary-button"
          disabled={!selectedDefinitions[run.id]}
          type="button"
          onClick={() =>
            onMutate(`/api/execution/${run.id}/start`, "POST", {
              definitionId: selectedDefinitions[run.id],
            }).catch((problem) => onError(problem.message))
          }
        >
          {translateActive("workflowsExecutionWorkflowEditorStartWorkflow")}
        </button>
      </section>
    );
  }

  if (run.status !== "in_progress") return null;
  const currentStep = run.steps?.[run.currentStep];
  if (!currentStep) return null;
  const externalFollowUpOpen = externalDraft?.runId === run.id && externalDraft.stepId === currentStep.id;

  const saveAndMove = (path: string, body?: object) =>
    onSaveStep(run.id, currentStep)
      .then(() => onMutate(path, "POST", body))
      .catch((problem) => onError(problem.message));

  return (
    <section className="execution-workflow">
      <div className="task-meta">
        <strong>{run.definitionName}</strong>
        <span>{translateActive("workflowsExecutionWorkflowEditorStep")} {run.currentStep + 1} {translateActive("workflowsExecutionWorkflowEditorOf")} {run.steps?.length}: {currentStep.name}</span>
        <span className="muted">{translateActive("workflowsExecutionWorkflowEditorChangesAreSavedAutomatically")}</span>
      </div>
      {currentStep.hasTimeline && run.timelineStartedOn && (
        <WorkflowTimeline
          language={language}
          startDate={run.timelineStartedOn}
          events={timelineDrafts[currentStep.id] ?? currentStep.timelineEvents ?? []}
          onChange={(events) =>
            setTimelineDrafts((current) => ({ ...current, [currentStep.id]: events }))
          }
        />
      )}
      <RichTextEditor
        value={drafts[currentStep.id] ?? currentStep.content ?? ""}
        onChange={(value) =>
          setDrafts((current) => ({ ...current, [currentStep.id]: value }))
        }
      />
      {(currentStep.externalRequests.length > 0 || externalFollowUpOpen) && <section className="external-requests">
        <h3>{translateActive("entityExternalRequest")}</h3>
        <p className="muted">{translateActive("workflowsExecutionWorkflowEditorRecordDialogueWithAnExternalParty")}</p>
        {currentStep.externalRequests.map((request) => (
          <article className="workflow-definition" key={request.id}>
            <strong>{request.recipient}</strong>
            <p>{request.requestText}</p>
            {request.responseText ? (
              <div><strong>{translateActive("tasksExecutionHistoryReceivedResponse")}</strong><p>{request.responseText}</p></div>
            ) : responseDraft?.id === request.id ? (
              <div className="stacked-form">
                <textarea
                  rows={4}
                  value={responseDraft.text}
                  onChange={(event) => setResponseDraft({ id: request.id, text: event.target.value })}
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    onMutate(`/api/execution/external-requests/${request.id}/response`, "PUT", {
                      responseText: responseDraft.text,
                    }).then(() => setResponseDraft(null)).catch((problem) => onError(problem.message))
                  }
                >
                  {translateActive("workflowsExecutionWorkflowEditorRecordReceivedResponse")}
                </button>
              </div>
            ) : (
              <button className="link-button" type="button" onClick={() => setResponseDraft({ id: request.id, text: "" })}>{translateActive("workflowsExecutionWorkflowEditorRecordResponse")}</button>
            )}
          </article>
        ))}
        {externalFollowUpOpen && (
          <div className="stacked-form">
            <div className="field">
              <label>{translateActive("workflowsExecutionWorkflowEditorExternalPartyOrContact")}</label>
              <input
                maxLength={320}
                value={externalDraft.recipient}
                onChange={(event) => setExternalDraft({ ...externalDraft, recipient: event.target.value })}
              />
            </div>
            <div className="field">
              <label>{translateActive("workflowsExecutionWorkflowEditorDialogueSubject")}</label>
              <textarea
                rows={5}
                maxLength={10000}
                value={externalDraft.requestText}
                onChange={(event) => setExternalDraft({ ...externalDraft, requestText: event.target.value })}
              />
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                onMutate(`/api/execution/${run.id}/external-requests`, "POST", {
                  stepId: currentStep.id,
                  recipient: externalDraft.recipient,
                  requestText: externalDraft.requestText,
                }).then(() => setExternalDraft(null)).catch((problem) => onError(problem.message))
              }
            >
              {translateActive("workflowsExecutionWorkflowEditorRecordExternalDialogue")}
            </button>
            <button className="secondary-button" type="button" onClick={() => setExternalDraft(null)}>
              {translateActive("cancel")}
            </button>
          </div>
        )}
      </section>}
      <div className="step-navigation">
        <button
          className="secondary-button"
          disabled={run.currentStep === 0}
          type="button"
          onClick={() => void saveAndMove(`/api/execution/${run.id}/step`, { step: run.currentStep - 1 })}
        >
          {translateActive("workflowsExecutionWorkflowEditorPreviousStep")}
        </button>
        <button
          className="secondary-button execution-follow-up-button"
          type="button"
          disabled={externalFollowUpOpen}
          onClick={() => setExternalDraft({ runId: run.id, stepId: currentStep.id, recipient: "", requestText: "" })}
        >
          {translateActive("entityExternalRequest")}
        </button>
        {canSendRequest && (
          <button className="secondary-button execution-request-button" type="button" onClick={() => onSendRequest(item)}>
            {translateActive("tasksTaskActionPanelsSendRequest")}
          </button>
        )}
        {run.currentStep < (run.steps?.length ?? 1) - 1 ? (
          <button className="primary-button" type="button" onClick={() => void saveAndMove(`/api/execution/${run.id}/step`, { step: run.currentStep + 1 })}>{translateActive("tasksTaskActionPanelsNextStep")}</button>
        ) : (
          <button className="primary-button" type="button" onClick={() => void saveAndMove(`/api/execution/${run.id}/submit`)}>{translateActive("actionSendForReview")}</button>
        )}
      </div>
    </section>
  );
}
