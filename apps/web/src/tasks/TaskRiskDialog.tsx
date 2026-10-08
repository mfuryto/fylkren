import { useEffect, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { errorMessage } from "../api/errors";
import { Modal } from "../components/Modal";
import type { WorkItem } from "../work/WorkItemModels";
import { useTranslation } from "../localization/LocalizationProvider";
import { emptyRisk, numberedRisks, type Assessment, type Mitigation, type Risk } from "./riskModels";
import { RiskMatrix, type RiskPoint } from "./RiskMatrix";
import { RiskRegister } from "./RiskRegister";
import { RiskEditor } from "./RiskEditor";
import { requestAiDrafts, type RiskAiDraft } from "./aiDraftApi";
import { AiAssistButton } from "../components/AiAssistButton";

export function TaskRiskDialog({ siteId, item, personId, editable, busy, aiEnabled, language, onClose, onError }: { siteId: string; item: WorkItem; personId?: string; editable: boolean; busy: boolean; aiEnabled: boolean; language: string; onClose: () => void; onError: (message: string) => void }) {
  const t = useTranslation();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(emptyRisk);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [assessment, setAssessment] = useState<Assessment>("before");
  const [editingAction, setEditingAction] = useState<Mitigation | null>(null);
  const [actionRisk, setActionRisk] = useState<Risk | null>(null);
  const [action, setAction] = useState({ action: "", dueDate: "" });
  const [aiDrafts, setAiDrafts] = useState<RiskAiDraft[]>([]);
  const [activeAiDraft, setActiveAiDraft] = useState<RiskAiDraft | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAssessmentRequired, setAiAssessmentRequired] = useState(false);
  const locked = busy || saving || loading || aiBusy;
  function reportError(problem: unknown, fallback: string) { const message = errorMessage(problem, fallback); setError(message); onError(message); }
  async function load() {
    setError(""); setLoading(true);
    try { setRisks(numberedRisks(await apiGet<Risk[]>(`/api/risks/sites/${siteId}/task/${item.id}`, t("risksLoadFailed")))); }
    catch (problem) { reportError(problem, t("risksLoadFailed")); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [siteId, item.id]);
  function cancelEdit() { setEditingRisk(null); setEditorOpen(false); setDraft(emptyRisk); setAiAssessmentRequired(false); setActiveAiDraft(null); }
  function editRisk(risk: Risk) {
    if (editorOpen && editingRisk?.id === risk.id) return;
    setSelectedId(risk.id); setEditingRisk(risk); setEditorOpen(true); setAssessment("before"); setAiAssessmentRequired(false); setActiveAiDraft(null);
    setDraft({ title: risk.current.title, description: risk.current.description, probability: risk.current.probability, impact: risk.current.impact, status: risk.current.status, dueDate: risk.current.dueDate ?? "", residualProbability: risk.current.residualProbability?.toString() ?? "", residualImpact: risk.current.residualImpact?.toString() ?? "", initialMitigation: "" });
  }
  function selectRisk(risk: Risk) { if (editable && personId && !locked) editRisk(risk); else setSelectedId(risk.id); }
  async function saveRisk(event: React.FormEvent) {
    event.preventDefault(); if (!personId || locked) return;
    setError(""); setSaving(true);
    try {
      const payload = { ...draft, ownerPersonId: editingRisk?.current.ownerPersonId ?? personId, dueDate: draft.dueDate || null, residualProbability: draft.residualProbability ? Number(draft.residualProbability) : null, residualImpact: draft.residualImpact ? Number(draft.residualImpact) : null };
      if (editingRisk) await apiMutate(`/api/risks/${editingRisk.id}`, "PUT", { ...payload, expectedVersion: editingRisk.current.version }, t("riskUpdateFailed"));
      else await apiMutate(`/api/risks/sites/${siteId}/task/${item.id}`, "POST", payload, t("riskSaveFailed"));
      if (activeAiDraft) setAiDrafts(current => current.filter(value => value !== activeAiDraft));
      cancelEdit(); await load();
    } catch (problem) { reportError(problem, t("riskSaveFailed")); }
    finally { setSaving(false); }
  }
  async function addAction(event: React.FormEvent) {
    event.preventDefault(); if (!personId || !actionRisk || locked) return;
    setError(""); setSaving(true);
    try {
      if (editingAction) await apiMutate(`/api/risks/mitigations/${editingAction.id}`, "PUT", { ...action, expectedVersion: editingAction.version, status: editingAction.status, ownerPersonId: editingAction.ownerPersonId, dueDate: action.dueDate || null }, t("mitigationSaveFailed"));
      else await apiMutate(`/api/risks/${actionRisk.id}/mitigations`, "POST", { ...action, status: "planned", ownerPersonId: personId, dueDate: action.dueDate || null }, t("mitigationSaveFailed"));
      const id = actionRisk.id; setActionRisk(null); setAction({ action: "", dueDate: "" });
      const latest = numberedRisks(await apiGet<Risk[]>(`/api/risks/sites/${siteId}/task/${item.id}`, t("risksLoadFailed")));
      setRisks(latest); if (editingRisk?.id === id) setEditingRisk(latest.find(risk => risk.id === id) ?? null);
    } catch (problem) { reportError(problem, t("mitigationSaveFailed")); }
    finally { setSaving(false); }
  }
  async function complete(action: Mitigation) {
    if (!personId || locked) return; setError(""); setSaving(true);
    try { await apiMutate(`/api/risks/mitigations/${action.id}`, "PUT", { expectedVersion: action.version, action: action.action, ownerPersonId: action.ownerPersonId, status: "completed", dueDate: action.dueDate }, t("mitigationCompleteFailed")); await load(); }
    catch (problem) { reportError(problem, t("mitigationCompleteFailed")); }
    finally { setSaving(false); }
  }
  function openAction(risk: Risk) { setEditingAction(null); setActionRisk(risk); setAction({ action: "", dueDate: risk.current.dueDate ?? "" }); }
  async function suggestRisks() {
    setError(""); setAiBusy(true);
    try { setAiDrafts((await requestAiDrafts<RiskAiDraft>(siteId, item.id, "risks", language)).drafts); setActiveAiDraft(null); }
    catch (problem) { reportError(problem, t("aiAssistFailed")); }
    finally { setAiBusy(false); }
  }
  function useRiskDraft(value: RiskAiDraft) {
    setEditingRisk(null); setSelectedId("draft"); setAssessment("before"); setEditorOpen(true); setAiAssessmentRequired(true); setActiveAiDraft(value);
    setDraft({ ...emptyRisk, title: value.title, description: `${t("aiRiskCause")}: ${value.cause}\n\n${t("aiRiskConsequence")}: ${value.consequence}`, dueDate: value.dueDate ?? "", initialMitigation: value.mitigation });
  }
  const points: RiskPoint[] = risks.map((risk, index) => ({ id: risk.id, number: index + 1, title: risk.current.title, probability: risk.current.probability, impact: risk.current.impact, residualProbability: risk.current.residualProbability, residualImpact: risk.current.residualImpact }));
  if (editorOpen) {
    const preview = { id: editingRisk?.id ?? "draft", number: editingRisk ? risks.findIndex(risk => risk.id === editingRisk.id) + 1 : risks.length + 1, title: draft.title || t("registerRisk"), probability: draft.probability, impact: draft.impact, residualProbability: draft.residualProbability ? Number(draft.residualProbability) : null, residualImpact: draft.residualImpact ? Number(draft.residualImpact) : null };
    const index = points.findIndex(point => point.id === preview.id);
    if (index >= 0) points[index] = preview; else points.push(preview);
  }
  return <Modal title={t("riskAndMitigations")} onClose={onClose}><div className="risk-workspace">
    <div className="risk-workspace-heading"><strong>{item.title}</strong><div className="inline-actions">{aiEnabled && editable && personId && <AiAssistButton label={aiBusy ? t("aiWorking") : t("aiRiskAction")} working={aiBusy} disabled={locked || editorOpen} onClick={() => void suggestRisks()}/>} {editable && personId && <button className="primary-button" disabled={locked} type="button" onClick={() => { setEditingRisk(null); setDraft(emptyRisk); setEditorOpen(true); setSelectedId("draft"); setAssessment("before"); setAiAssessmentRequired(false); setActiveAiDraft(null); }}>+ {t("registerRisk")}</button>}</div></div>
    {error && <p className="error-message" role="alert">{error}</p>}
    {aiDrafts.length > 0 && !editorOpen && <section className="site-detail-block ai-risk-suggestions"><div className="section-heading"><div><h3>{t("aiRiskDraft")}</h3><p className="muted">{t("aiAssistantIntro")}</p></div><strong>{aiDrafts.length}</strong></div><div className="type-list">{aiDrafts.map((value, index) => <article className="type-row" key={`${value.title}-${index}`}><span><strong>{index + 1}. {value.title}</strong><small><b>{t("aiRiskCause")}:</b> {value.cause}</small><small><b>{t("aiRiskConsequence")}:</b> {value.consequence}</small><small><b>{t("mitigationAction")}:</b> {value.mitigation}{value.dueDate ? ` · ${value.dueDate}` : ""}</small></span><div className="inline-actions"><button className="secondary-button" type="button" disabled={locked} onClick={() => setAiDrafts(current => current.filter(candidate => candidate !== value))} aria-label={t("delete")}>×</button><button className="primary-button" type="button" disabled={locked} onClick={() => useRiskDraft(value)}>{t("aiUseDraft")}</button></div></article>)}</div></section>}
    {loading ? <p role="status">{t("loading")}</p> : risks.length === 0 ? <p className="empty-state-inline">{t("noRisks")}</p> : <RiskRegister risks={risks} selectedId={selectedId} editable={editable} busy={locked} onSelect={selectRisk} onEdit={editRisk} onAddMitigation={openAction} onEditMitigation={(risk, mitigation) => { setActionRisk(risk); setEditingAction(mitigation); setAction({ action: mitigation.action, dueDate: mitigation.dueDate ?? "" }); }} onComplete={value => { void complete(value); }} />}
    {activeAiDraft && <ol className="ai-risk-flow" aria-label={t("aiRiskDraft")}><li className="complete">{t("aiRiskDraft")}</li><li className={aiAssessmentRequired ? "current" : "complete"}>{t("riskBeforeMitigation")}</li><li className={!aiAssessmentRequired ? "current" : ""}>{t("mitigationAction")}</li><li>{t("registerRisk")}</li></ol>}
    <div className={`risk-workspace-body${editorOpen ? " editing" : ""}`}><RiskMatrix points={points} selectedId={selectedId} assessment={assessment} editable={editorOpen && editable && !locked} onSelect={id => { const risk = risks.find(value => value.id === id); if (risk) selectRisk(risk); }} onAssess={(phase, probability, impact) => { setAssessment(phase); if (phase === "before") setAiAssessmentRequired(false); setDraft(current => phase === "before" ? { ...current, probability, impact } : { ...current, residualProbability: String(probability), residualImpact: String(impact) }); }} />
      {editorOpen && <div>{aiAssessmentRequired && <p className="status-message">{t("riskCalculationHelp")}</p>}<RiskEditor draft={draft} risk={editingRisk} busy={locked} saveDisabled={aiAssessmentRequired} assessment={assessment} onAssessment={setAssessment} onChange={value => { if (value.probability !== draft.probability || value.impact !== draft.impact) setAiAssessmentRequired(false); setDraft(value); }} onSubmit={saveRisk} onCancel={cancelEdit} onEditMitigation={id => { const mitigation = editingRisk?.mitigations.find(value => value.id === id); if (editingRisk && mitigation) { setActionRisk(editingRisk); setEditingAction(mitigation); setAction({ action: mitigation.action, dueDate: mitigation.dueDate ?? "" }); } }} onAddMitigation={() => { if (editingRisk) openAction(editingRisk); }} /></div>}
    </div>
  </div>
    {actionRisk && <Modal title={t("registerMitigation")} onClose={() => setActionRisk(null)}><form className="stacked-form" onSubmit={addAction}><strong>{actionRisk.current.title}</strong><div className="field"><label htmlFor="mitigation-action">{t("mitigationAction")}</label><textarea id="mitigation-action" required minLength={2} maxLength={4000} rows={3} value={action.action} onChange={event => setAction({ ...action, action: event.target.value })} /></div><div className="field"><label htmlFor="mitigation-due">{t("riskDueDate")}</label><input id="mitigation-due" type="date" value={action.dueDate} onChange={event => setAction({ ...action, dueDate: event.target.value })} /></div><p className="muted">{t(editingAction ? "riskEditVersionHelp" : "mitigationOwnerHelp")}</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setActionRisk(null)}>{t("cancel")}</button><button className="primary-button" disabled={locked}>{t("saveMitigation")}</button></div></form></Modal>}
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>{t("close")}</button></div>
  </Modal>;
}
