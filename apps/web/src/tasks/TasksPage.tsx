import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { ClassificationControls as ClassificationControlFields, type ClassificationMarking } from "../components/ClassificationControls";
import type { WorkItem, WorkItemDependencyCandidate, WorkItemDetails } from "../work/WorkItemModels";
import { useRequestRecipientSearch } from "../work/useRequestRecipientSearch";
import { TaskReportDocument } from "./TaskReportDocument";
import { TaskCreateDialog, emptyTaskCreateDraft, type TaskCreateDraft } from "./TaskCreateDialog";
import { TaskPlanDialog, TaskWorkContextDialog } from "./TaskContextDialogs";
import { PlanDecisionDialog, ReviewDecisionDialog, TaskDecisionDialog, type PlanDecision } from "./TaskDecisionDialogs";
import type { ChildHistory } from "./TaskDelegationTree";
import { TaskFinalReportDialog, type FinalReportEditor } from "./TaskFinalReportDialog";
import { TaskLookupManagerDialog, TaskTypeManagerDialog, type TaskLookupDraft } from "./TaskLookupDialogs";
import { TaskPageHeader } from "./TaskPageHeader";
import { TaskQueueControls } from "./TaskQueueControls";
import { TaskQueueList } from "./TaskQueueList";
import { TaskDelegationDialog, TaskReassignmentDialog, TaskSideRequestDialog, type TaskDelegationDraft, type TaskReassignmentDraft, type TaskSideRequestDraft } from "./TaskRoutingDialogs";
import { TaskDependencyDialog } from "./TaskDependencyDialog";
import { TaskHoldDependencySection } from "./TaskHoldDependencySection";
import { TaskDomainDecisionDialog, type DomainDecisionDraft } from "./TaskDomainDecisionDialog";
import { TaskRiskDialog } from "./TaskRiskDialog";
import { TaskVersionDialog } from "./TaskVersionDialog";
import { addHoldDependencies, approvedPlanRunId, getExecutionHistory, getFinalReportTemplate, getTaskDetails, taskCreatePayload, taskMutation } from "./taskApi";
import { buildReportUnitPath, buildWorkContextTree } from "./taskHierarchy";
import { canSendSideRequestAtStatus, effectiveTaskStatus as effectiveStatus, getTaskNextActions, hasActiveDirectChildren as hasActiveChildren, rootWorkTitle, workflowProgress } from "./taskPolicy";
import { selectScopedItems } from "./taskQueue";
import { buildTaskScope } from "./taskScope";
import { useTaskData } from "./useTaskData";
import { useTaskPlanDetails } from "./useTaskPlanDetails";
import { copyPermalink, navigateToLocation, type AppLocation } from "../navigation/permalinks";
import { errorMessage } from "../api/errors";

export function TasksPage({ personId, language: displayLanguage, timeZone: displayTimeZone, classificationMarkings, permalink }: { personId?: string; language: string; timeZone: string; classificationMarkings: ClassificationMarking[]; permalink: AppLocation }) {
  function ClassificationControls({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    return <ClassificationControlFields value={value} onChange={onChange} markings={classificationMarkings} />;
  }
  const [helpOpen, setHelpOpen] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [queuePage, setQueuePage] = useState(1);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [form, setForm] = useState<TaskCreateDraft>(emptyTaskCreateDraft);
  const [requestRecipientQuery, setRequestRecipientQuery] = useState("");
  const [sideRequest, setSideRequest] = useState<TaskSideRequestDraft | null>(null);
  const [sideRequestRecipientQuery, setSideRequestRecipientQuery] = useState("");
  const [typeManagerOpen, setTypeManagerOpen] = useState(false);
  const [lookupManager, setLookupManager] = useState<"source-type" | "sender" | null>(null);
  const [delegation, setDelegation] = useState<TaskDelegationDraft | null>(null);
  const [reassignment, setReassignment] = useState<TaskReassignmentDraft | null>(null);
  const [details, setDetails] = useState<{ data: WorkItemDetails } | null>(null);
  const [workContextItem, setWorkContextItem] = useState<WorkItem | null>(null);
  const [dependencyItem, setDependencyItem] = useState<WorkItem | null>(null);
  const [domainDecisionItem, setDomainDecisionItem] = useState<WorkItem | null>(null);
  const [riskItem, setRiskItem] = useState<WorkItem | null>(null);
  const [versionItem, setVersionItem] = useState<WorkItem | null>(null);
  const [childHistory, setChildHistory] = useState<Record<string, ChildHistory>>({});
  const [typeForm, setTypeForm] = useState<TaskLookupDraft>({
    id: "",
    name: "",
    isActive: true,
  });
  const [lookupForm, setLookupForm] = useState<TaskLookupDraft>({ id: "", name: "", isActive: true });
  const [decision, setDecision] = useState<{
    item: WorkItem;
    status: "assigned" | "on_hold" | "rejected" | "cancelled";
  } | null>(null);
  const [decisionUnitId, setDecisionUnitId] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionDependencies, setDecisionDependencies] = useState<WorkItemDependencyCandidate[]>([]);
  const [reviewDecision, setReviewDecision] = useState<{ item: WorkItem; priority: string } | null>(null);
  const [planDecision, setPlanDecision] = useState<PlanDecision | null>(null);
  const [reportEditor, setReportEditor] = useState<FinalReportEditor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [linkMessage, setLinkMessage] = useState("");
  const { sites, taskUnits, items, itemTotal, itemPage, itemSummary, types, sourceTypes, senders, selectedSiteId, setSelectedSiteId, loadItems, loadTypes, loadLookups } = useTaskData(setError, personId, permalink.siteId, { unitId: selectedUnitId, filter, search: appliedSearch, page: queuePage, focusItemId: permalink.itemId });
  const { planDetails, clearPlanDetails } = useTaskPlanDetails(selectedSiteId, openItemId, items, setError);
  useEffect(() => { const timer = window.setTimeout(() => setAppliedSearch(search.trim()), 250); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => { if (itemPage !== queuePage) setQueuePage(itemPage); }, [itemPage, queuePage]);
  useEffect(() => {
    setSelectedUnitId("");
  }, [selectedSiteId]);
  const selectedSite = sites.find((site) => site.siteId === selectedSiteId);
  const requestTypeSelected = types.some((type) => type.id === form.workItemTypeId && type.isSystemManaged);
  const [requestRecipients, setRequestRecipients] = useRequestRecipientSearch({
    siteId: selectedSiteId,
    sourceUnitId: selectedUnitId,
    query: requestRecipientQuery,
    enabled: requestTypeSelected,
    recipientSelected: Boolean(form.targetSiteId || form.targetUnitId),
    onError: setError,
  });
  const [sideRequestRecipients, setSideRequestRecipients] = useRequestRecipientSearch({
    siteId: selectedSiteId,
    sourceUnitId: sideRequest?.item.assignedUnitId,
    query: sideRequestRecipientQuery,
    enabled: Boolean(sideRequest),
    recipientSelected: Boolean(sideRequest?.targetSiteId || sideRequest?.targetUnitId),
    onError: setError,
  });
  const { availableUnits, selectableUnits, canManageScope, taskLevelCount, siteLeadershipUnitId, directChildUnits } = useMemo(
    () => buildTaskScope(taskUnits, selectedSiteId, selectedUnitId, selectedSite),
    [taskUnits, selectedSiteId, selectedUnitId, selectedSite],
  );
  useEffect(() => {
    if (selectedSite && !selectedSite.hasTopLevelAccess && !selectedUnitId)
      setSelectedUnitId(selectableUnits[0]?.id ?? "");
  }, [selectedSiteId, selectedSite?.hasTopLevelAccess, taskUnits.length]);
  useEffect(() => {
    setDecisionUnitId(directChildUnits[0]?.id ?? "");
  }, [selectedSiteId, selectedUnitId, taskUnits.length]);
  useEffect(() => {
    if (!permalink.itemId) return;
    setFilter(permalink.taskFilter ?? "all");
    setSearch(permalink.taskSearch ?? "");
    if (permalink.unitId) setSelectedUnitId(permalink.unitId);
    setQueuePage(1);
  }, [permalink.itemId, permalink.unitId, permalink.taskFilter, permalink.taskSearch]);
  useEffect(() => {
    if (!permalink.itemId || !items.length) return;
    const target = items.find(item => item.id === permalink.itemId);
    if (!target) { setError("Oppdraget finnes ikke, eller du har ikke tilgang til det."); return; }
    let root = target;
    while (root.parentWorkItemId) {
      const parent = items.find(item => item.id === root.parentWorkItemId);
      if (!parent) break;
      root = parent;
    }
    setSelectedUnitId(permalink.unitId ?? root.assignedUnitId ?? "");
  }, [permalink.itemId, permalink.unitId, permalink.taskFilter, permalink.taskSearch, items]);

  async function executeTaskCommand({ path, method, body, fallback, onSuccess, refresh }: {
    path: string;
    method: "POST" | "PUT" | "DELETE";
    body?: object;
    fallback: string;
    onSuccess?: () => void;
    refresh?: () => Promise<void>;
  }) {
    setBusy(true);
    setError("");
    try {
      await taskMutation(path, method, body, fallback);
      onSuccess?.();
      await refresh?.();
      return true;
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : fallback);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createItem(event: React.FormEvent) {
    event.preventDefault();
    await executeTaskCommand({
      path: `/api/work/sites/${selectedSiteId}/items`, method: "POST", body: taskCreatePayload(form, selectedUnitId), fallback: "Oppgaven kunne ikke registreres.",
      onSuccess: () => { setForm(emptyTaskCreateDraft()); setRequestRecipientQuery(""); setRequestRecipients([]); setCreatorOpen(false); },
      refresh: () => loadItems(selectedSiteId),
    });
  }
  async function saveType(event: React.FormEvent) {
    event.preventDefault();
    await executeTaskCommand({ path: `/api/work/sites/${selectedSiteId}/types${typeForm.id ? `/${typeForm.id}` : ""}`, method: typeForm.id ? "PUT" : "POST", body: { name: typeForm.name, isActive: typeForm.isActive }, fallback: "Oppgavetypen kunne ikke lagres.", onSuccess: () => setTypeForm({ id: "", name: "", isActive: true }), refresh: () => loadTypes(selectedSiteId) });
  }
  async function saveLookup(event: React.FormEvent) {
    event.preventDefault(); if (!lookupManager) return;
    await executeTaskCommand({ path: `/api/work/sites/${selectedSiteId}/lookups/${lookupManager}${lookupForm.id ? `/${lookupForm.id}` : ""}`, method: lookupForm.id ? "PUT" : "POST", body: { name: lookupForm.name, isActive: lookupForm.isActive }, fallback: "Verdien kunne ikke lagres.", onSuccess: () => setLookupForm({ id: "", name: "", isActive: true }), refresh: () => loadLookups(selectedSiteId) });
  }
  async function delegateItem(event: React.FormEvent) {
    event.preventDefault();
    if (!delegation) return;
    await executeTaskCommand({ path: `/api/work/sites/${selectedSiteId}/items/${delegation.item.id}/delegate`, method: "POST", body: { assignedUnitId: delegation.assignedUnitId, instruction: delegation.instruction }, fallback: "Oppgaven kunne ikke fordeles videre.", onSuccess: () => setDelegation(null), refresh: () => loadItems(selectedSiteId) });
  }
  async function sendSideRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!sideRequest) return;
    await executeTaskCommand({ path: `/api/work/sites/${selectedSiteId}/items/${sideRequest.item.id}/request`, method: "POST", body: { targetSiteId: sideRequest.targetSiteId || null, targetInstanceId: sideRequest.targetInstanceId || null, targetUnitId: sideRequest.targetUnitId || null, title: sideRequest.title, description: sideRequest.description }, fallback: "Anmodningen kunne ikke sendes.", onSuccess: () => { setSideRequest(null); setSideRequestRecipientQuery(""); setSideRequestRecipients([]); }, refresh: () => loadItems(selectedSiteId) });
  }
  async function reassignItem(event: React.FormEvent) {
    event.preventDefault();
    if (!reassignment) return;
    await executeTaskCommand({ path: `/api/work/sites/${selectedSiteId}/items/${reassignment.item.id}/reassign`, method: "POST", body: { assignedUnitId: reassignment.assignedUnitId }, fallback: "Oppdraget kunne ikke omfordeles.", onSuccess: () => setReassignment(null), refresh: () => loadItems(selectedSiteId) });
  }
  async function showPlan(item: WorkItem) {
    setError("");
    try {
      setDetails({ data: await getTaskDetails(selectedSiteId, item.id) });
    } catch (problem) {
      setError(errorMessage(problem,"Planen kunne ikke lastes."));
    }
  }
  async function loadChildHistory(item: WorkItem) {
    if (childHistory[item.id]?.loaded || childHistory[item.id]?.loading) return;
    setChildHistory((current) => ({ ...current, [item.id]: { details: null, execution: null, loading: true, loaded: false } }));
    const [detailsData, executionData] = await Promise.all([
      getTaskDetails(selectedSiteId, item.id).catch(() => null),
      getExecutionHistory(item.id).catch(() => null),
    ]);
    setChildHistory((current) => ({ ...current, [item.id]: { details: detailsData, execution: executionData, loading: false, loaded: true } }));
  }
  function toggleItem(itemId: string) {
    setOpenItemId((current) => current === itemId ? null : itemId);
  }
  async function changeStatus(
    item: WorkItem,
    status: string,
    assignedUnitId?: string,
    decisionNote?: string,
    priority?: string,
  ) {
    return executeTaskCommand({ path: `/api/work/sites/${selectedSiteId}/items/${item.id}/status`, method: "PUT", body: { status, assignedUnitId: assignedUnitId || null, decisionNote: decisionNote || null, priority: priority || null }, fallback: "Statusen kunne ikke endres.", refresh: () => loadItems(selectedSiteId) });
  }
  async function decidePlan(runId: string, action: "approve" | "replan" | "hold" | "reject", note: string | null) {
    await executeTaskCommand({ path: `/api/workflows/planning/${runId}/decision`, method: "POST", body: { action, note }, fallback: "Planbeslutningen kunne ikke lagres.", onSuccess: () => { setPlanDecision(null); setDetails(null); clearPlanDetails(); }, refresh: () => loadItems(selectedSiteId) });
  }
  async function planDecisionForItem(item: WorkItem, action: "approve" | "replan" | "hold" | "reject") {
    try {
      const plan = planDetails[item.id]?.plan ?? (await getTaskDetails(selectedSiteId, item.id)).plan;
      if (!plan) { setError("Planforslaget finnes ikke lenger."); return; }
      if (action === "approve") { await decidePlan(plan.id, action, null); return; }
      setPlanDecision({ runId: plan.id, item, action, note: "" });
      setDecisionDependencies([]);
    } catch (problem) { setError(errorMessage(problem, "Planforslaget kunne ikke lastes.")); }
  }
  async function releaseApprovedPlan(item: WorkItem) {
    try {
      const runId = await approvedPlanRunId(selectedSiteId, item.id);
      await executeTaskCommand({ path: `/api/workflows/planning/${runId}/decision`, method: "POST", body: { action: "release" }, fallback: "Den godkjente planen kunne ikke iverksettes.", refresh: () => loadItems(selectedSiteId) });
    } catch (problem) { setError(errorMessage(problem, "Den godkjente planen kunne ikke iverksettes.")); }
  }
  const toggleDecisionDependency = (candidate: WorkItemDependencyCandidate) => setDecisionDependencies(current => current.some(value => value.id === candidate.id) ? current.filter(value => value.id !== candidate.id) : [...current, candidate]);
  async function saveHoldDependencies(item: WorkItem) {
    try { await addHoldDependencies(selectedSiteId, item.id, decisionDependencies.map(value => value.id)); return true; }
    catch (problem) { setError(errorMessage(problem, "Avhengighetene kunne ikke legges til.")); return false; }
  }
  async function cancelWorkChain(item: WorkItem, decisionNote: string) {
    await executeTaskCommand({ path: `/api/work/sites/${selectedSiteId}/items/${item.id}/cancel`, method: "POST", body: { decisionNote }, fallback: "Oppdragskjeden kunne ikke kanselleres.", refresh: () => loadItems(selectedSiteId) });
  }
  async function saveFinalReport(event: React.FormEvent) {
    event.preventDefault();
    if (!reportEditor) return;
    await executeTaskCommand({ path: `/api/work/sites/${selectedSiteId}/items/${reportEditor.item.id}/final-report`, method: "PUT", body: { content: reportEditor.content, classification: reportEditor.classification || null }, fallback: "Sluttrapporten kunne ikke lagres.", onSuccess: () => setReportEditor(null), refresh: () => loadItems(selectedSiteId) });
  }
  async function approveFinalReport(item: WorkItem) {
    await executeTaskCommand({ path: `/api/work/sites/${selectedSiteId}/items/${item.id}/final-report/approve`, method: "POST", fallback: "Sluttrapporten kunne ikke godkjennes.", refresh: () => loadItems(selectedSiteId) });
  }
  async function addDependency(item: WorkItem, predecessorWorkItemId: string) {
    return executeTaskCommand({ path: `/api/work/sites/${selectedSiteId}/items/${item.id}/dependencies`, method: "POST", body: { predecessorWorkItemId, type: "finish_to_start" }, fallback: "Avhengigheten kunne ikke legges til.", refresh: () => loadItems(selectedSiteId) });
  }
  async function removeDependency(item: WorkItem, dependencyId: string) {
    return executeTaskCommand({ path: `/api/work/sites/${selectedSiteId}/items/${item.id}/dependencies/${dependencyId}`, method: "DELETE", fallback: "Avhengigheten kunne ikke fjernes.", refresh: () => loadItems(selectedSiteId) });
  }
  async function recordDomainDecision(item: WorkItem, draft: DomainDecisionDraft) {
    return executeTaskCommand({ path: `/api/decisions/sites/${selectedSiteId}/tasks/${item.id}`, method: "POST", body: { ...draft, decidedAt: new Date().toISOString(), decisionMakerIds: personId ? [personId] : [], references: [] }, fallback: "Beslutningen kunne ikke registreres.", refresh: () => loadItems(selectedSiteId) });
  }
  async function openFinalReport(item: WorkItem) {
    const savedReport = item.finalReport?.trim() ? item.finalReport : null;
    setReportEditor({ item, content: savedReport ?? "", classification: item.finalReportClassification ?? "", executionHistory: null, historyLoading: true });
    const [executionHistory, template] = await Promise.all([
      getExecutionHistory(item.id).catch(() => null),
      getFinalReportTemplate(selectedSiteId).catch(() => null),
    ]);
    setReportEditor((current) => current?.item.id === item.id ? {
      ...current,
      content: savedReport ?? (current.content.trim() ? current.content : template?.content ?? ""),
      executionHistory,
      historyLoading: false,
    } : current);
  }
  const reportDate = (value: string | null) => value ? new Date(value).toLocaleDateString(displayLanguage, { timeZone: displayTimeZone }) : "Ikke registrert";
  const reportMarking = (item: WorkItem) => classificationMarkings.find((marking) => marking.abbreviation === item.finalReportClassification);
  const structuredReport = (item: WorkItem, reportSiteName = selectedSite?.name) => (
    <TaskReportDocument item={item} siteName={reportSiteName} unitPath={buildReportUnitPath(taskUnits, selectedSiteId, item.assignedUnitId)} rootTitle={rootWorkTitle(item, items)} marking={reportMarking(item)} language={displayLanguage} timeZone={displayTimeZone} />
  );
  const topLevelVisibleItems = useMemo(() => selectScopedItems(items, selectedUnitId), [items, selectedUnitId]);
  useEffect(() => { setQueuePage(1); setOpenItemId(null); }, [selectedSiteId, selectedUnitId, filter, appliedSearch]);
  useEffect(() => {
    if (!permalink.itemId || !items.length) return;
    const target = items.find(item => item.id === permalink.itemId);
    if (!target) return;
    let root = target;
    while (root.parentWorkItemId) {
      const parent = items.find(item => item.id === root.parentWorkItemId);
      if (!parent) break;
      root = parent;
    }
    setOpenItemId(root.id);
  }, [permalink.itemId, items, topLevelVisibleItems]);
  const isOperationalInScope = (item: WorkItem) =>
    item.assignedUnitId
      ? Boolean(availableUnits.find((unit) => unit.id === item.assignedUnitId)?.assignedToMe)
      : Boolean(selectedSite?.hasTopLevelAccess);
  const isLeaderForItem = (item: WorkItem) => item.assignedUnitId
      ? Boolean(availableUnits.find((unit) => unit.id === item.assignedUnitId)?.isLeader)
      : Boolean(selectedSite?.isTopLevelLeader);
  const canManageItem = (item: WorkItem) => !item.isOutgoingRequest && !item.isCrossSiteView && isLeaderForItem(item);
  const childUnitsForItem = (item: WorkItem) => {
    if (item.assignedUnitId) return availableUnits.filter((unit) => unit.parentId === item.assignedUnitId);
    return availableUnits.filter((unit) => !unit.isSiteLeadership && (unit.parentId === null || unit.parentId === siteLeadershipUnitId));
  };
  const hasActiveDirectChildren = (item: WorkItem) => hasActiveChildren(item, items);
  const canDelegateItem = (item: WorkItem) =>
    canManageItem(item) &&
    !item.isBlocked &&
    childUnitsForItem(item).length > 0 &&
    ["assigned", "in_progress"].includes(item.status) &&
    !hasActiveDirectChildren(item);
  const canSendSideRequest = (item: WorkItem) => canManageItem(item) && !item.isBlocked && !item.isOutgoingRequest && !hasActiveDirectChildren(item) && canSendSideRequestAtStatus(item.status);
  const workContextTree = useMemo(
    () => workContextItem ? buildWorkContextTree(workContextItem, items) : [],
    [workContextItem, items],
  );
  const nextActions = (item: WorkItem) => getTaskNextActions(item, items, {
    isLeader: isLeaderForItem(item),
    isOperational: isOperationalInScope(item),
    canManage: canManageItem(item),
  });
  const canReassignChild = (item: WorkItem) =>
    canManageScope &&
    !item.isBlocked &&
    !["completed", "cancelled", "reassigned"].includes(item.status) &&
    directChildUnits.length > 0;
  const childActionCount = (item: WorkItem) =>
    Number(canReassignChild(item)) + nextActions(item).length;
  const pendingChildNames = (item: WorkItem) =>
    items
      .filter((child) => child.parentWorkItemId === item.id && !["completed", "reassigned", "cancelled"].includes(child.status))
      .map((child) => child.unitName ?? child.title);
  return (
    <div className="page">
      <TaskPageHeader
        helpOpen={helpOpen}
        isSiteManager={Boolean(selectedSite?.isSiteManager)}
        canCreate={Boolean(canManageScope || (!selectedUnitId && selectedSite?.hasTopLevelAccess))}
        onHelpOpen={() => setHelpOpen(true)}
        onHelpClose={() => setHelpOpen(false)}
        onTypeManagerOpen={() => setTypeManagerOpen(true)}
        onSourceTypeManagerOpen={() => { setLookupManager("source-type"); setLookupForm({ id: "", name: "", isActive: true }); }}
        onSenderManagerOpen={() => { setLookupManager("sender"); setLookupForm({ id: "", name: "", isActive: true }); }}
        onCreate={() => setCreatorOpen(true)}
      />
      {error && (
        <p className="status-message error-message" role="alert">
          {error}
        </p>
      )}
      {linkMessage && <p className="status-message" role="status">{linkMessage}</p>}
      {sites.length === 0 ? (
        <section className="panel empty-state">
          <div>
            <h2>Ingen tilgjengelige sites</h2>
            <p className="muted">
              Du må være aktivt medlem av en site før du kan se oppgaver.
            </p>
          </div>
        </section>
      ) : (
        <>
          <TaskQueueControls sites={sites} selectedSite={selectedSite} selectedSiteId={selectedSiteId} setSelectedSiteId={setSelectedSiteId} selectedUnitId={selectedUnitId} setSelectedUnitId={setSelectedUnitId} selectableUnits={selectableUnits} taskLevelCount={taskLevelCount} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} summary={itemSummary} />
          <TaskQueueList
            items={items} visibleItems={topLevelVisibleItems} totalItems={itemTotal} page={queuePage}
            openItemId={openItemId} language={displayLanguage} timeZone={displayTimeZone} busy={busy} history={childHistory} planDetails={planDetails}
            canManage={canManageItem} childUnits={childUnitsForItem} nextActions={nextActions} canDelegate={canDelegateItem}
            canSendRequest={canSendSideRequest} pendingChildren={pendingChildNames} canReassign={canReassignChild}
            childActionCount={childActionCount} canCancel={item => item.isOutgoingRequest ? isLeaderForItem(item) : !item.parentWorkItemId && Boolean(selectedSite?.canCancelWork)}
            onToggle={itemId => {
              const opening = openItemId !== itemId;
              toggleItem(itemId);
              navigateToLocation({
                page: "Tasks",
                siteId: selectedSiteId,
                unitId: selectedUnitId || undefined,
                itemId: opening ? itemId : undefined,
                taskFilter: filter,
                taskSearch: search || undefined,
              });
            }}
            onCopyLink={itemId => { void copyPermalink({ page: "Tasks", siteId: selectedSiteId, itemId }).then(() => setLinkMessage("Lenken til oppdraget er kopiert.")).catch(() => setError("Lenken kunne ikke kopieres. Kopier adressen fra nettleseren.")); }}
            onShowContext={setWorkContextItem} onShowPlan={item => { void showPlan(item); }}
            onDependencies={setDependencyItem}
            onDecisions={setDomainDecisionItem}
            onRisks={setRiskItem}
            onVersions={setVersionItem}
            onLoadHistory={item => { void loadChildHistory(item); }} onOpenReport={item => { void openFinalReport(item); }}
            onApproveReport={item => { void approveFinalReport(item); }}
            onPlanDecision={(item, action) => { void planDecisionForItem(item, action); }}
            onApprovePlan={item => { void planDecisionForItem(item, "approve"); }}
            onDecision={(item, status) => { if (status === "assigned") setDecisionUnitId(childUnitsForItem(item)[0]?.id ?? ""); setDecision({ item, status }); setDecisionNote(""); setDecisionDependencies([]); }}
            onStatus={(item, status) => { void changeStatus(item, status); }} onReview={item => setReviewDecision({ item, priority: "normal" })}
            onDelegate={item => setDelegation({ item, assignedUnitId: childUnitsForItem(item)[0].id, instruction: "" })}
            onSendRequest={item => { setSideRequest({ item, targetSiteId: "", targetInstanceId: "", targetUnitId: "", title: item.title, description: "" }); setSideRequestRecipientQuery(""); }}
            onReleasePlan={item => { void releaseApprovedPlan(item); }}
            onReassign={item => setReassignment({ item, assignedUnitId: item.assignedUnitId ?? directChildUnits[0].id })}
            onCancel={item => { setDecision({ item, status: "cancelled" }); setDecisionNote(""); }}
            onPageChange={value => { setQueuePage(value); setOpenItemId(null); navigateToLocation({ page: "Tasks", siteId: selectedSiteId, unitId: selectedUnitId || undefined, taskFilter: filter, taskSearch: appliedSearch || undefined }, true); }} reportDate={reportDate}
          />
        </>
      )}
      {creatorOpen && (
        <TaskCreateDialog
          form={form}
          setForm={setForm}
          types={types}
          sourceTypes={sourceTypes}
          senders={senders}
          requestTypeSelected={requestTypeSelected}
          recipientQuery={requestRecipientQuery}
          setRecipientQuery={setRequestRecipientQuery}
          recipients={requestRecipients}
          clearRecipients={() => setRequestRecipients([])}
          selectedUnitId={selectedUnitId}
          classificationMarkings={classificationMarkings}
          busy={busy}
          onClose={() => setCreatorOpen(false)}
          onSubmit={createItem}
        />
      )}
      {typeManagerOpen && (
        <TaskTypeManagerDialog
          form={typeForm}
          setForm={setTypeForm}
          types={types}
          busy={busy}
          onSubmit={saveType}
          onClose={() => {
            setTypeManagerOpen(false);
            setTypeForm({ id: "", name: "", isActive: true });
          }}
        />
      )}
      {lookupManager && (
        <TaskLookupManagerDialog
          kind={lookupManager}
          form={lookupForm}
          setForm={setLookupForm}
          values={lookupManager === "source-type" ? sourceTypes : senders}
          busy={busy}
          onSubmit={saveLookup}
          onClose={() => setLookupManager(null)}
        />
      )}
      {delegation && (
        <TaskDelegationDialog draft={delegation} setDraft={setDelegation} units={childUnitsForItem(delegation.item)} markings={classificationMarkings} busy={busy} onClose={() => setDelegation(null)} onSubmit={delegateItem} />
      )}
      {sideRequest && (
        <TaskSideRequestDialog draft={sideRequest} setDraft={setSideRequest} recipientQuery={sideRequestRecipientQuery} setRecipientQuery={setSideRequestRecipientQuery} recipients={sideRequestRecipients} clearRecipients={() => setSideRequestRecipients([])} markings={classificationMarkings} busy={busy} onClose={() => setSideRequest(null)} onSubmit={sendSideRequest} />
      )}
      {reassignment && (
        <TaskReassignmentDialog draft={reassignment} setDraft={setReassignment} units={directChildUnits} busy={busy} onClose={() => setReassignment(null)} onSubmit={reassignItem} />
      )}
      {details && <TaskPlanDialog
          details={details.data}
          language={displayLanguage}
          timeZone={displayTimeZone}
          onClose={() => setDetails(null)}
        />}
      {planDecision && <PlanDecisionDialog decision={planDecision} setDecision={setPlanDecision} markings={classificationMarkings} busy={busy}
        dependencyReason={decisionDependencies.length > 0}
        dependencyPicker={planDecision.action === "hold" ? <TaskHoldDependencySection siteId={selectedSiteId} itemId={planDecision.item.id} busy={busy} selected={decisionDependencies} onToggle={toggleDecisionDependency} onError={setError} /> : undefined}
        onSubmit={event => { event.preventDefault(); void (async () => { if (planDecision.action === "hold" && !await saveHoldDependencies(planDecision.item)) return; const note = planDecision.note.trim() || "Avventer fullføring av registrerte avhengigheter."; await decidePlan(planDecision.runId, planDecision.action, note); })(); }} />}
      {workContextItem && (
        <TaskWorkContextDialog
          selectedItem={workContextItem}
          tree={workContextTree}
          onClose={() => setWorkContextItem(null)}
          onShowPlan={(item) => {
            setWorkContextItem(null);
            void showPlan(item);
          }}
        />
      )}
      {dependencyItem && <TaskDependencyDialog siteId={selectedSiteId} item={dependencyItem} busy={busy}
        editable={canManageItem(dependencyItem) && ["under_review", "on_hold", "planning_approved", "in_progress"].includes(dependencyItem.status)}
        onClose={() => setDependencyItem(null)}
        onAdd={predecessorWorkItemId => addDependency(dependencyItem, predecessorWorkItemId)}
        onRemove={dependencyId => removeDependency(dependencyItem, dependencyId)}
        onError={setError} />}
      {domainDecisionItem && <TaskDomainDecisionDialog siteId={selectedSiteId} item={domainDecisionItem} personId={personId} editable={canManageItem(domainDecisionItem)} busy={busy} language={displayLanguage} timeZone={displayTimeZone} onClose={() => setDomainDecisionItem(null)} onRecord={draft => recordDomainDecision(domainDecisionItem, draft)} onError={setError} />}
      {riskItem && <TaskRiskDialog siteId={selectedSiteId} item={riskItem} personId={personId} editable={canManageItem(riskItem)} busy={busy} onClose={() => setRiskItem(null)} onError={setError} />}
      {versionItem && <TaskVersionDialog siteId={selectedSiteId} item={versionItem} language={displayLanguage} timeZone={displayTimeZone} onClose={() => setVersionItem(null)} onError={setError} />}
      {decision && <TaskDecisionDialog decision={decision} unitId={decisionUnitId} setUnitId={setDecisionUnitId} note={decisionNote} setNote={setDecisionNote} units={childUnitsForItem(decision.item)} markings={classificationMarkings} busy={busy}
        dependencyReason={decisionDependencies.length > 0}
        dependencyPicker={decision.status === "on_hold" ? <TaskHoldDependencySection siteId={selectedSiteId} itemId={decision.item.id} busy={busy} selected={decisionDependencies} onToggle={toggleDecisionDependency} onError={setError} /> : undefined}
        onClose={() => setDecision(null)} onSubmit={async event => {
          event.preventDefault();
          if (decision.status === "cancelled") { await cancelWorkChain(decision.item, decisionNote); setDecision(null); return; }
          if (decision.status === "on_hold" && !await saveHoldDependencies(decision.item)) return;
          const note = decisionNote.trim() || (decisionDependencies.length ? "Avventer fullføring av registrerte avhengigheter." : "");
          if (await changeStatus(decision.item, decision.status, decisionUnitId, note)) setDecision(null);
        }} />}
      {reviewDecision && <ReviewDecisionDialog decision={reviewDecision} setDecision={setReviewDecision} busy={busy} onSubmit={async event => { event.preventDefault(); await changeStatus(reviewDecision.item, "under_review", undefined, undefined, reviewDecision.priority); setReviewDecision(null); }} />}
      {reportEditor && <TaskFinalReportDialog editor={reportEditor} setEditor={setReportEditor} childReports={items.filter(child => child.parentWorkItemId === reportEditor.item.id && child.finalReport)} markings={classificationMarkings} language={displayLanguage} busy={busy} onSubmit={saveFinalReport} renderReport={child => structuredReport(child, child.siteId !== selectedSiteId ? child.unitName ?? child.title : selectedSite?.name)} />}
    </div>
  );
}
