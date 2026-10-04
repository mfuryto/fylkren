import type { MessageKey } from "../localization";

export function executionActivityLabel(action: string | null | undefined, number: number | null | undefined,
  name: string | null | undefined, t: (key: MessageKey) => string): string | null {
  const key = action === "execution.step-documented" ? "auditExecutionStepDocumented"
    : action === "execution.step-changed" ? "auditExecutionStepChanged"
    : action === "execution.external-follow-up-recorded" ? "auditExternalFollowUp"
    : action === "execution.external-response-recorded" ? "auditExternalResponse" : null;
  if (!key) return null;
  const label = t(key);
  return number && name ? `${t("workflowsExecutionWorkflowEditorStep")} ${number}: ${name} – ${label}` : label;
}
