import { useEffect, useState } from "react";
import { apiGet } from "../api/client";
import { errorMessage } from "../api/errors";
import { translateActive as t } from "../localization";
import { Modal } from "../components/Modal";
import { importPrimaryDocument } from "./taskApi";

type Snapshot = { id: string; name: string; mediaType: string; sha256: string; sourceUrl: string | null; version: number; availableToAi: boolean; createdAt: string; canImport?: boolean; canInspect?: boolean };

export function primaryDocumentIndicator(version: number | null, loaded: boolean, failed: boolean, imported: string, notImported: string, unavailable = "?") {
  if (version !== null) return `${imported} v${version}`;
  if (failed) return unavailable;
  return loaded ? notImported : "";
}

export const primaryDocumentStructuredUrl = (siteId: string, itemId: string, snapshotId: string) =>
  `/api/work/sites/${siteId}/items/${itemId}/primary-document/${snapshotId}/structured`;

export function PrimaryDocumentButton({ siteId, itemId, referenceUrl, canImport }: { siteId: string; itemId: string; referenceUrl: string | null; canImport: boolean }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [open, setOpen] = useState(false);
  const [document, setDocument] = useState<File | null>(null), [availableToAi, setAvailableToAi] = useState(true);
  const [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false), [loadFailed, setLoadFailed] = useState(false), [message, setMessage] = useState("");
  useEffect(() => {
    setSnapshot(null); setLoaded(false); setLoadFailed(false); setMessage("");
    void apiGet<Snapshot | null>(`/api/work/sites/${siteId}/items/${itemId}/primary-document`, t("primaryDocumentImportFailed"))
      .then(setSnapshot).catch(problem => { setLoadFailed(true); setMessage(errorMessage(problem, t("primaryDocumentImportFailed"))); }).finally(() => setLoaded(true));
  }, [siteId, itemId]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!document) return; setBusy(true); setMessage("");
    try { const value = await importPrimaryDocument(siteId, itemId, document, availableToAi); setSnapshot(value); setLoadFailed(false); setOpen(false); setDocument(null); }
    catch (problem) { setMessage(errorMessage(problem, t("primaryDocumentImportFailed"))); }
    finally { setBusy(false); }
  }
  const indicator = primaryDocumentIndicator(snapshot?.version ?? null, loaded, loadFailed, t("primaryDocumentImported"), t("primaryDocumentNotImported"), t("primaryDocumentStatusUnavailable"));
  return <>
    <div className={`primary-document-indicator ${snapshot ? "imported" : loadFailed ? "failed" : "empty"}`} role="status"><span><i aria-hidden="true">{snapshot ? "✓" : loadFailed ? "!" : "○"}</i><span><strong>{t("tasksTaskClassifiersPrimaryDocument")}</strong><small>{indicator || t("loading")}</small></span></span><button className="secondary-button" type="button" onClick={() => setOpen(true)}>{t("primaryDocumentDetails")}</button></div>
    {open && <Modal title={t("tasksTaskClassifiersPrimaryDocument")} onClose={() => setOpen(false)}><form className="stacked-form" onSubmit={submit}>
      <div className="field"><label>{t("tasksTaskCreateDialogLinkToPrimaryDocumentOrTask")}</label>{referenceUrl || snapshot?.sourceUrl ? <a href={referenceUrl ?? snapshot?.sourceUrl ?? ""} target="_blank" rel="noopener noreferrer">{t("tasksTaskClassifiersPrimaryDocument")}</a> : <span className="muted">{t("none")}</span>}</div>
      {snapshot && <p className="status-message"><strong>{snapshot.name}</strong> · {t("version")} {snapshot.version} · {snapshot.availableToAi ? t("primaryDocumentAiSource") : `AI: ${t("none")}`}</p>}
      {snapshot?.canInspect && <a className="secondary-button" href={primaryDocumentStructuredUrl(siteId, itemId, snapshot.id)} target="_blank" rel="noopener noreferrer">{t("primaryDocumentOpenStructured")}</a>}
      {(canImport || snapshot?.canImport) && <><div className="field"><label htmlFor={`primary-document-${itemId}`}>{t("primaryDocumentImport")}</label><input id={`primary-document-${itemId}`} required type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={event => setDocument(event.target.files?.[0] ?? null)}/><small>{t("primaryDocumentImportHelp")}</small></div>
        <label className="checkbox-row"><input type="checkbox" checked={availableToAi} onChange={event => setAvailableToAi(event.target.checked)}/><span>{t("primaryDocumentAiSource")}</span></label></>}
      {message && <p className="error-message" role="alert">{message}</p>}
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setOpen(false)}>{t("cancel")}</button>{(canImport || snapshot?.canImport) && <button className="primary-button" disabled={busy || !document}>{t("primaryDocumentImport")}</button>}</div>
    </form></Modal>}
  </>;
}
