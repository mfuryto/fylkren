import { useEffect, useState } from "react";
import { Modal } from "../components/Modal";
import type { DomainDecision, WorkItem } from "../work/WorkItemModels";
import { getTaskDecisions } from "./taskApi";

const statusLabels: Record<string, string> = { draft: "Utkast", recorded: "Besluttet", withdrawn: "Trukket" };
type Draft = { title: string; decision: string; rationale: string; status: "draft" | "recorded" };

export function TaskDomainDecisionDialog({ siteId, item, personId, editable, busy, language, timeZone, onClose, onRecord, onError }: {
  siteId: string;
  item: WorkItem;
  personId?: string;
  editable: boolean;
  busy: boolean;
  language: string;
  timeZone: string;
  onClose: () => void;
  onRecord: (draft: Draft) => Promise<boolean>;
  onError: (message: string) => void;
}) {
  const [decisions, setDecisions] = useState<DomainDecision[]>([]);
  const [draft, setDraft] = useState<Draft>({ title: "", decision: "", rationale: "", status: "recorded" });
  async function load() {
    try { setDecisions(await getTaskDecisions(siteId, item.id)); }
    catch (problem) { onError(problem instanceof Error ? problem.message : "Beslutningene kunne ikke lastes."); }
  }
  useEffect(() => { void load(); }, [siteId, item.id]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (await onRecord(draft)) { setDraft({ title: "", decision: "", rationale: "", status: "recorded" }); await load(); }
  }
  return <Modal title="Beslutninger" onClose={onClose}>
    <p className="muted">Formelle beslutninger knyttet til «{item.title}». Beslutninger er historiske poster og er adskilt fra den tekniske revisjonsloggen.</p>
    {decisions.length === 0 ? <p className="empty-list-message">Ingen beslutninger er registrert.</p> : <div className="domain-decision-list">{decisions.map(value => <details key={value.id} className="returned-report treatment-history-section">
      <summary><span>{value.current.title}</span><small>{statusLabels[value.current.status] ?? value.current.status} · {new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value.current.decidedAt))}</small></summary>
      <div className="domain-decision-content"><p><strong>Beslutning</strong><br />{value.current.decision}</p><p><strong>Begrunnelse</strong><br />{value.current.rationale}</p><p className="muted"><strong>Beslutningstaker:</strong> {value.current.decisionMakers.map(maker => maker.displayName).join(", ")}<br /><strong>Stabil ID:</strong> {value.id}</p>
        {value.revisions.length > 1 && <details><summary>Tidligere versjoner ({value.revisions.length - 1})</summary>{value.revisions.slice(1).map(revision => <article className="decision-revision" key={revision.id}><strong>Versjon {revision.revisionNumber}: {revision.title}</strong><p>{revision.decision}</p><p className="muted">{revision.recordedBy} · {new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(revision.recordedAt))}</p></article>)}</details>}
      </div>
    </details>)}</div>}
    {editable && <form className="domain-decision-form" onSubmit={submit}>
      <h3>Registrer beslutning</h3>
      <div className="field"><label htmlFor="decision-title">Tittel</label><input id="decision-title" value={draft.title} maxLength={200} required onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} /></div>
      <div className="field"><label htmlFor="decision-text">Beslutning</label><textarea id="decision-text" value={draft.decision} maxLength={10000} required onChange={event => setDraft(current => ({ ...current, decision: event.target.value }))} /></div>
      <div className="field"><label htmlFor="decision-rationale">Begrunnelse</label><textarea id="decision-rationale" value={draft.rationale} maxLength={10000} required onChange={event => setDraft(current => ({ ...current, rationale: event.target.value }))} /></div>
      <div className="field"><label htmlFor="decision-status">Status</label><select id="decision-status" value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as Draft["status"] }))}><option value="recorded">Besluttet</option><option value="draft">Utkast</option></select></div>
      <p className="muted">Du registreres som beslutningstaker. Modellen støtter flere beslutningstakere gjennom API-et.{personId ? "" : " Brukeridentiteten kunne ikke forhåndsutfylles."}</p>
      <button className="primary-button" type="submit" disabled={busy || !personId || draft.title.trim().length < 2 || draft.decision.trim().length < 2 || draft.rationale.trim().length < 2}>Registrer beslutning</button>
    </form>}
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Lukk</button></div>
  </Modal>;
}

export type { Draft as DomainDecisionDraft };
