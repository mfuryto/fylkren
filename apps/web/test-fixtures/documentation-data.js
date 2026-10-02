// Fictional operational data used only by the documentation preview.
export const context = {
  sites: [{ siteId: "site", name: "Operations Centre", overviewDesign: "classic", hasOperationalAccess: true, hasExecutionAccess: true, hasTopLevelAccess: true, isTopLevelLeader: true, isManager: true, canPlan: true }],
  units: [
    { id: "leadership", siteId: "site", name: "Coordination", parentId: null, isSiteLeadership: true, sortOrder: 0, assignedToMe: true, isLeader: true },
    ...["Planning", "Logistics", "Communications"].map((name, i) => ({ id: name.toLowerCase(), siteId: "site", name, parentId: "leadership", isSiteLeadership: false, sortOrder: i + 1, assignedToMe: true, isLeader: true })),
  ],
};
const makeItem = (id, title, status, unit, day, priority = "normal") => ({
  id, siteId: "site", referenceCode: `OPS-000${id}`, title, status, priority,
  description: "Coordinate the preparedness exercise with local teams. Confirm resources, communication channels and the agreed schedule.",
  assignedUnitId: unit, unitName: context.units.find(value => value.id === unit)?.name ?? null,
  assignedUnitName: context.units.find(value => value.id === unit)?.name ?? null,
  originReference: null, parentWorkItemId: null, parentTitle: null,
  workItemTypeId: "task-type", workItemTypeName: "Assignment", sourceTypeId: null, sourceTypeName: "Coordination meeting", senderId: null, senderName: "Exercise coordinator",
  recommendation: null, referenceUrl: null, isAssignedToMe: true, isOutgoingRequest: false, isCrossSiteView: false,
  hasPlan: status === "planning" || status === "execution", workflowCurrentStep: 1, workflowStepCount: 3, workflowStepName: "Schedule",
  executionStatus: status === "execution" ? "in_progress" : null, executionWorkflowName: "Preparedness exercise", executionCurrentStep: 1, executionStepCount: 3, executionStepName: "Resource checks",
  awaitingExternalResponses: 0, dependencyCount: 0, isBlocked: false, blockingDependencyCount: 0, decisionCount: 0, decisionNote: null,
  finalReport: null, finalReportClassification: null, requestBasisSnapshot: null,
  createdBy: "Exercise coordinator", createdAt: "2026-09-28T09:00:00Z", updatedAt: "2026-10-02T09:00:00Z", dueAt: `2026-10-${String(day).padStart(2, "0")}T15:00:00Z`,
});
export const items = [
  makeItem("101", "Harbor preparedness exercise", "planning", null, 16, "high"),
  makeItem("102", "Confirm transport and equipment", "execution", null, 8, "high"),
  makeItem("103", "Review the communication plan", "registered", null, 5),
  makeItem("104", "Agree the exercise objectives", "assigned", null, 6),
  makeItem("105", "Approve the coordination brief", "in_review", null, 4),
  makeItem("106", "Update the contact directory", "completed", null, 1),
  makeItem("107", "Prepare exercise schedule", "planning", "planning", 9),
  makeItem("108", "Check reserve equipment", "execution", "logistics", 7),
  makeItem("109", "Test radio channels", "execution", "communications", 6),
  makeItem("110", "Confirm support-team availability", "assigned", "logistics", 8),
];
export const timelineEvents = [
  { id: "brief", date: "2026-10-04", description: "Initial briefing" },
  { id: "resources", date: "2026-10-08", description: "Resources ready" },
  { id: "exercise", date: "2026-10-12", description: "Joint exercise" },
  { id: "review", date: "2026-10-16", description: "Review and report" },
];
const step = (id, name, sortOrder, hasTimeline = false) => ({ id, name, sortOrder, hasTimeline, isOptional: false, allowsTaskAllocation: false, content: "## Coordination plan\n\nConfirm resources before the joint exercise. Use a shared briefing and a single contact point for each team. Record decisions and collect observations for the next exercise.", links: [], timelineEvents: hasTimeline ? timelineEvents : [] });
export const planning = {
  id: "plan", status: "in_progress", canManage: true, currentStep: 1, timelineStartedOn: "2026-10-02", claimedByPersonId: "reader", claimedBy: "Planning coordinator",
  proposedUnitId: null, proposedUnit: null, proposedPriority: "high", proposedDueAt: items[0].dueAt, resultNote: null,
  allocations: [], requests: [], rfi: [], ancestors: [], item: items[0],
  steps: [step("basis", "Task basis", 0), step("schedule", "Schedule and milestones", 1, true), step("approval", "Plan for approval", 2)],
};
export const execution = {
  ...items[1], run: { id: "execution", definitionId: "flow", definitionName: "Preparedness exercise", claimedByPersonId: "reader", claimedBy: "Logistics coordinator", status: "in_progress", currentStep: 1, timelineStartedOn: "2026-10-02",
    steps: [step("prepare", "Preparation", 0), { ...step("check", "Resource checks", 1), externalRequests: [], content: "## Resource readiness\n\n- Transport capacity confirmed with the support team.\n- Reserve equipment checked and logged.\n- Final communication check scheduled before the exercise.\n\nThe team is ready for the joint briefing." }, step("complete", "Completion and handover", 2)].map(value => ({ ...value, externalRequests: [] })),
  },
};
export const reports = [
  ["report-one", "OPS-000106", "Update the contact directory", "2026-10-01"],
  ["report-two", "OPS-000098", "Autumn communication exercise", "2026-09-25"],
  ["report-three", "OPS-000091", "Equipment readiness review", "2026-09-18"],
  ["report-four", "OPS-000084", "Coordination briefing", "2026-09-11"],
].map(([id, referenceCode, title, date]) => ({
  id, referenceCode, title, originReference: null, siteName: "Operations Centre", organizationPath: ["Coordination"],
  finalReport: "# Summary\n\nThe agreed work has been completed and verified with the participating teams.\n\n## Results\n\n- Contact details reviewed with all three teams.\n- Shared directory updated and made available.\n- Ownership and the next review date confirmed.\n\n## Follow-up\n\nThe coordination team will review the directory before the next exercise.",
  finalReportClassification: null, reportCreatedAt: `${date}T10:00:00Z`, workReceivedAt: "2026-09-08T09:00:00Z", workCompletedAt: `${date}T09:00:00Z`, writtenBy: "Exercise coordinator", approvedBy: "Duty leader", finalReportApprovedAt: `${date}T11:00:00Z`,
}));
