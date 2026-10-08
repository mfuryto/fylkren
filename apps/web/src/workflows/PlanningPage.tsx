import { translateActive } from "../localization";
import { useEffect, useRef, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { errorMessage } from "../api/errors";
import type { ClassificationMarking } from "../components/ClassificationControls";
import { RichTextContent } from "../components/RichText";
import { SectionHelp } from "../components/SectionHelp";
import type { Session, TaskSite, TaskUnit } from "../work/WorkContextModels";
import type { PlanAllocation, PlanningContextDetails, PlanningDraft, PlanningRun } from "./PlanningModels";
import { PlanningContextModal } from "./PlanningContextModal";
import { DownwardAllocationDialog, PlanningReassignmentDialog, type DownwardAllocationDraft, type PlanningReassignmentDraft } from "./PlanningDialogs";
import { PlanningQueueList } from "./PlanningQueueList";
import { PlanningScopeControls } from "./PlanningScopeControls";
import { PlanningStepEditor } from "./PlanningStepEditor";
import { ProcessPageHeader } from "./ProcessPageHeader";
import { createPlanningDraft, planningAllocationUnits } from "./planningQueue";
import { usePlanningStepDrafts } from "./usePlanningStepDrafts";
import { useSerializedWorkflowSave } from "./useWorkflowAutosave";
import { copyPermalink, navigateToLocation, type AppLocation } from "../navigation/permalinks";
import { getTaskContext } from "../tasks/taskApi";
import type { ListSort } from "../components/ListSortControl";
import { TaskAiAssistant } from "../tasks/TaskAiAssistant";
import { useAiCapabilities } from "../tasks/useAiCapabilities";

export function PlanningPage({
  session,
  language,
  timeZone,
  classificationMarkings,
  permalink,
  aiAvailable = false,
}: {
  session: Session;
  language: string;
  timeZone: string;
  classificationMarkings: ClassificationMarking[];
  permalink: AppLocation;
  aiAvailable?: boolean;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [sites, setSites] = useState<TaskSite[]>([]);
  const [units, setUnits] = useState<TaskUnit[]>([]);
  const [siteId, setSiteId] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [runs, setRuns] = useState<PlanningRun[]>([]);
  const [planningLevels, setPlanningLevels] = useState<Array<[string, string]>>([]);
  const [totalRuns, setTotalRuns] = useState(0);
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [queuePage, setQueuePage] = useState(1);
  const [sort, setSort] = useState<ListSort>("newest");
  const [preview, setPreview] = useState<string | null>(null);
  const [planDrafts, setPlanDrafts] = useState<Record<string, PlanningDraft>>({});
  const allocationSaveTimers = useRef<Map<string, number>>(new Map());
  const latestAllocations = useRef<Map<string, PlanAllocation[]>>(new Map());
  const enqueueAllocationSave = useSerializedWorkflowSave();
  const [parentContext, setParentContext] = useState<PlanningContextDetails | null>(null);
  const [reassignment, setReassignment] = useState<PlanningReassignmentDraft | null>(null);
  const [downwardAllocation, setDownwardAllocation] = useState<DownwardAllocationDraft | null>(null);
  const [error, setError] = useState("");
  const [linkMessage, setLinkMessage] = useState("");
  const [aiDraft, setAiDraft] = useState<{ run: PlanningRun; stepId: string } | null>(null);
  const aiCapabilities = useAiCapabilities(aiAvailable, siteId);
  useEffect(() => {
    getTaskContext(session.personId)
      .then((d: { sites: TaskSite[]; units: TaskUnit[] }) => {
        const eligible = d.sites.filter((x) => x.canPlan || x.isManager);
        setSites(eligible);
        setUnits(d.units);
        setSiteId(eligible.find(site => site.siteId === permalink.siteId)?.siteId ?? eligible[0]?.siteId ?? "");
      })
      .catch(problem => setError(errorMessage(problem,translateActive("workflowsPlanningPageThePlanningContextCouldNotBe"))));
  }, [permalink.siteId]);
  async function load(requestedPage = queuePage) {
    if (!siteId) return;
    try {
      const parameters = new URLSearchParams({ page: String(requestedPage), sort });
      if (levelFilter === "top") parameters.set("topLevel", "true");
      else if (levelFilter !== "all") parameters.set("levelId", levelFilter);
      if (permalink.runId && requestedPage === 1) parameters.set("focusRunId", permalink.runId);
      const data = await apiGet<{ items: PlanningRun[]; levels: Array<{ assignedUnitId: string | null; name: string }>; total: number; page: number }>(`/api/workflows/planning/sites/${siteId}?${parameters}`, translateActive("workflowsPlanningPageThePlanningQueueCouldNotBe"));
      setRuns(data.items);
      setPlanningLevels(data.levels.map(level => [level.assignedUnitId ?? "top", level.name]));
      setTotalRuns(data.total);
      if (data.page !== queuePage) setQueuePage(data.page);
      setError("");
      setPlanDrafts((current) => {
        const next = { ...current };
        for (const returned of data.items.filter(
          (x) =>
            x.status === "in_progress" &&
            x.claimedByPersonId === session.personId,
        )) {
          next[returned.id] ??= createPlanningDraft(returned);
        }
        return next;
      });
    } catch (problem) { setError(problem instanceof Error ? problem.message : translateActive("workflowsPlanningPageThePlanningQueueCouldNotBe")); }
  }
  useEffect(() => {
    void load();
  }, [siteId, levelFilter, sort, queuePage, permalink.runId]);
  async function mutate(path: string, body?: object) {
    await apiMutate(path, "POST", body, translateActive("siteActionFailed"));
    await load();
  }
  const {
    stepDrafts,
    setStepDrafts,
    linkDrafts,
    setLinkDrafts,
    timelineDrafts,
    setTimelineDrafts,
    saveCurrentStep,
  } = usePlanningStepDrafts({ runs, personId: session.personId, reload: load, onError: setError });
  async function removePlannedRequest(runId: string, requestId: string) {
    await apiMutate(`/api/workflows/planning/${runId}/requests/${requestId}`, "DELETE", undefined, translateActive("workflowsPlanningPageTheRequestCouldNotBeRemoved"));
    await load();
  }
  async function showParentContext(parentWorkItemId: string) {
    try { setParentContext(await apiGet<PlanningContextDetails>(`/api/work/sites/${siteId}/items/${parentWorkItemId}/details`, translateActive("workflowsPlanningPageTheSuperiorTaskAndPlanCould"))); }
    catch (problem) { setError(problem instanceof Error ? problem.message : translateActive("workflowsPlanningPageTheSuperiorTaskAndPlanCould")); }
  }
  async function openReassignment(run: PlanningRun) {
    let candidates: Array<{
      personId: string;
      displayName: string;
    }>;
    try { candidates = await apiGet(`/api/workflows/planning/${run.id}/candidates`, translateActive("workflowsPlanningPageEligiblePlannersCouldNotBeLoaded")); }
    catch (problem) { setError(problem instanceof Error ? problem.message : translateActive("workflowsPlanningPageEligiblePlannersCouldNotBeLoaded")); return; }
    setReassignment({
      run,
      candidates,
      personId:
        candidates.find((candidate) => candidate.personId !== run.claimedByPersonId)
          ?.personId ?? candidates[0]?.personId ?? "",
    });
  }
  async function navigateToStep(run: PlanningRun, step: number) {
    try {
      await flushAllocations(run);
      await saveCurrentStep(run);
      await mutate(`/api/workflows/planning/${run.id}/step`, { step });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : translateActive("workflowsPlanningPageTheStepCouldNotBeSaved"));
    }
  }
  const allocationUnits = (run: PlanningRun) => planningAllocationUnits(units, siteId, run);
  const planFor = (run: PlanningRun): PlanningDraft =>
    planDrafts[run.id] ?? createPlanningDraft(run);
  const updatePlan = (run: PlanningRun, update: Partial<PlanningDraft>) =>
    setPlanDrafts((current) => ({
      ...current,
      [run.id]: { ...(current[run.id] ?? createPlanningDraft(run)), ...update },
    }));
  async function persistAllocations(runId: string, allocations: PlanAllocation[]) {
    await enqueueAllocationSave(runId, () => apiMutate(
      `/api/workflows/planning/${runId}/allocations`, "PUT", { allocations },
      translateActive("workflowsPlanningPageSubtasksCouldNotBeSavedAutomatically"),
    ));
  }
  function updateAllocations(run: PlanningRun, allocations: PlanAllocation[]) {
    latestAllocations.current.set(run.id, allocations);
    updatePlan(run, { allocations });
    const prior = allocationSaveTimers.current.get(run.id);
    if (prior !== undefined) window.clearTimeout(prior);
    allocationSaveTimers.current.set(run.id, window.setTimeout(() => {
      allocationSaveTimers.current.delete(run.id);
      void persistAllocations(run.id, allocations).catch(problem => setError(errorMessage(problem, translateActive("workflowsPlanningPageSubtasksCouldNotBeSavedAutomatically"))));
    }, 350));
  }
  async function flushAllocations(run: PlanningRun) {
    const prior = allocationSaveTimers.current.get(run.id);
    if (prior !== undefined) window.clearTimeout(prior);
    allocationSaveTimers.current.delete(run.id);
    const allocations = latestAllocations.current.get(run.id);
    if (allocations) await persistAllocations(run.id, allocations);
  }
  useEffect(() => { setQueuePage(1); setOpenRunId(null); }, [siteId, levelFilter]);
  useEffect(() => {
    if (!permalink.runId) return;
    if (runs.some(run => run.id === permalink.runId)) setOpenRunId(permalink.runId);
  }, [permalink.runId, runs]);
  return (
    <div className="page">
      <ProcessPageHeader
        title={translateActive("taskStatusPlanning")}
        description={translateActive("workflowsPlanningPagePreviewClaimResponsibilityAndPrepareA")}
        helpTitle={translateActive("workflowsPlanningPageHowToWorkWithPlanning")}
        helpIntroduction={translateActive("workflowsPlanningPagePlanningIsTheOptionalStageBetween")}
        helpSteps={[
          { title: translateActive("workflowsPlanningPagePreviewTheTaskBasis"), description: translateActive("workflowsPlanningPageReadTheTaskTextDocumentLinks") },
          { title: translateActive("workflowsPlanningPageClaimResponsibilityForProcessing"), description: translateActive("workflowsPlanningPageTheTaskIsLockedToYou") },
          { title: translateActive("workflowsPlanningPageFollowTheWorkflowSteps"), description: translateActive("workflowsPlanningPageDocumentTheAssessmentsUseTheTimeline") },
          { title: translateActive("workflowsPlanningPageSubmitTheProposedPlanForApproval"), description: translateActive("workflowsPlanningPageTheManagerCanApproveReturnThe") },
          { title: translateActive("workflowsPlanningPageContinueAfterApproval"), description: translateActive("workflowsPlanningPageTheTaskIsSentToExecution") },
        ]}
        helpOpen={helpOpen}
        onHelpOpen={() => setHelpOpen(true)}
        onHelpClose={() => setHelpOpen(false)}
      />
      {error && <p className="status-message error-message">{error}</p>}
      {linkMessage && <p className="status-message" role="status">{linkMessage}</p>}
      <PlanningScopeControls
        sites={sites}
        siteId={siteId}
        levels={planningLevels}
        levelFilter={levelFilter}
        onSiteChange={value => { setSiteId(value); setLevelFilter("all"); }}
        onLevelChange={setLevelFilter}
        sort={sort}
        onSortChange={value => { setSort(value); setQueuePage(1); }}
      />
      <PlanningQueueList siteId={siteId}
        runs={runs}
        totalItems={totalRuns}
        page={queuePage}
        openRunId={openRunId}
        previewRunId={preview}
        canPlan={Boolean(session.canPlan)}
        language={language}
        timeZone={timeZone}
        allocationUnits={allocationUnits}
        onToggle={runId => { setOpenRunId(current => current === runId ? null : runId); navigateToLocation({ page: "Planning", siteId, runId }); }}
        onCopyLink={runId => { void copyPermalink({ page: "Planning", siteId, runId }).then(() => setLinkMessage(translateActive("workflowsPlanningPageThePlanningLinkHasBeenCopied"))).catch(() => setError(translateActive("reportLinkCopyFailed"))); }}
        onTogglePreview={runId => setPreview(current => current === runId ? null : runId)}
        onRelease={run => { void flushAllocations(run).then(() => mutate(`/api/workflows/planning/${run.id}/release`)).catch(problem => setError(errorMessage(problem,translateActive("workflowsPlanningPagePlanningResponsibilityCouldNotBeReleased")))); }}
        onReassign={run => { void openReassignment(run); }}
        onAllocateDownward={(run, childUnits) => setDownwardAllocation({ run, unitId: childUnits[0].id, instruction: run.item.description })}
        onShowAncestor={itemId => { void showParentContext(itemId); }}
        onClaim={run => { void mutate(`/api/workflows/planning/${run.id}/claim`).catch(problem => setError(errorMessage(problem,translateActive("workflowsPlanningPageTheTaskCouldNotBeClaimed")))); }}
        onPageChange={value => { setQueuePage(value); setOpenRunId(null); navigateToLocation({ page: "Planning", siteId }, true); }}
        renderEditor={run => run.status === "in_progress" && run.claimedByPersonId === session.personId ? (
                <PlanningStepEditor
                  run={run}
                  siteId={siteId}
                  language={language}
                  classificationMarkings={classificationMarkings}
                  units={allocationUnits(run)}
                  stepDrafts={stepDrafts}
                  setStepDrafts={setStepDrafts}
                  linkDrafts={linkDrafts}
                  setLinkDrafts={setLinkDrafts}
                  timelineDrafts={timelineDrafts}
                  setTimelineDrafts={setTimelineDrafts}
                  plan={planFor(run)}
                  onPlanChange={(update) => updatePlan(run, update)}
                  onAllocationsChange={(allocations) => updateAllocations(run, allocations)}
                  onNavigate={(step) => navigateToStep(run, step)}
                  onAddRequest={(stepId, targetSiteId, targetInstanceId, instruction) =>
                    mutate(`/api/workflows/planning/${run.id}/requests`, {
                      stepId,
                      targetSiteId,
                      targetInstanceId,
                      instruction,
                    })
                  }
                  onRemoveRequest={(requestId) => removePlannedRequest(run.id, requestId)}
                  onReload={load}
                  onError={setError}
                  aiEnabled={aiCapabilities.draftsEnabled}
                  onAi={() => setAiDraft({ run, stepId: run.steps[run.currentStep].id })}
                  onSubmit={async (event) => {
                    event.preventDefault();
                    try {
                      await flushAllocations(run);
                      await saveCurrentStep(run);
                      const plan = planFor(run);
                      await mutate(`/api/workflows/planning/${run.id}/submit`, {
                        priority: plan.priority,
                        dueAt: plan.dueAt
                          ? new Date(`${plan.dueAt}T23:59:59`).toISOString()
                          : null,
                        allocations: latestAllocations.current.get(run.id) ?? plan.allocations,
                      });
                    } catch (reason) {
                      setError(reason instanceof Error ? reason.message : translateActive("workflowsPlanningPageTheProposedPlanCouldNotBe"));
                    }
                  }}
                />
              ) : null}
      />
      {parentContext && (
        <PlanningContextModal details={parentContext} language={language} onClose={() => setParentContext(null)} />
      )}
      {reassignment && (
        <PlanningReassignmentDialog
          draft={reassignment}
          onChange={setReassignment}
          onClose={() => setReassignment(null)}
          onSubmit={async () => {
            try {
              await mutate(`/api/workflows/planning/${reassignment.run.id}/reassign`, { personId: reassignment.personId });
              setReassignment(null);
            } catch (problem) {
              setError(problem instanceof Error ? problem.message : translateActive("workflowsPlanningPagePlanningResponsibilityCouldNotBeReassigned"));
            }
          }}
        />
      )}
      {downwardAllocation && (
        <DownwardAllocationDialog
          draft={downwardAllocation}
          units={allocationUnits(downwardAllocation.run)}
          onChange={setDownwardAllocation}
          onClose={() => setDownwardAllocation(null)}
          onSubmit={async () => {
            try {
              await mutate(`/api/work/sites/${siteId}/items/${downwardAllocation.run.item.id}/delegate`, { assignedUnitId: downwardAllocation.unitId, instruction: downwardAllocation.instruction });
              setDownwardAllocation(null);
            } catch (problem) {
              setError(problem instanceof Error ? problem.message : translateActive("workflowsPlanningPageTheTaskCouldNotBeRouted"));
            }
          }}
        />
      )}
      {aiDraft && <TaskAiAssistant
        siteId={siteId}
        item={aiDraft.run.item}
        features={["planning"]}
        fixedFeature="planning"
        contextId={aiDraft.run.id}
        targetId={aiDraft.stepId}
        language={language}
        timeZone={timeZone}
        onUseDraft={content => {
          setStepDrafts(current => ({ ...current, [aiDraft.stepId]: content }));
          setAiDraft(null);
        }}
        onClose={() => setAiDraft(null)}
      />}
    </div>
  );
}
