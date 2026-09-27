import { useMemo, useState } from "react";
import { apiMutate } from "../api/client";
import type { PlanningRun } from "./PlanningModels";
import type { StepLink, TimelineEvent } from "./WorkflowFields";
import { useSerializedWorkflowSave, useWorkflowAutosave } from "./useWorkflowAutosave";

type UsePlanningStepDraftsOptions = {
  runs: PlanningRun[];
  personId?: string;
  reload: () => Promise<void>;
  onError: (message: string) => void;
};

export function usePlanningStepDrafts({ runs, personId, reload, onError }: UsePlanningStepDraftsOptions) {
  const [stepDrafts, setStepDrafts] = useState<Record<string, string>>({});
  const [linkDrafts, setLinkDrafts] = useState<Record<string, StepLink[]>>({});
  const [timelineDrafts, setTimelineDrafts] = useState<Record<string, TimelineEvent[]>>({});
  const enqueueSave = useSerializedWorkflowSave();

  async function saveStep(runId: string, stepId: string, content: string, links: StepLink[]) {
    const queueKey = `${runId}-${stepId}`;
    await enqueueSave(queueKey, async () => {
      const step = runs.find(run => run.id === runId)?.steps.find(candidate => candidate.id === stepId);
      const timelineEvents = (timelineDrafts[queueKey] ?? step?.timelineEvents ?? [])
        .filter(event => event.date && event.description.trim())
        .map(event => ({ date: event.date, description: event.description }));
      await apiMutate(
        `/api/workflows/planning/${runId}/steps/${stepId}`,
        "PUT",
        { content, links: links.map(link => ({ label: link.label, url: link.url })), timelineEvents },
        "Arbeidsflytsteget kunne ikke lagres.",
      );
      await reload();
    });
  }

  async function saveCurrentStep(run: PlanningRun) {
    const current = run.steps[run.currentStep];
    await saveStep(
      run.id,
      current.id,
      stepDrafts[current.id] ?? current.content ?? "",
      linkDrafts[current.id] ?? current.links,
    );
  }

  const revision = useMemo(() => ({ stepDrafts, linkDrafts, timelineDrafts }), [stepDrafts, linkDrafts, timelineDrafts]);
  const hasChanges = Object.keys(stepDrafts).length > 0 || Object.keys(linkDrafts).length > 0 || Object.keys(timelineDrafts).length > 0;
  useWorkflowAutosave({
    revision,
    enabled: hasChanges,
    fallbackError: "Endringene i arbeidsflytsteget kunne ikke lagres automatisk.",
    onError,
    save: async () => {
      const dirtyStepIds = new Set([...Object.keys(stepDrafts), ...Object.keys(linkDrafts)]);
      const timelineKeys = new Set(Object.keys(timelineDrafts));
      for (const run of runs.filter(value => value.status === "in_progress" && value.claimedByPersonId === personId)) {
        for (const step of run.steps.filter(value => dirtyStepIds.has(value.id) || timelineKeys.has(`${run.id}-${value.id}`))) {
          await saveStep(run.id, step.id, stepDrafts[step.id] ?? step.content ?? "", linkDrafts[step.id] ?? step.links);
        }
      }
    },
  });

  return {
    stepDrafts,
    setStepDrafts,
    linkDrafts,
    setLinkDrafts,
    timelineDrafts,
    setTimelineDrafts,
    saveCurrentStep,
  };
}
