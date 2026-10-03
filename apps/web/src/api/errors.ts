import { translateActive } from "../localization";

export async function responseErrorMessage(response: Response, fallback: string) {
  try {
    const problem = (await response.json()) as {
      code?: string;
      error?: string;
      detail?: string;
      title?: string;
      errors?: Record<string, string[]>;
    };
    if (problem.code === "information_locked") return translateActive("lifecycleLockedError");
    if (problem.code === "lifecycle_unfinished_relationships") return translateActive("lifecycleUnfinishedError");
    if (problem.code === "lifecycle_version_conflict") return translateActive("lifecycleVersionError");
    if (problem.code === "lifecycle_transition_conflict") return translateActive("lifecycleTransitionError");
    const validationMessage = Object.values(problem.errors ?? {}).flat().find(Boolean);
    return problem.error || validationMessage || problem.detail || problem.title || fallback;
  } catch {
    return fallback;
  }
}

export function errorMessage(problem: unknown, fallback: string) {
  return problem instanceof Error && problem.message ? problem.message : fallback;
}
