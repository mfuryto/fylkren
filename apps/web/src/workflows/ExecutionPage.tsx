import { useEffect, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import type { Session, TaskSite, TaskUnit } from "../work/WorkContextModels";
import { ExecutionDownwardAllocationDialog, ExecutionPlanDialog, ExecutionReassignmentDialog, type ExecutionDownwardAllocation, type ExecutionReassignment } from "./ExecutionDialogs";
import type { ExecutionDefinition, ExecutionItem, ExternalRequestDraft, ExternalResponseDraft } from "./ExecutionModels";
import { ExecutionQueueList } from "./ExecutionQueueList";
import { ExecutionWorkflowEditor } from "./ExecutionWorkflowEditor";
import type { PlanningContextDetails } from "./PlanningModels";
import { ProcessPageHeader } from "./ProcessPageHeader";
import { executionChildUnits, executionDefinitionOptions } from "./executionQueue";
import { useExecutionStepDrafts } from "./useExecutionStepDrafts";
import { copyPermalink, navigateToLocation, type AppLocation } from "../navigation/permalinks";
import { getTaskContext } from "../tasks/taskApi";
import { TaskSideRequestDialog, type TaskSideRequestDraft } from "../tasks/TaskRoutingDialogs";
import { useRequestRecipientSearch } from "../work/useRequestRecipientSearch";
import type { ClassificationMarking } from "../components/ClassificationControls";

export function ExecutionPage({ session, language, classificationMarkings, permalink }: { session: Session; language: string; classificationMarkings: ClassificationMarking[]; permalink: AppLocation }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [queuePage, setQueuePage] = useState(1);
  const [sites, setSites] = useState<TaskSite[]>([]);
  const [units, setUnits] = useState<TaskUnit[]>([]);
  const [siteId, setSiteId] = useState("");
  const [items, setItems] = useState<ExecutionItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [definitions, setDefinitions] = useState<ExecutionDefinition[]>([]);
  const [managedItemIds, setManagedItemIds] = useState<string[]>([]);
  const [planContextIds, setPlanContextIds] = useState<Record<string, string>>({});
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [selectedDefinitions, setSelectedDefinitions] = useState<Record<string, string>>({});
  const [externalDraft, setExternalDraft] = useState<ExternalRequestDraft | null>(null);
  const [responseDraft, setResponseDraft] = useState<ExternalResponseDraft | null>(null);
  const [planContext, setPlanContext] = useState<PlanningContextDetails | null>(null);
  const [downwardAllocation, setDownwardAllocation] = useState<ExecutionDownwardAllocation | null>(null);
  const [executionReassignment, setExecutionReassignment] = useState<ExecutionReassignment | null>(null);
  const [sideRequest, setSideRequest] = useState<TaskSideRequestDraft | null>(null);
  const [requestRecipientQuery, setRequestRecipientQuery] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [error, setError] = useState("");
  const [linkMessage, setLinkMessage] = useState("");
  const [requestRecipients, setRequestRecipients] = useRequestRecipientSearch({
    siteId, sourceUnitId: sideRequest?.item.assignedUnitId, query: requestRecipientQuery,
    enabled: Boolean(sideRequest), recipientSelected: Boolean(sideRequest?.targetSiteId || sideRequest?.targetUnitId), onError: setError,
  });

  useEffect(() => {
    getTaskContext(session.personId)
      .then(data => {
        const eligible = data.sites.filter(site => site.hasExecutionAccess);
        setSites(eligible);
        setUnits(data.units);
        setSiteId(eligible.find(site => site.siteId === permalink.siteId)?.siteId ?? eligible[0]?.siteId ?? "");
      })
      .catch(problem => setError(problem instanceof Error ? problem.message : "Utførelseskonteksten kunne ikke lastes."));
  }, [permalink.siteId]);

  async function load(requestedPage = queuePage) {
    if (!siteId) return;
    try {
      const parameters = new URLSearchParams({ page: String(requestedPage) });
      if (permalink.itemId && requestedPage === 1) parameters.set("focusItemId", permalink.itemId);
      const data = await apiGet<{ items: ExecutionItem[]; definitions: ExecutionDefinition[]; managedItemIds: string[]; planContextIds?: Record<string, string>; total: number; page: number }>(`/api/execution/sites/${siteId}?${parameters}`, "Utførelseskøen kunne ikke lastes.");
      setItems(data.items);
      setTotalItems(data.total);
      if (data.page !== queuePage) setQueuePage(data.page);
      setDefinitions(data.definitions);
      setManagedItemIds(data.managedItemIds);
      setPlanContextIds(data.planContextIds ?? {});
      setError("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Utførelseskøen kunne ikke lastes.");
    }
  }

  useEffect(() => {
    setQueuePage(1);
    setOpenItemId(null);
  }, [siteId]);
  useEffect(() => { void load(); }, [siteId, queuePage, permalink.itemId]);
  useEffect(() => {
    if (!permalink.itemId || !items.some(item => item.id === permalink.itemId)) return;
    setOpenItemId(permalink.itemId); setExpandedItemId(permalink.itemId);
  }, [permalink.itemId, items]);

  async function mutate(path: string, method: "POST" | "PUT" = "POST", body?: object) {
    await apiMutate(path, method, body, "Handlingen kunne ikke utføres.");
    await load();
  }

  async function sendSideRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sideRequest) return;
    setRequestBusy(true);
    try {
      await mutate(`/api/work/sites/${siteId}/items/${sideRequest.item.id}/request`, "POST", {
        targetSiteId: sideRequest.targetSiteId || null, targetInstanceId: sideRequest.targetInstanceId || null, targetUnitId: sideRequest.targetUnitId || null,
        title: sideRequest.title, description: sideRequest.description,
      });
      setSideRequest(null); setRequestRecipientQuery(""); setRequestRecipients([]);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Anmodningen kunne ikke sendes."); }
    finally { setRequestBusy(false); }
  }

  const { drafts, setDrafts, timelineDrafts, setTimelineDrafts, saveStep: saveExecutionStep } = useExecutionStepDrafts({
    items,
    personId: session.personId,
    onError: setError,
  });

  async function showPlan(item: ExecutionItem) {
    const planItemId = planContextIds[item.id];
    if (!planItemId) return;
    try {
      setPlanContext(await apiGet<PlanningContextDetails>(`/api/work/sites/${siteId}/items/${planItemId}/details`, "Planen kunne ikke lastes."));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Planen kunne ikke lastes.");
    }
  }

  async function openExecutionReassignment(item: ExecutionItem) {
    if (!item.run) return;
    try {
      const candidates = await apiGet<Array<{ personId: string; displayName: string }>>(`/api/execution/${item.run.id}/candidates`, "Aktuelle mottakere kunne ikke lastes.");
      setExecutionReassignment({ item, personId: candidates.find(candidate => candidate.personId !== item.run?.claimedByPersonId)?.personId ?? candidates[0]?.personId ?? "", candidates });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Aktuelle mottakere kunne ikke lastes.");
    }
  }

  const definitionOptions = (item: ExecutionItem) => executionDefinitionOptions(definitions, units, siteId, item);
  const childUnits = (item: ExecutionItem) => executionChildUnits(units, siteId, item);
  return <div className="page">
    <ProcessPageHeader
      title="Utførelse"
      description="Ta ansvar for oppdrag på ditt nivå, velg arbeidsflyt og dokumenter utførelsen frem til kontroll og sluttrapport."
      helpTitle="Slik arbeider du med utførelse"
      helpIntroduction="Utførelse er den aktive behandlingen av et oppdrag på mottakernivået. Arbeidsmåten følger utførelsesflyten som velges."
      helpSteps={[
        { title: "Les oppdragsgrunnlaget.", description: "Kontroller oppdragstekst, dokumenter og eventuelle godkjente planer fra dette og overordnede nivåer." },
        { title: "Ta ansvar for oppdraget.", description: "Én bruker tar behandlingsansvaret. Lederen kan frigjøre eller omfordele ansvaret uten at dokumentasjon eller historikk forsvinner." },
        { title: "Velg utførelsesflyt.", description: "Velg en tilgjengelig arbeidsflyt som passer oppdraget og arbeidsnivået." },
        { title: "Dokumenter utførelsen.", description: "Fyll ut stegene, oppdater eventuell tidslinje og registrer oppfølging av eksterne kontakter som skjer utenfor løsningen. En leder som selv har tatt ansvar for utførelsen kan sende en anmodning herfra. Endringer lagres automatisk." },
        { title: "Avslutt riktig.", description: "Fordel videre dersom et undernivå skal overta. Ellers sendes utførelsen til kontroll før sluttrapporten skrives og godkjennes på nivået." },
      ]}
      helpOpen={helpOpen}
      onHelpOpen={() => setHelpOpen(true)}
      onHelpClose={() => setHelpOpen(false)}
    />
    {error && <p className="status-message error-message">{error}</p>}
    {linkMessage && <p className="status-message" role="status">{linkMessage}</p>}
    {sites.length > 1 && <section className="panel personnel-site"><div className="field">
      <label htmlFor="execution-site">Site</label>
      <select id="execution-site" value={siteId} onChange={event => setSiteId(event.target.value)}>
        {sites.map(site => <option key={site.siteId} value={site.siteId}>{site.name}</option>)}
      </select>
    </div></section>}
    <ExecutionQueueList
      items={items}
      totalItems={totalItems}
      page={queuePage}
      personId={session.personId}
      openItemId={openItemId}
      expandedItemId={expandedItemId}
      managedItemIds={managedItemIds}
      planContextIds={planContextIds}
      childUnits={childUnits}
      onToggle={itemId => { setOpenItemId(current => current === itemId ? null : itemId); navigateToLocation({ page: "Execution", siteId, itemId }); }}
      onCopyLink={itemId => { void copyPermalink({ page: "Execution", siteId, itemId }).then(() => setLinkMessage("Lenken til utførelsen er kopiert.")).catch(() => setError("Lenken kunne ikke kopieres.")); }}
      onToggleDetails={itemId => setExpandedItemId(current => current === itemId ? null : itemId)}
      onShowPlan={item => { void showPlan(item); }}
      onClaim={item => { void mutate(`/api/execution/items/${item.id}/claim`).catch(problem => setError(problem.message)); }}
      onRelease={item => { if (item.run) void mutate(`/api/execution/${item.run.id}/release`).catch(problem => setError(problem.message)); }}
      onReassign={item => { void openExecutionReassignment(item); }}
      onAllocateDownward={(item, availableUnits) => setDownwardAllocation({ item, unitId: availableUnits[0].id, instruction: item.description })}
      onPageChange={value => { setQueuePage(value); setOpenItemId(null); navigateToLocation({ page: "Execution", siteId }, true); }}
      renderEditor={item => item.run?.claimedByPersonId === session.personId ? <ExecutionWorkflowEditor
        item={item} language={language} definitions={definitionOptions(item)} selectedDefinitions={selectedDefinitions}
        setSelectedDefinitions={setSelectedDefinitions} drafts={drafts} setDrafts={setDrafts}
        timelineDrafts={timelineDrafts} setTimelineDrafts={setTimelineDrafts} externalDraft={externalDraft}
        setExternalDraft={setExternalDraft} responseDraft={responseDraft} setResponseDraft={setResponseDraft}
        onMutate={mutate} onSaveStep={saveExecutionStep} onError={setError}
        canSendRequest={managedItemIds.includes(item.id)}
        onSendRequest={value => { setSideRequest({ item: value, targetSiteId: "", targetInstanceId: "", targetUnitId: "", title: value.title, description: "" }); setRequestRecipientQuery(""); }}
      /> : null}
    />
    {sideRequest && <TaskSideRequestDialog draft={sideRequest} setDraft={setSideRequest} recipientQuery={requestRecipientQuery} setRecipientQuery={setRequestRecipientQuery} recipients={requestRecipients} clearRecipients={() => setRequestRecipients([])} markings={classificationMarkings} busy={requestBusy} onClose={() => setSideRequest(null)} onSubmit={sendSideRequest} />}
    {downwardAllocation && <ExecutionDownwardAllocationDialog
      draft={downwardAllocation} units={childUnits(downwardAllocation.item)} onChange={setDownwardAllocation}
      onClose={() => setDownwardAllocation(null)} onSubmit={event => {
        event.preventDefault();
        void mutate(`/api/work/sites/${siteId}/items/${downwardAllocation.item.id}/delegate`, "POST", { assignedUnitId: downwardAllocation.unitId, instruction: downwardAllocation.instruction })
          .then(() => setDownwardAllocation(null)).catch(problem => setError(problem.message));
      }}
    />}
    {executionReassignment?.item.run && <ExecutionReassignmentDialog
      draft={executionReassignment} onChange={setExecutionReassignment} onClose={() => setExecutionReassignment(null)}
      onSubmit={event => {
        event.preventDefault();
        void mutate(`/api/execution/${executionReassignment.item.run!.id}/reassign`, "POST", { personId: executionReassignment.personId })
          .then(() => setExecutionReassignment(null)).catch(problem => setError(problem.message));
      }}
    />}
    {planContext && <ExecutionPlanDialog details={planContext} onClose={() => setPlanContext(null)}/>}
  </div>;
}
