import type { StepLink, TimelineEvent } from "./WorkflowFields";

export type PlanAllocation = {
  stepId: string;
  unitId: string;
  unitName?: string;
  stepName?: string;
  instruction: string;
};

export type PlanningDraft = {
  priority: string;
  dueAt: string;
  allocations: PlanAllocation[];
};

export type PlanRequest = {
  id: string;
  stepId: string;
  stepName?: string;
  targetSiteId: string;
  targetSiteName: string;
  instruction: string;
};

export type PlanningRfiEntry = {
  id: string;
  who: string;
  what: string;
  dueOn: string | null;
  answered: boolean;
  answer: string;
  createdAt: string;
  updatedAt: string;
};

export type PlanningContextDetails = {
  task: {
    id: string;
    title: string;
    description: string;
    referenceUrl: string | null;
  };
  plan: null | {
    id: string;
    status: string;
    proposedPriority: string | null;
    proposedDueAt: string | null;
    timelineStartedOn: string | null;
    steps: Array<{
      id: string;
      name: string;
      hasTimeline: boolean;
      content: string | null;
      links: StepLink[];
      timelineEvents: TimelineEvent[];
    }>;
    allocations: Array<{
      stepName: string;
      unitName: string;
      instruction: string;
    }>;
    requests: Array<{
      stepName: string;
      targetSiteName: string;
      instruction: string;
    }>;
  };
};

export type PlanningRun = {
  id: string;
  status: string;
  canManage: boolean;
  currentStep: number;
  timelineStartedOn: string | null;
  claimedByPersonId: string | null;
  claimedBy: string | null;
  proposedUnitId: string | null;
  proposedUnit: string | null;
  proposedPriority: string | null;
  proposedDueAt: string | null;
  resultNote: string | null;
  allocations: PlanAllocation[];
  requests: PlanRequest[];
  rfi: PlanningRfiEntry[];
  ancestors: Array<{ id: string; title: string; distance: number }>;
  item: {
    id: string;
    referenceCode: string;
    originReference: string | null;
    parentWorkItemId: string | null;
    parentTitle: string | null;
    parentDescription: string | null;
    assignedUnitId: string | null;
    assignedUnitName: string | null;
    title: string;
    description: string;
    referenceUrl: string | null;
    workItemTypeName: string | null;
    sourceTypeName: string | null;
    senderName: string | null;
    requestBasisSnapshot: string | null;
    priority: string;
    dueAt: string | null;
    decisionNote: string | null;
    finalReport: string | null;
    finalReportWrittenBy: string | null;
    finalReportUpdatedAt: string | null;
    createdBy: string;
    createdAt: string;
  };
  steps: Array<{
    id: string;
    name: string;
    sortOrder: number;
    isOptional: boolean;
    allowsTaskAllocation: boolean;
    hasTimeline: boolean;
    content: string | null;
    links: StepLink[];
    timelineEvents: TimelineEvent[];
  }>;
};
