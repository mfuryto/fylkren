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

export function PlanningPage({
  session,
  language,
  timeZone,
  classificationMarkings,
  permalink,
}: {
  session: Session;
  language: string;
  timeZone: string;
  classificationMarkings: ClassificationMarking[];
  permalink: AppLocation;
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
  useEffect(() => {
    getTaskContext(session.personId)
      .then((d: { sites: TaskSite[]; units: TaskUnit[] }) => {
        const eligible = d.sites.filter((x) => x.canPlan || x.isManager);
        setSites(eligible);
        setUnits(d.units);
        setSiteId(eligible.find(site => site.siteId === permalink.siteId)?.siteId ?? eligible[0]?.siteId ?? "");
      })
      .catch(problem => setError(errorMessage(problem,"Planleggingskonteksten kunne ikke lastes.")));
  }, [permalink.siteId]);
  async function load(requestedPage = queuePage) {
    if (!siteId) return;
    try {
      const parameters = new URLSearchParams({ page: String(requestedPage) });
      if (levelFilter === "top") parameters.set("topLevel", "true");
      else if (levelFilter !== "all") parameters.set("levelId", levelFilter);
      if (permalink.runId && requestedPage === 1) parameters.set("focusRunId", permalink.runId);
      const data = await apiGet<{ items: PlanningRun[]; levels: Array<{ assignedUnitId: string | null; name: string }>; total: number; page: number }>(`/api/workflows/planning/sites/${siteId}?${parameters}`, "Planleggingskøen kunne ikke lastes.");
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
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Planleggingskøen kunne ikke lastes."); }
  }
  useEffect(() => {
    void load();
  }, [siteId, levelFilter, queuePage, permalink.runId]);
  async function mutate(path: string, body?: object) {
    await apiMutate(path, "POST", body, "Handlingen kunne ikke utføres.");
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
    await apiMutate(`/api/workflows/planning/${runId}/requests/${requestId}`, "DELETE", undefined, "Anmodningen kunne ikke fjernes fra planen.");
    await load();
  }
  async function showParentContext(parentWorkItemId: string) {
    try { setParentContext(await apiGet<PlanningContextDetails>(`/api/work/sites/${siteId}/items/${parentWorkItemId}/details`, "Overordnet oppdrag og plan kunne ikke lastes.")); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Overordnet oppdrag og plan kunne ikke lastes."); }
  }
  async function openReassignment(run: PlanningRun) {
    let candidates: Array<{
      personId: string;
      displayName: string;
    }>;
    try { candidates = await apiGet(`/api/workflows/planning/${run.id}/candidates`, "Kvalifiserte planleggere kunne ikke lastes."); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Kvalifiserte planleggere kunne ikke lastes."); return; }
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
      setError(problem instanceof Error ? problem.message : "Steget kunne ikke lagres.");
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
      "Deloppdragene kunne ikke lagres automatisk.",
    ));
  }
  function updateAllocations(run: PlanningRun, allocations: PlanAllocation[]) {
    latestAllocations.current.set(run.id, allocations);
    updatePlan(run, { allocations });
    const prior = allocationSaveTimers.current.get(run.id);
    if (prior !== undefined) window.clearTimeout(prior);
    allocationSaveTimers.current.set(run.id, window.setTimeout(() => {
      allocationSaveTimers.current.delete(run.id);
      void persistAllocations(run.id, allocations).catch(problem => setError(errorMessage(problem, "Deloppdragene kunne ikke lagres automatisk.")));
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
        title="Planlegging"
        description="Forhåndsvis, ta ansvar og utarbeid planforslag."
        helpTitle="Slik arbeider du med planlegging"
        helpIntroduction="Planlegging er det valgfrie steget mellom vurdering og utførelse. De konkrete stegene bestemmes av sitens planleggingsarbeidsflyt."
        helpSteps={[
          { title: "Forhåndsvis oppdragsgrunnlaget.", description: "Les oppdragstekst, dokumentlenker og eventuelle godkjente planer fra overordnede nivåer før du tar ansvar." },
          { title: "Ta ansvar for behandlingen.", description: "Oppdraget låses til deg mens du planlegger. En leder kan frigjøre eller omfordele ansvaret uten at historikken slettes." },
          { title: "Følg arbeidsflytens steg.", description: "Dokumenter vurderingene, bruk eventuell tidslinje og legg inn oppgavefordeling der arbeidsflyten åpner for det. Endringer lagres automatisk." },
          { title: "Send planforslaget til godkjenning.", description: "Lederen kan godkjenne, sende planen tilbake med skriftlige korrigeringer, sette oppdraget på vent eller avvise det." },
          { title: "Gå videre etter godkjenning.", description: "Oppdraget sendes til utførelse på samme nivå, fordeles internt eller sendes som anmodning til en annen toppnivå-site i tråd med den godkjente planen." },
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
      />
      <PlanningQueueList
        runs={runs}
        totalItems={totalRuns}
        page={queuePage}
        openRunId={openRunId}
        previewRunId={preview}
        canPlan={Boolean(session.canPlan)}
        language={language}
        timeZone={timeZone}
        allocationUnits={allocationUnits}
        onToggle={runId => { setOpenRunId(current => current === runId ? null : runId); navigateToLocation({ page: "Planlegging", siteId, runId }); }}
        onCopyLink={runId => { void copyPermalink({ page: "Planlegging", siteId, runId }).then(() => setLinkMessage("Lenken til planleggingen er kopiert.")).catch(() => setError("Lenken kunne ikke kopieres.")); }}
        onTogglePreview={runId => setPreview(current => current === runId ? null : runId)}
        onRelease={run => { void flushAllocations(run).then(() => mutate(`/api/workflows/planning/${run.id}/release`)).catch(problem => setError(errorMessage(problem,"Planleggingsansvaret kunne ikke frigjøres."))); }}
        onReassign={run => { void openReassignment(run); }}
        onAllocateDownward={(run, childUnits) => setDownwardAllocation({ run, unitId: childUnits[0].id, instruction: run.item.description })}
        onShowAncestor={itemId => { void showParentContext(itemId); }}
        onClaim={run => { void mutate(`/api/workflows/planning/${run.id}/claim`).catch(problem => setError(errorMessage(problem,"Oppgaven kunne ikke tas."))); }}
        onPageChange={value => { setQueuePage(value); setOpenRunId(null); navigateToLocation({ page: "Planlegging", siteId }, true); }}
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
                      setError(reason instanceof Error ? reason.message : "Planforslaget kunne ikke sendes.");
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
              setError(problem instanceof Error ? problem.message : "Planleggingsansvaret kunne ikke omfordeles.");
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
              setError(problem instanceof Error ? problem.message : "Oppdraget kunne ikke fordeles videre.");
            }
          }}
        />
      )}
    </div>
  );
}
