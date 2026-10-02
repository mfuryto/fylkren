import { translateActive } from "../localization";
import { useEffect, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { Modal } from "../components/Modal";
import { SectionHelp } from "../components/SectionHelp";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import { WorkflowFormFields } from "./WorkflowFormFields";
import { emptyWorkflowForm, type WorkflowDefinitionSummary, type WorkflowForm, type WorkflowTemplateSummary } from "./WorkflowModels";
import { ListSortControl, sortList, type ListSort } from "../components/ListSortControl";

export function WorkflowsPage() {
  const [helpOpen, setHelpOpen] = useState(false);
  const emptyForm = emptyWorkflowForm();
  const [sites, setSites] = useState<TaskSite[]>([]);
  const [units, setUnits] = useState<TaskUnit[]>([]);
  const [siteId, setSiteId] = useState("");
  const [flows, setFlows] = useState<WorkflowDefinitionSummary[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplateSummary[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editor, setEditor] = useState<
    (typeof emptyForm & { id: string }) | null
  >(null);
  const [viewer, setViewer] = useState<WorkflowDefinitionSummary | null>(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<ListSort>("name-asc");
  const selectedSite = sites.find((x) => x.siteId === siteId);
  useEffect(() => {
    apiGet<{ sites: TaskSite[]; units: TaskUnit[] }>("/api/work/context", translateActive("workflowsWorkflowsPageTheWorkflowContextCouldNotBe"))
      .then((d: { sites: TaskSite[]; units: TaskUnit[] }) => {
        setSites(d.sites);
        setUnits(d.units);
        const firstSite = d.sites[0];
        setSiteId(firstSite?.siteId ?? "");
        if (firstSite && !firstSite.isSiteManager) {
          setForm((current) => ({ ...current, kind: "execution", ownerUnitId: d.units.find((unit) => unit.siteId === firstSite.siteId && unit.isLeader)?.id ?? "" }));
        }
      }).catch(problem => setError(problem instanceof Error ? problem.message : translateActive("workflowsWorkflowsPageTheWorkflowContextCouldNotBe")));
  }, []);
  async function load() {
    if (!siteId) return;
    try {
      const [workflowResponse, templateResponse] = await Promise.all([
        apiGet<WorkflowDefinitionSummary[]>(`/api/workflows/sites/${siteId}`, translateActive("workflowsWorkflowsPageWorkflowsCouldNotBeLoaded")),
        apiGet<WorkflowTemplateSummary[]>(`/api/templates/sites/${siteId}`, translateActive("workTemplatesLoadFailed")),
      ]);
      setFlows(workflowResponse); setTemplates(templateResponse); setError("");
    } catch (problem) { setError(problem instanceof Error ? problem.message : translateActive("workflowsWorkflowsPageWorkflowsCouldNotBeLoaded")); }
  }
  useEffect(() => {
    void load();
  }, [siteId]);
  async function save(value: typeof form, id?: string) {
    const steps = value.steps
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((name) => ({
        name,
        isOptional: false,
        allowsTaskAllocation: name === value.allocationStepName,
        hasTimeline: name === value.timelineStepName,
        templateId: value.templateIds[name] || null,
      }));
    await apiMutate(
      `/api/workflows/sites/${siteId}${id ? `/${id}` : ""}`,
      id ? "PUT" : "POST",
      {
          name: value.name,
          ownerUnitId: value.kind === "planning" ? null : value.ownerUnitId || null,
          kind: value.kind,
          steps,
      },
      translateActive("workflowsWorkflowsPageTheWorkflowCouldNotBeSaved"),
    );
    await load();
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await save(form);
      setForm({
        ...emptyForm,
        ownerUnitId:
          selectedSite?.isSiteManager
            ? ""
            : (units.find((unit) => unit.siteId === siteId && unit.isLeader)?.id ?? ""),
      });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : translateActive("workflowsWorkflowsPageTheWorkflowCouldNotBeCreated"));
    }
  }
  async function update(e: React.FormEvent) {
    e.preventDefault();
    if (!editor) return;
    setError("");
    try {
      await save(editor, editor.id);
      setEditor(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : translateActive("workflowsWorkflowsPageTheWorkflowCouldNotBeUpdated"));
    }
  }
  async function removeFlow(flow: WorkflowDefinitionSummary) {
    try { await apiMutate(`/api/workflows/sites/${siteId}/${flow.id}`, "DELETE", undefined, translateActive("workflowsWorkflowsPageTheWorkflowCouldNotBeDisabled")); }
    catch (problem) { setError(problem instanceof Error ? problem.message : translateActive("workflowsWorkflowsPageTheWorkflowCouldNotBeDisabled")); return; }
    if (viewer?.id === flow.id) setViewer(null);
    await load();
  }
  function edit(flow: WorkflowDefinitionSummary) {
    setEditor({
      id: flow.id,
      name: flow.name,
      ownerUnitId: flow.ownerUnitId ?? "",
      kind: flow.kind as "planning" | "execution",
      steps: flow.steps.map((x) => x.name).join("\n"),
      allocationStepName:
        flow.steps.find((x) => x.allowsTaskAllocation)?.name ?? "",
      timelineStepName: flow.steps.find((x) => x.hasTimeline)?.name ?? "",
      templateIds: Object.fromEntries(
        flow.steps
          .filter((x) => x.templateId)
          .map((x) => [x.name, x.templateId!]),
      ),
    });
  }
  const fields = (value: WorkflowForm, setValue: (value: WorkflowForm) => void) => (
    <WorkflowFormFields
      value={value}
      onChange={setValue}
      selectedSite={selectedSite}
      siteId={siteId}
      units={units}
      templates={templates}
    />
  );
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{translateActive("navWorkflows")}</h1>
          <p className="muted">
            {translateActive("workflowsWorkflowsPageTheSiteManagerDeterminesTheContent")}
          </p>
        </div>
        <button className="help-button" type="button" onClick={() => setHelpOpen(true)}><i aria-hidden="true">?</i><span>{translateActive("help")}</span></button>
      </header>
      {error && <p className="status-message error-message">{error}</p>}
      {sites.length > 1 && <section className="panel personnel-site">
        <div className="field">
          <label>{translateActive("site")}</label>
          <select value={siteId} onChange={(e) => {
            const nextSiteId = e.target.value;
            const nextSite = sites.find((site) => site.siteId === nextSiteId);
            setSiteId(nextSiteId);
            setForm({ ...emptyForm, ownerUnitId: nextSite?.isSiteManager ? "" : (units.find((unit) => unit.siteId === nextSiteId && unit.isLeader)?.id ?? "") });
          }}>
            {sites.map((x) => (
              <option key={x.siteId} value={x.siteId}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
      </section>}
      <div className="workflow-layout">
        <section className="panel">
          <div className="section-heading"><h2>{translateActive("workflowsWorkflowsPageActiveWorkflows")}</h2><ListSortControl id="workflow-sort" value={sort} onChange={setSort} options={["name-asc", "name-desc"]}/></div>
          <div className="admin-list">
            {sortList(flows, sort, { name: flow => flow.name }).map((f) => (
              <div className="admin-list-row" key={f.id}>
                <span>
                  <strong>{f.name}</strong>
                  <small className="muted">
                    {f.kind === "planning"
                      ? translateActive("taskStatusPlanning")
                      : translateActive("workflowExecutionSummary", { scope: f.ownerUnitName ?? translateActive("entireSite") })}
                  </small>
                </span>
                <div className="row-actions">
                  <button className="link-button" type="button" onClick={() => setViewer(f)}>{translateActive("view")}</button>
                  {f.canEdit && <button className="link-button" type="button" onClick={() => edit(f)}>{translateActive("edit")}</button>}
                  {f.canEdit && <button className="link-button danger" type="button" onClick={() => void removeFlow(f)}>{translateActive("delete")}</button>}
                </div>
              </div>
            ))}
          </div>
        </section>
        {selectedSite?.isSiteManager && <form className="panel stacked-form" onSubmit={create}>
          <h2>
            {form.kind === "planning" ? translateActive("configurePlanningWorkflow") : translateActive("workflowsWorkflowsPageNewExecutionWorkflow")}
          </h2>
          {selectedSite.isSiteManager && (
            <>
              <div className="field">
                <label htmlFor="workflow-direction">{translateActive("workflowsWorkflowsPageDirection")}</label>
                <select id="workflow-direction" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "planning" | "execution", ownerUnitId: "", allocationStepName: "" })}>
                  <option value="planning">{translateActive("taskStatusPlanning")}</option>
                  <option value="execution">{translateActive("taskStatusExecution")}</option>
                </select>
              </div>
              <p className="muted">{translateActive("workflowsWorkflowsPageTheSiteHasOneActivePlanning")}</p>
            </>
          )}
          {fields(form, setForm)}
          <button className="primary-button">
            {form.kind === "planning" ? translateActive("workflowsWorkflowsPageActivatePlanningWorkflow") : translateActive("workflowsWorkflowsPageCreateExecutionWorkflow")}
          </button>
        </form>}
      </div>
      {helpOpen && <SectionHelp title={translateActive("workflowsWorkflowsPageHowToWorkWithWorkflows")} intro={translateActive("workflowsWorkflowsPageWorkflowsDetermineWhichStepsATask")} steps={[{title:translateActive("workflowsWorkflowsPageSelectDirectionAndScope"),text:translateActive("workflowsWorkflowsPagePlanningIsAContinuousSiteOwned")},{title:translateActive("workflowsWorkflowsPageCreateTheStepsInTheCorrect"),text:translateActive("workflowsWorkflowsPageEachStepBecomesASeparateDocumentation")},{title:translateActive("workflowsWorkflowsPageLinkOptionalFeatures"),text:translateActive("workflowsWorkflowsPageAStepCanReceiveInitialContent")},{title:translateActive("workflowsWorkflowsPageReviewAndActivate"),text:translateActive("workflowsWorkflowsPageEditingCreatesANewVersionWhile")},{title:translateActive("workflowsWorkflowsPageManageTheSiteSWorkflows"),text:translateActive("workflowsWorkflowsPageTheSiteManagerCreatesEditsAnd")}]} note={translateActive("workflowsWorkflowsPageWorkflowsAreUsedInOperationalProcessing")} onClose={() => setHelpOpen(false)} />}
      {editor && (
        <Modal title={translateActive("workflowsWorkflowsPageEditWorkflow")} onClose={() => setEditor(null)}>
          <form className="stacked-form" onSubmit={update}>
            {fields(editor, (value) => setEditor({ ...editor, ...value }))}
            <p className="muted modal-note">
              {translateActive("workflowsWorkflowsPageSavingCreatesANewVersionActive")}
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setEditor(null)}
              >
                {translateActive("cancel")}
              </button>
              <button className="primary-button">{translateActive("saveNewVersion")}</button>
            </div>
          </form>
        </Modal>
      )}
      {viewer && (
        <Modal title={viewer.name} onClose={() => setViewer(null)}>
          <div className="stacked-form">
            <p className="muted">
              {viewer.kind === "planning"
                ? translateActive("workflowsWorkflowsPageDirectionPlanning")
                : translateActive("workflowDirectionExecutionSummary", { scope: viewer.ownerUnitName ?? translateActive("entireSite") })}
            </p>
            <ol className="workflow-step-list">
              {viewer.steps.map((step, index) => (
                <li key={`${step.name}-${index}`}>
                  <strong>{step.name}</strong>
                  <span className="muted">
                    {[step.templateName ? translateActive("templateNameLabel", { name: step.templateName }) : null, step.hasTimeline ? translateActive("workflowsWorkflowFieldsTimeline") : null, step.allowsTaskAllocation ? translateActive("tasksTaskContextDialogsTaskAllocation") : null].filter(Boolean).join(" · ") || translateActive("noSpecialStepConfiguration")}
                  </span>
                </li>
              ))}
            </ol>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setViewer(null)}>{translateActive("close")}</button>
              {viewer.canEdit && <button className="primary-button" type="button" onClick={() => { const selected=viewer; setViewer(null); edit(selected); }}>{translateActive("edit")}</button>}
              {viewer.canEdit && <button className="danger-button" type="button" onClick={() => void removeFlow(viewer)}>{translateActive("delete")}</button>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
