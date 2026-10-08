import { useEffect, useState } from "react";
import { apiGet } from "../api/client";
import { errorMessage } from "../api/errors";
import { translateActive as t } from "../localization";
import { Modal } from "../components/Modal";
import { importPrimaryDocument } from "./taskApi";

type Snapshot = { id: string; name: string; mediaType: string; sha256: string; sourceUrl: string | null; version: number; availableToAi: boolean; createdAt: string };

export function PrimaryDocumentButton({ siteId, itemId, referenceUrl }: { siteId: string; itemId: string; referenceUrl: string | null }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [open, setOpen] = useState(false);
  const [document, setDocument] = useState<File | null>(null), [availableToAi, setAvailableToAi] = useState(true);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { void apiGet<Snapshot | null>(`/api/work/sites/${siteId}/items/${itemId}/primary-document`, t("primaryDocumentImportFailed")).then(setSnapshot).catch(() => undefined); }, [siteId, itemId]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!document) return; setBusy(true); setMessage("");
    try { const value = await importPrimaryDocument(siteId, itemId, document, availableToAi); setSnapshot(value); setOpen(false); setDocument(null); }
    catch (problem) { setMessage(errorMessage(problem, t("primaryDocumentImportFailed"))); }
    finally { setBusy(false); }
  }
  return <>
    <button className="task-icon-action" type="button" onClick={() => setOpen(true)}><i aria-hidden="true">▤</i><span>{t("tasksTaskClassifiersPrimaryDocument")}{snapshot ? ` (v${snapshot.version})` : ""}</span></button>
    {open && <Modal title={t("tasksTaskClassifiersPrimaryDocument")} onClose={() => setOpen(false)}><form className="stacked-form" onSubmit={submit}>
      <div className="field"><label>{t("tasksTaskCreateDialogLinkToPrimaryDocumentOrTask")}</label>{referenceUrl || snapshot?.sourceUrl ? <a href={referenceUrl ?? snapshot?.sourceUrl ?? ""} target="_blank" rel="noopener noreferrer">{t("tasksTaskClassifiersPrimaryDocument")}</a> : <span className="muted">{t("none")}</span>}</div>
      {snapshot && <p className="status-message"><strong>{snapshot.name}</strong> · v{snapshot.version}</p>}
      <div className="field"><label htmlFor={`primary-document-${itemId}`}>{t("primaryDocumentImport")}</label><input id={`primary-document-${itemId}`} required type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={event => setDocument(event.target.files?.[0] ?? null)}/><small>{t("primaryDocumentImportHelp")}</small></div>
      <label className="checkbox-row"><input type="checkbox" checked={availableToAi} onChange={event => setAvailableToAi(event.target.checked)}/><span>{t("primaryDocumentAiSource")}</span></label>
      {message && <p className="error-message" role="alert">{message}</p>}
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setOpen(false)}>{t("cancel")}</button><button className="primary-button" disabled={busy || !document}>{t("primaryDocumentImport")}</button></div>
    </form></Modal>}
  </>;
}
