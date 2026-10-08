import { translateActive } from "../localization";

export async function responseErrorMessage(response: Response, fallback: string) {
  try {
    const problem = (await response.json()) as {
      code?: string;
      error?: string;
      detail?: string;
      title?: string;
      providerStatus?: number;
      correlationId?: string;
      errors?: Record<string, string[]>;
    };
    if (problem.code === "information_locked") return translateActive("lifecycleLockedError");
    if (problem.code === "lifecycle_unfinished_relationships") return translateActive("lifecycleUnfinishedError");
    if (problem.code === "lifecycle_version_conflict") return translateActive("lifecycleVersionError");
    if (problem.code === "lifecycle_transition_conflict") return translateActive("lifecycleTransitionError");
    if (problem.code === "ai_provider_rate_limited") return translateActive("aiProviderRateLimited");
    const correlated = (message: string) => problem.correlationId ? `${message} ${translateActive("correlation", { id: problem.correlationId })}.` : message;
    if (problem.code === "ai_provider_timeout") return correlated(translateActive("aiProviderTimeout"));
    if (problem.code === "ai_provider_unavailable") return correlated(problem.providerStatus ? translateActive("aiProviderHttpStatus", { status: problem.providerStatus }) : translateActive("aiProviderUnavailable"));
    const validationMessage = Object.values(problem.errors ?? {}).flat().find(Boolean);
    return problem.error || validationMessage || problem.detail || problem.title || fallback;
  } catch {
    return fallback;
  }
}

export function errorMessage(problem: unknown, fallback: string) {
  return problem instanceof Error && problem.message ? problem.message : fallback;
}
