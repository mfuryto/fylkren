import { translateActive } from "../localization";
import { useEffect, useState } from "react";
import { Modal } from "../components/Modal";
import type { DecisionRevision, DomainDecision, WorkItem } from "../work/WorkItemModels";
import { getTaskDecisions } from "./taskApi";
import { requestAiDrafts, type DecisionAiDraft } from "./aiDraftApi";
import { errorMessage } from "../api/errors";

const statusLabel = (status: string) => ({
  draft: translateActive("tasksTaskDomainDecisionDialogDraft"),
  recorded: translateActive("approvalDecided"),
  withdrawn: translateActive("decisionStatusWithdrawn"),
} as Record<string, string>)[status] ?? status;

type Draft = { title: string; decision: string; rationale: string; status: "draft" | "recorded" | "withdrawn" };
type Editor = { decisionId: string | null; expectedRevision: number | null; value: Draft };
const emptyDraft = (): Draft => ({ title: "", decision: "", rationale: "", status: "draft" });
export const decisionWorkflowActions = (status: string) => ({
  canRecord: status === "draft",
  canDeleteDraft: status === "draft",
  canWithdraw: status === "recorded",
});

export function TaskDomainDecisionDialog({ siteId, item, personId, editable, busy, aiEnabled, language, timeZone, onClose, onRecord, onRevise, onError }: {
  siteId: string;
  item: WorkItem;
  personId?: string;
  editable: boolean;
  busy: boolean;
  aiEnabled: boolean;
  language: string;
  timeZone: string;
  onClose: () => void;
  onRecord: (draft: Draft) => Promise<boolean>;
  onRevise: (decisionId: string, expectedRevision: number, draft: Draft) => Promise<boolean>;
  onError: (message: string) => void;
}) {
  const [decisions, setDecisions] = useState<DomainDecision[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [aiDrafts, setAiDrafts] = useState<DecisionAiDraft[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  async function load() {
    try { setDecisions(await getTaskDecisions(siteId, item.id)); }
    catch (problem) { onError(problem instanceof Error ? problem.message : translateActive("tasksTaskDomainDecisionDialogDecisionsCouldNotBeLoaded")); }
  }
  useEffect(() => { void load(); }, [siteId, item.id]);
  function openEditor(decision?: DomainDecision, suggestion?: DecisionAiDraft) {
    const current = decision?.current;
    setEditor({
      decisionId: decision?.id ?? null,
      expectedRevision: current?.revisionNumber ?? null,
      value: suggestion ? { ...suggestion, status: "draft" } : current
        ? { title: current.title, decision: current.decision, rationale: current.rationale, status: current.status === "recorded" ? "recorded" : "draft" }
        : emptyDraft(),
    });
  }
  async function save(status: "draft" | "recorded") {
    if (!editor) return;
    const value = { ...editor.value, status };
    const saved = editor.decisionId && editor.expectedRevision !== null
      ? await onRevise(editor.decisionId, editor.expectedRevision, value)
      : await onRecord(value);
    if (saved) { setEditor(null); setAiDrafts([]); await load(); }
  }
  async function changeStatus(decision: DomainDecision, status: "recorded" | "withdrawn") {
    const current = decision.current;
    if (await onRevise(decision.id, current.revisionNumber, { title: current.title, decision: current.decision, rationale: current.rationale, status })) await load();
  }
  async function suggestDecisions() {
    setAiBusy(true);
    try { setAiDrafts((await requestAiDrafts<DecisionAiDraft>(siteId, item.id, "decisions", language)).drafts); }
    catch (problem) { onError(errorMessage(problem, translateActive("aiAssistFailed"))); }
    finally { setAiBusy(false); }
  }
  const active = decisions.filter(value => value.current.status !== "withdrawn");
  const withdrawn = decisions.filter(value => value.current.status === "withdrawn");
  const valid = editor && editor.value.title.trim().length >= 2 && editor.value.decision.trim().length >= 2 && editor.value.rationale.trim().length >= 2;
  const date = (value: string) => new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
  const decisionCard = (value: DomainDecision) => <details key={value.id} className="returned-report treatment-history-section">
    <summary><span>{value.current.title}</span><small>{statusLabel(value.current.status)} · {date(value.current.decidedAt)}</small></summary>
    <div className="domain-decision-content"><p><strong>{translateActive("approvalDecision")}</strong><br />{value.current.decision}</p><p><strong>{translateActive("approvalRationale")}</strong><br />{value.current.rationale}</p><p className="muted"><strong>{translateActive("tasksTaskDomainDecisionDialogDecisionMaker")}</strong> {value.current.decisionMakers.map(maker => maker.displayName).join(", ")}<br /><strong>{translateActive("tasksTaskDomainDecisionDialogStableID")}</strong> {value.id}</p>
      {editable && <div className="inline-actions">
        <button className="secondary-button" type="button" disabled={busy} onClick={() => openEditor(value)}>{translateActive("decisionChangeAction")}</button>
        {decisionWorkflowActions(value.current.status).canRecord && <button className="primary-button" type="button" disabled={busy || !personId} onClick={() => void changeStatus(value, "recorded")}>{translateActive("tasksTaskDomainDecisionDialogRecordDecision")}</button>}
        {decisionWorkflowActions(value.current.status).canDeleteDraft && <button className="secondary-button danger" type="button" disabled={busy || !personId} onClick={() => void changeStatus(value, "withdrawn")}>{translateActive("decisionDeleteDraft")}</button>}
        {decisionWorkflowActions(value.current.status).canWithdraw && <button className="secondary-button danger" type="button" disabled={busy || !personId} onClick={() => void changeStatus(value, "withdrawn")}>{translateActive("decisionWithdrawAction")}</button>}
      </div>}
      {value.revisions.length > 1 && <details><summary>{translateActive("tasksTaskDomainDecisionDialogPreviousVersions")}{value.revisions.length - 1})</summary>{value.revisions.slice(1).map((revision: DecisionRevision) => <article className="decision-revision" key={revision.id}><strong>{translateActive("version")} {revision.revisionNumber}: {revision.title}</strong><p>{revision.decision}</p><p className="muted">{revision.recordedBy} · {date(revision.recordedAt)}</p></article>)}</details>}
    </div>
  </details>;
  return <Modal title={translateActive("tasksTaskCardPresentationDecisions")} onClose={onClose}>
    <p className="muted">{translateActive("tasksTaskDomainDecisionDialogFormalDecisionsLinkedTo")}{item.title}{translateActive("tasksTaskDomainDecisionDialogDecisionsAreHistoricalRecordsAndAre")}</p>
    {editable && <div className="inline-actions"><button className="primary-button" type="button" disabled={busy} onClick={() => openEditor()}>+ {translateActive("decisionNewDraft")}</button>{aiEnabled && <button className="secondary-button" type="button" disabled={busy || aiBusy} onClick={() => void suggestDecisions()}>✦ {aiBusy ? translateActive("aiWorking") : translateActive("aiDecisionDraft")}</button>}</div>}
    {editor && editable && <section className="site-detail-block"><form className="domain-decision-form" onSubmit={event => event.preventDefault()}>
      <div className="section-heading"><h3>{editor.decisionId ? translateActive("decisionEditDraft") : translateActive("decisionNewDraft")}</h3><button className="text-button" type="button" onClick={() => setEditor(null)}>{translateActive("cancelEditing")}</button></div>
      <div className="field"><label htmlFor="decision-title">{translateActive("approvalTitle")}</label><input id="decision-title" value={editor.value.title} maxLength={200} required onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, title: event.target.value } } : current)} /></div>
      <div className="field"><label htmlFor="decision-text">{translateActive("approvalDecision")}</label><textarea id="decision-text" value={editor.value.decision} maxLength={10000} required onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, decision: event.target.value } } : current)} /></div>
      <div className="field"><label htmlFor="decision-rationale">{translateActive("approvalRationale")}</label><textarea id="decision-rationale" value={editor.value.rationale} maxLength={10000} required onChange={event => setEditor(current => current ? { ...current, value: { ...current.value, rationale: event.target.value } } : current)} /></div>
      <p className="muted">{translateActive("tasksTaskDomainDecisionDialogYouAreRegisteredAsADecision")}{personId ? "" : translateActive("tasksTaskDomainDecisionDialogTheUserIdentityCouldNotBe")}</p>
      <div className="modal-actions"><button className="secondary-button" type="button" disabled={busy || !personId || !valid} onClick={() => void save("draft")}>{translateActive("decisionSaveDraft")}</button><button className="primary-button" type="button" disabled={busy || !personId || !valid} onClick={() => void save("recorded")}>{translateActive("tasksTaskDomainDecisionDialogRecordDecision")}</button></div>
    </form></section>}
    {aiDrafts.length > 0 && <section className="site-detail-block"><h3>{translateActive("aiDecisionDraft")}</h3><p className="muted">{translateActive("decisionAiSuggestionIntro")}</p><div className="type-list">{aiDrafts.map((value, index) => <article className="type-row" key={`${value.title}-${index}`}><span><strong>{value.title}</strong><small>{value.decision}</small><small>{value.rationale}</small></span><button className="secondary-button" type="button" onClick={() => openEditor(undefined, value)}>{translateActive("aiUseDraft")}</button></article>)}</div></section>}
    {active.length === 0 ? <p className="empty-list-message">{translateActive("tasksTaskDomainDecisionDialogNoDecisionsAreRegistered")}</p> : <div className="domain-decision-list">{active.map(decisionCard)}</div>}
    {withdrawn.length > 0 && <details className="returned-report treatment-history-section"><summary><span>{translateActive("decisionWithdrawnHistory")}</span><small>{withdrawn.length}</small></summary><div className="domain-decision-list">{withdrawn.map(decisionCard)}</div></details>}
    <p className="muted">{translateActive("decisionDraftRemovalHelp")}</p>
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>{translateActive("close")}</button></div>
  </Modal>;
}

export type { Draft as DomainDecisionDraft };
