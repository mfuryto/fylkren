import { useMemo, useState } from "react";
import { apiMutate } from "../api/client";
import type { ExecutionItem, ExecutionStep } from "./ExecutionModels";
import type { TimelineEvent } from "./WorkflowFields";
import { useSerializedWorkflowSave, useWorkflowAutosave } from "./useWorkflowAutosave";

type UseExecutionStepDraftsOptions = {
  items: ExecutionItem[];
  personId?: string;
  onError: (message: string) => void;
};

export function useExecutionStepDrafts({ items, personId, onError }: UseExecutionStepDraftsOptions) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [timelineDrafts, setTimelineDrafts] = useState<Record<string, TimelineEvent[]>>({});
  const enqueueSave = useSerializedWorkflowSave();

  async function saveStep(runId: string, step: ExecutionStep) {
    await enqueueSave(`${runId}-${step.id}`, () => apiMutate(
      `/api/execution/${runId}/steps/${step.id}`,
      "PUT",
      {
        content: drafts[step.id] ?? step.content ?? "",
        timelineEvents: (timelineDrafts[step.id] ?? step.timelineEvents ?? [])
          .filter(event => event.date && event.description.trim())
          .map(event => ({ date: event.date, description: event.description })),
      },
      "Utførelsessteget kunne ikke lagres.",
    ));
  }

  const revision = useMemo(() => ({ drafts, timelineDrafts }), [drafts, timelineDrafts]);
  useWorkflowAutosave({
    revision,
    enabled: Object.keys(drafts).length > 0 || Object.keys(timelineDrafts).length > 0,
    fallbackError: "Endringene i utførelsessteget kunne ikke lagres automatisk.",
    onError,
    save: async () => {
      const dirtyStepIds = new Set([...Object.keys(drafts), ...Object.keys(timelineDrafts)]);
      for (const item of items) {
        const run = item.run;
        if (!run || run.claimedByPersonId !== personId || run.status !== "in_progress") continue;
        for (const step of run.steps ?? []) if (dirtyStepIds.has(step.id)) await saveStep(run.id, step);
      }
    },
  });

  return { drafts, setDrafts, timelineDrafts, setTimelineDrafts, saveStep };
}
