export type WorkflowStepSummary = {
  name: string;
  allowsTaskAllocation: boolean;
  hasTimeline: boolean;
  templateId: string | null;
  templateName: string | null;
};

export type WorkflowDefinitionSummary = {
  id: string;
  name: string;
  kind: string;
  isSystem: boolean;
  canEdit: boolean;
  ownerUnitId: string | null;
  ownerUnitName: string | null;
  steps: WorkflowStepSummary[];
};

export type WorkflowTemplateSummary = {
  id: string;
  name: string;
  content: string;
  ownerUnitId: string | null;
  ownerUnitName: string | null;
  canEdit: boolean;
};

export type WorkflowForm = {
  name: string;
  ownerUnitId: string;
  kind: "planning" | "execution";
  steps: string;
  allocationStepName: string;
  timelineStepName: string;
  templateIds: Record<string, string>;
};

export const emptyWorkflowForm = (): WorkflowForm => ({
  name: "",
  ownerUnitId: "",
  kind: "execution",
  steps: "",
  allocationStepName: "",
  timelineStepName: "",
  templateIds: {},
});
