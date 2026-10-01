import { translateActive } from "../localization";
import { useEffect, useRef, useState } from "react";
import { apiMutate } from "../api/client";
import type { PlanningRfiEntry } from "./PlanningModels";
import { useSerializedWorkflowSave } from "./useWorkflowAutosave";

type EditableRfi = Pick<PlanningRfiEntry, "who" | "what" | "dueOn" | "answered" | "answer">;

export function PlanningRfiLog({ runId, entries, onReload, onError }: {
  runId: string;
  entries: PlanningRfiEntry[];
  onReload: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, EditableRfi>>({});
  const [busy, setBusy] = useState(false);
  const latest = useRef<Map<string, EditableRfi>>(new Map());
  const timers = useRef<Map<string, number>>(new Map());
  const enqueueSave = useSerializedWorkflowSave();

  async function save(id: string, value: EditableRfi) {
    await enqueueSave(id, () => apiMutate(`/api/workflows/planning/${runId}/rfi/${id}`, "PUT", value, translateActive("workflowsPlanningRfiLogTheRFIEntryCouldNotBe")));
    if (latest.current.get(id) === value) latest.current.delete(id);
  }

  function flush(id: string) {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    const value = latest.current.get(id);
    return value ? save(id, value).catch(problem => onError(problem instanceof Error ? problem.message : translateActive("workflowsPlanningRfiLogTheRFIEntryCouldNotBe"))) : Promise.resolve();
  }

  function change(entry: PlanningRfiEntry, update: Partial<EditableRfi>) {
    const value = { ...entry, ...drafts[entry.id], ...update };
    latest.current.set(entry.id, value);
    setDrafts(current => ({ ...current, [entry.id]: value }));
    const previous = timers.current.get(entry.id);
    if (previous !== undefined) window.clearTimeout(previous);
    timers.current.set(entry.id, window.setTimeout(() => { void flush(entry.id); }, 350));
  }

  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    for (const [id, value] of latest.current) void save(id, value).catch(problem => onError(problem instanceof Error ? problem.message : translateActive("workflowsPlanningRfiLogTheRFIEntryCouldNotBe")));
    timers.current.clear();
  }, [runId]);

  async function addEntry() {
    setBusy(true);
    try {
      await apiMutate(`/api/workflows/planning/${runId}/rfi`, "POST", undefined, translateActive("workflowsPlanningRfiLogTheRFIEntryCouldNotBeCreated"));
      await onReload();
      setOpen(true);
    } catch (problem) { onError(problem instanceof Error ? problem.message : translateActive("workflowsPlanningRfiLogTheRFIEntryCouldNotBeCreated")); }
    finally { setBusy(false); }
  }

  async function removeEntry(id: string) {
    setBusy(true);
    await flush(id);
    try {
      await apiMutate(`/api/workflows/planning/${runId}/rfi/${id}`, "DELETE", undefined, translateActive("workflowsPlanningRfiLogTheRFIEntryCouldNotBeRemoved"));
      latest.current.delete(id);
      setDrafts(current => { const next = { ...current }; delete next[id]; return next; });
      await onReload();
    } catch (problem) { onError(problem instanceof Error ? problem.message : translateActive("workflowsPlanningRfiLogTheRFIEntryCouldNotBeRemoved")); }
    finally { setBusy(false); }
  }

  return <section className="planning-rfi">
    <button type="button" className="secondary-button planning-rfi-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {translateActive("rfiTitle")}{entries.length ? ` (${entries.length})` : ""}
    </button>
    {open && <div className="planning-rfi-content">
      <div className="planning-rfi-heading"><div><h4>{translateActive("workflowsPlanningRfiLogRFILog")}</h4><p className="muted">{translateActive("workflowsPlanningRfiLogTheSameLogIsAvailableIn")}</p></div><button className="secondary-button" type="button" disabled={busy} onClick={() => void addEntry()}>{translateActive("workflowsPlanningRfiLogAddRFI")}</button></div>
      {entries.length === 0 && <p className="muted">{translateActive("workflowsPlanningRfiLogNoInquiriesAreRegistered")}</p>}
      <div className="planning-rfi-list">{entries.map(entry => {
        const value = drafts[entry.id] ?? entry;
        return <article className="planning-rfi-row" key={entry.id}>
          <div className="field rfi-who"><label htmlFor={`rfi-who-${entry.id}`}>{translateActive("tasksTaskContextDialogsWho")}</label><textarea id={`rfi-who-${entry.id}`} rows={2} maxLength={320} value={value.who} onChange={event => change(entry, { who: event.target.value })} onBlur={() => void flush(entry.id)} /></div>
          <div className="field rfi-what"><label htmlFor={`rfi-what-${entry.id}`}>{translateActive("tasksTaskContextDialogsWhat")}</label><textarea id={`rfi-what-${entry.id}`} rows={3} maxLength={10000} value={value.what} onChange={event => change(entry, { what: event.target.value })} onBlur={() => void flush(entry.id)} /></div>
          <div className="field rfi-due"><label htmlFor={`rfi-due-${entry.id}`}>{translateActive("approvalDue")}</label><input id={`rfi-due-${entry.id}`} type="date" value={value.dueOn ?? ""} onChange={event => change(entry, { dueOn: event.target.value || null })} onBlur={() => void flush(entry.id)} /></div>
          <div className="field rfi-answered"><label htmlFor={`rfi-answered-${entry.id}`}>{translateActive("requestProgressAnswered")}</label><input id={`rfi-answered-${entry.id}`} type="checkbox" checked={value.answered} onChange={event => { change(entry, { answered: event.target.checked }); }} aria-label={translateActive("workflowsPlanningRfiLogAnsweredYesOrNo")} /></div>
          <div className="field rfi-answer"><label htmlFor={`rfi-answer-${entry.id}`}>{translateActive("tasksTaskContextDialogsResponse")}</label><textarea id={`rfi-answer-${entry.id}`} rows={3} maxLength={10000} value={value.answer} onChange={event => change(entry, { answer: event.target.value })} onBlur={() => void flush(entry.id)} /></div>
          <button className="link-button planning-rfi-remove" type="button" disabled={busy} onClick={() => void removeEntry(entry.id)}>{translateActive("remove")}</button>
        </article>;
      })}</div>
    </div>}
  </section>;
}
