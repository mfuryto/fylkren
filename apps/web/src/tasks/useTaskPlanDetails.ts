import { useEffect, useState } from "react";
import type { WorkItem, WorkItemDetails } from "../work/WorkItemModels";
import { errorMessage } from "../api/errors";
import { getTaskDetails } from "./taskApi";

export function useTaskPlanDetails(siteId: string, openItemId: string | null, items: WorkItem[], onError: (message: string) => void) {
  const [planDetails, setPlanDetails] = useState<Record<string, WorkItemDetails | null>>({});

  useEffect(() => setPlanDetails({}), [siteId]);
  useEffect(() => {
    const item = items.find(value => value.id === openItemId);
    if (!siteId || !item || item.status !== "planning_approval" || item.id in planDetails) return;
    let active = true;
    getTaskDetails(siteId, item.id).then(value => {
      if (active) setPlanDetails(current => ({ ...current, [item.id]: value }));
    }).catch(problem => {
      if (active) {
        setPlanDetails(current => ({ ...current, [item.id]: null }));
        onError(errorMessage(problem, "The proposed plan could not be loaded."));
      }
    });
    return () => { active = false; };
  }, [siteId, openItemId, items, planDetails, onError]);

  return { planDetails, clearPlanDetails: () => setPlanDetails({}) };
}
