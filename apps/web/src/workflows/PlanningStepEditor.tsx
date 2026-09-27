import type { Dispatch, FormEvent, SetStateAction } from "react";
import { ClassificationControls, type ClassificationMarking } from "../components/ClassificationControls";
import { RichTextEditor } from "../components/RichText";
import type { TaskUnit } from "../work/WorkContextModels";
import { PlanningAllocationEditor } from "./PlanningAllocationEditor";
import { PlanningRfiLog } from "./PlanningRfiLog";
import type { PlanAllocation, PlanningDraft, PlanningRun } from "./PlanningModels";
import { StepDocumentLinks, WorkflowTimeline, type StepLink, type TimelineEvent } from "./WorkflowFields";

type Props = {
  run: PlanningRun;
  siteId: string;
  language: string;
  classificationMarkings: ClassificationMarking[];
  units: TaskUnit[];
  stepDrafts: Record<string, string>;
  setStepDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  linkDrafts: Record<string, StepLink[]>;
  setLinkDrafts: Dispatch<SetStateAction<Record<string, StepLink[]>>>;
  timelineDrafts: Record<string, TimelineEvent[]>;
  setTimelineDrafts: Dispatch<SetStateAction<Record<string, TimelineEvent[]>>>;
  plan: PlanningDraft;
  onPlanChange: (update: Partial<PlanningDraft>) => void;
  onAllocationsChange: (allocations: PlanAllocation[]) => void;
  onNavigate: (step: number) => Promise<void>;
  onAddRequest: (stepId: string, targetSiteId: string, targetInstanceId: string, instruction: string) => Promise<void>;
  onRemoveRequest: (requestId: string) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onReload: () => Promise<void>;
  onError: (message: string) => void;
};

export function PlanningStepEditor({
  run,
  siteId,
  language,
  classificationMarkings,
  units,
  stepDrafts,
  setStepDrafts,
  linkDrafts,
  setLinkDrafts,
  timelineDrafts,
  setTimelineDrafts,
  plan,
  onPlanChange,
  onAllocationsChange,
  onNavigate,
  onAddRequest,
  onRemoveRequest,
  onSubmit,
  onReload,
  onError,
}: Props) {
  const step = run.steps[run.currentStep];
  const timelineKey = `${run.id}-${step.id}`;
  const content = stepDrafts[step.id] ?? step.content ?? "";

  return (
    <>
      {run.item.decisionNote && (
        <section className="planning-correction" role="note">
          <strong>Korrigeringer fra leder</strong>
          <p>{run.item.decisionNote}</p>
        </section>
      )}
      <nav className="workflow-step-tabs" aria-label="Plansteg">
        {run.steps.map((candidate, index) => (
          <button
            className={index === run.currentStep ? "current" : ""}
            type="button"
            key={candidate.id}
            onClick={() => void onNavigate(index)}
          >
            {index + 1}. {candidate.name}
          </button>
        ))}
      </nav>
      <section className="workflow-step-editor">
        <h3>{step.name}</h3>
        {step.isOptional && <span className="muted">Valgfritt steg</span>}
        <PlanningRfiLog runId={run.id} entries={run.rfi ?? []} onReload={onReload} onError={onError} />
        {step.hasTimeline && run.timelineStartedOn && (
          <WorkflowTimeline
            language={language}
            startDate={run.timelineStartedOn}
            events={timelineDrafts[timelineKey] ?? step.timelineEvents}
            onChange={(events) =>
              setTimelineDrafts((current) => ({ ...current, [timelineKey]: events }))
            }
          />
        )}
        <div className="field">
          <label>Dokumentasjon og planinnhold</label>
          <span className="muted">Endringer lagres automatisk.</span>
          <RichTextEditor
            value={content}
            onChange={(value) =>
              setStepDrafts((current) => ({ ...current, [step.id]: value }))
            }
          />
          <ClassificationControls
            markings={classificationMarkings}
            value={content}
            onChange={(value) =>
              setStepDrafts((current) => ({ ...current, [step.id]: value }))
            }
          />
        </div>
        <StepDocumentLinks
          links={linkDrafts[step.id] ?? step.links}
          onChange={(links) =>
            setLinkDrafts((current) => ({ ...current, [step.id]: links }))
          }
        />
        {step.allowsTaskAllocation && (
          <PlanningAllocationEditor
            siteId={siteId}
            run={run}
            stepId={step.id}
            units={units}
            allocations={plan.allocations}
            classificationMarkings={classificationMarkings}
            onAllocationsChange={onAllocationsChange}
            onAddRequest={(targetSiteId, targetInstanceId, instruction) =>
              onAddRequest(step.id, targetSiteId, targetInstanceId, instruction)
            }
            onRemoveRequest={onRemoveRequest}
            onError={onError}
          />
        )}
        <div className="workflow-navigation">
          <button
            className="secondary-button"
            type="button"
            disabled={run.currentStep === 0}
            onClick={() => void onNavigate(run.currentStep - 1)}
          >
            Forrige
          </button>
          {run.currentStep < run.steps.length - 1 && (
            <button
              className="primary-button"
              type="button"
              onClick={() => void onNavigate(run.currentStep + 1)}
            >
              Neste steg
            </button>
          )}
        </div>
      </section>
      {run.currentStep === run.steps.length - 1 && (
        <form className="stacked-form planning-result" onSubmit={onSubmit}>
          <div className="field">
            <label>Prioritet</label>
            <select
              value={plan.priority}
              onChange={(event) => onPlanChange({ priority: event.target.value })}
            >
              <option value="low">Lav</option>
              <option value="normal">Normal</option>
              <option value="high">Høy</option>
              <option value="critical">Kritisk</option>
            </select>
          </div>
          <div className="field">
            <label>Foreslått frist</label>
            <input
              type="date"
              value={plan.dueAt}
              onChange={(event) => onPlanChange({ dueAt: event.target.value })}
            />
          </div>
          <button className="primary-button">Send planen til godkjenning</button>
        </form>
      )}
    </>
  );
}
