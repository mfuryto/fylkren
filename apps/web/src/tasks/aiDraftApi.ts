import { apiMutate } from "../api/client";
import { normalizeLanguage, translateActive } from "../localization";

export type RiskAiDraft = { title: string; cause: string; consequence: string; mitigation: string; dueDate: string | null };
export type DecisionAiDraft = { title: string; decision: string; rationale: string };
export type PlanningAiDraft = { stepNumber: number; stepName: string; content: string };

type DraftResponse<T> = { drafts: T[]; generatedAt: string; sourceUpdatedAt: string };

export function requestAiDrafts<T>(siteId: string, itemId: string, feature: "risks" | "decisions", language: string) {
  return apiMutate<DraftResponse<T>>(`/api/ai/sites/${siteId}/work-items/${itemId}/assist`, "POST", {
    feature, language: normalizeLanguage(language), stream: false,
  }, translateActive("aiAssistFailed"));
}

export function requestPlanningDrafts(siteId: string, itemId: string, runId: string, currentStepId: string, language: string) {
  return apiMutate<DraftResponse<PlanningAiDraft>>(`/api/ai/sites/${siteId}/work-items/${itemId}/assist`, "POST", {
    feature: "planning", language: normalizeLanguage(language), stream: false, contextId: runId, targetId: currentStepId,
  }, translateActive("aiAssistFailed"));
}
