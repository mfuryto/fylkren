import type { TimelineEvent } from "./WorkflowFields";

export type ExecutionStep = {
  id: string;
  name: string;
  sortOrder: number;
  isOptional: boolean;
  hasTimeline: boolean;
  content: string | null;
  timelineEvents: TimelineEvent[];
  externalRequests: Array<{
    id: string;
    recipient: string;
    requestText: string;
    responseText: string | null;
    status: string;
  }>;
};

export type ExecutionRun = {
  id: string;
  definitionId: string | null;
  definitionName: string | null;
  claimedByPersonId: string | null;
  claimedBy: string | null;
  status: string;
  currentStep: number;
  timelineStartedOn: string | null;
  steps: ExecutionStep[] | null;
};

export type ExecutionItem = {
  id: string;
  referenceCode: string;
  originReference: string | null;
  parentWorkItemId: string | null;
  assignedUnitId: string | null;
  assignedUnitName: string | null;
  title: string;
  description: string;
  requestBasisSnapshot: string | null;
  recommendation: string | null;
  referenceUrl: string | null;
  priority: string;
  dueAt: string | null;
  decisionNote: string | null;
  createdBy: string;
  createdAt: string;
  hasPlan: boolean;
  run: ExecutionRun | null;
};

export type ExecutionDefinition = {
  id: string;
  name: string;
  ownerUnitId: string | null;
};

export type ExternalRequestDraft = {
  runId: string;
  stepId: string;
  recipient: string;
  requestText: string;
};

export type ExternalResponseDraft = { id: string; text: string };
