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
    await enqueueSave(id, () => apiMutate(`/api/workflows/planning/${runId}/rfi/${id}`, "PUT", value, "The RFI entry could not be saved."));
    if (latest.current.get(id) === value) latest.current.delete(id);
  }

  function flush(id: string) {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    const value = latest.current.get(id);
    return value ? save(id, value).catch(problem => onError(problem instanceof Error ? problem.message : "The RFI entry could not be saved.")) : Promise.resolve();
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
    for (const [id, value] of latest.current) void save(id, value).catch(problem => onError(problem instanceof Error ? problem.message : "The RFI entry could not be saved."));
    timers.current.clear();
  }, [runId]);

  async function addEntry() {
    setBusy(true);
    try {
      await apiMutate(`/api/workflows/planning/${runId}/rfi`, "POST", undefined, "The RFI entry could not be created.");
      await onReload();
      setOpen(true);
    } catch (problem) { onError(problem instanceof Error ? problem.message : "The RFI entry could not be created."); }
    finally { setBusy(false); }
  }

  async function removeEntry(id: string) {
    setBusy(true);
    await flush(id);
    try {
      await apiMutate(`/api/workflows/planning/${runId}/rfi/${id}`, "DELETE", undefined, "The RFI entry could not be removed.");
      latest.current.delete(id);
      setDrafts(current => { const next = { ...current }; delete next[id]; return next; });
      await onReload();
    } catch (problem) { onError(problem instanceof Error ? problem.message : "The RFI entry could not be removed."); }
    finally { setBusy(false); }
  }

  return <section className="planning-rfi">
    <button type="button" className="secondary-button planning-rfi-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      RFI · Request for information{entries.length ? ` (${entries.length})` : ""}
    </button>
    {open && <div className="planning-rfi-content">
      <div className="planning-rfi-heading"><div><h4>RFI log</h4><p className="muted">The same log is available in every planning step. Changes are saved automatically.</p></div><button className="secondary-button" type="button" disabled={busy} onClick={() => void addEntry()}>Add RFI</button></div>
      {entries.length === 0 && <p className="muted">No enquiries are registered.</p>}
      <div className="planning-rfi-list">{entries.map(entry => {
        const value = drafts[entry.id] ?? entry;
        return <article className="planning-rfi-row" key={entry.id}>
          <div className="field rfi-who"><label htmlFor={`rfi-who-${entry.id}`}>Who</label><textarea id={`rfi-who-${entry.id}`} rows={2} maxLength={320} value={value.who} onChange={event => change(entry, { who: event.target.value })} onBlur={() => void flush(entry.id)} /></div>
          <div className="field rfi-what"><label htmlFor={`rfi-what-${entry.id}`}>What</label><textarea id={`rfi-what-${entry.id}`} rows={3} maxLength={10000} value={value.what} onChange={event => change(entry, { what: event.target.value })} onBlur={() => void flush(entry.id)} /></div>
          <div className="field rfi-due"><label htmlFor={`rfi-due-${entry.id}`}>Due date</label><input id={`rfi-due-${entry.id}`} type="date" value={value.dueOn ?? ""} onChange={event => change(entry, { dueOn: event.target.value || null })} onBlur={() => void flush(entry.id)} /></div>
          <div className="field rfi-answered"><label htmlFor={`rfi-answered-${entry.id}`}>Answered</label><input id={`rfi-answered-${entry.id}`} type="checkbox" checked={value.answered} onChange={event => { change(entry, { answered: event.target.checked }); }} aria-label="Answered yes or no" /></div>
          <div className="field rfi-answer"><label htmlFor={`rfi-answer-${entry.id}`}>Response</label><textarea id={`rfi-answer-${entry.id}`} rows={3} maxLength={10000} value={value.answer} onChange={event => change(entry, { answer: event.target.value })} onBlur={() => void flush(entry.id)} /></div>
          <button className="link-button planning-rfi-remove" type="button" disabled={busy} onClick={() => void removeEntry(entry.id)}>Remove</button>
        </article>;
      })}</div>
    </div>}
  </section>;
}
