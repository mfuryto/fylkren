export type WorkItemType = {
  id: string;
  name: string;
  isActive: boolean;
  isSystemManaged?: boolean;
  inUse: boolean;
};
export type WorkItem = {
  id: string;
  siteId: string;
  parentWorkItemId: string | null;
  parentTitle: string | null;
  workItemTypeId: string | null;
  workItemTypeName: string | null;
  sourceTypeId: string | null;
  sourceTypeName: string | null;
  senderId: string | null;
  senderName: string | null;
  senderSiteName: string | null;
  senderPersonName: string | null;
  requestBasisSnapshot: string | null;
  isCrossSiteView: boolean;
  title: string;
  description: string;
  recommendation: string | null;
  referenceUrl: string | null;
  priority: string;
  status: string;
  dueAt: string | null;
  assignedUnitId: string | null;
  unitName: string | null;
  isAssignedToMe: boolean;
  hasPlan: boolean;
  workflowCurrentStep: number | null;
  workflowStepCount: number;
  workflowStepName: string | null;
  executionStatus: string | null;
  executionWorkflowName: string | null;
  executionCurrentStep: number | null;
  executionStepCount: number;
  executionStepName: string | null;
  awaitingExternalResponses: number;
  dependencyCount: number;
  isBlocked: boolean;
  blockingDependencyCount: number;
  decisionCount: number;
  decisionNote: string | null;
  finalReport: string | null;
  finalReportClassification: string | null;
  finalReportCreatedAt: string | null;
  finalReportUpdatedAt: string | null;
  finalReportWrittenBy: string | null;
  finalReportApprovedAt: string | null;
  finalReportApprovedBy: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isOutgoingRequest: boolean;
  requestRecipientSiteName: string | null;
  requestRecipientIsExternal: boolean;
  requestProgressStatus: string | null;
  requestResponse: string | null;
};

export type DecisionRevision = {
  id: string;
  revisionNumber: number;
  title: string;
  decision: string;
  rationale: string;
  status: "draft" | "recorded" | "withdrawn" | string;
  decidedAt: string;
  recordedAt: string;
  recordedBy: string;
  decisionMakers: Array<{ personId: string; displayName: string }>;
  references: Array<{ id: string; objectType: string; objectId: string }>;
};

export type DomainDecision = {
  id: string;
  siteId: string;
  createdAt: string;
  current: DecisionRevision;
  revisions: DecisionRevision[];
};

export type WorkItemDependency = {
  id: string;
  type: "finish_to_start" | string;
  predecessorWorkItemId: string;
  predecessorTitle: string;
  predecessorStatus: string;
  isSatisfied: boolean;
  createdAt: string;
};

export type WorkItemDependencyCandidate = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
};

export type WorkItemPlanStep = {
  id: string;
  name: string;
  hasTimeline: boolean;
  content: string | null;
  links: Array<{ id: string; label: string; url: string }>;
  timelineEvents: Array<{ id: string; date: string; description: string }>;
};

export type WorkItemDetails = {
  task: WorkItem;
  plan: null | {
    id: string;
    ownerWorkItemId: string;
    status: string;
    timelineStartedOn: string | null;
    steps: WorkItemPlanStep[];
    allocations: Array<{ unitName: string; instruction: string }>;
    requests: Array<{ targetSiteName: string; instruction: string }>;
    rfi: Array<{ id: string; who: string; what: string; dueOn: string | null; answered: boolean; answer: string }>;
  };
};
