import { useEffect, useId, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { useTranslation } from "../localization/LocalizationProvider";

type Receipt = { id: string; createdAt: string; packageSha256: string; packageBytes: number; version: number; acknowledgedAt: string | null };
export function ExportHandoff({ siteId }: { siteId: string }) {
  const t = useTranslation(); const field = useId(); const root = `/api/portability/sites/${siteId}/exports`;
  const [receipts, setReceipts] = useState<Receipt[]>([]); const [selected, setSelected] = useState(""); const [file, setFile] = useState<File>();
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  useEffect(() => { let current = true; apiGet<Receipt[]>(root, t("activityLoadFailed")).then(value => { if (current) { setReceipts(value); setSelected(value[0]?.id ?? ""); } }).catch(e => { if (current) setError(e.message); }); return () => { current = false; }; }, [root, t]);
  const receipt = receipts.find(r => r.id === selected);
  async function confirm() {
    if (!receipt || !file || busy || !reason.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (file.size !== receipt.packageBytes || file.size > 16 * 1024 * 1024) throw new Error(t("preservationDigestMismatch"));
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))].map(b => b.toString(16).padStart(2, "0")).join("");
      if (digest !== receipt.packageSha256) throw new Error(t("preservationDigestMismatch"));
      await apiMutate(`${root}/${receipt.id}/acknowledge`, "POST", { expectedVersion: receipt.version, packageSha256: digest, reason: reason.replace(/[\r\n\t]+/g, " ").trim() }, t("siteActionFailed"));
      setReceipts(await apiGet<Receipt[]>(root, t("activityLoadFailed"))); setNotice(t("preservationHandoffRecorded")); setFile(undefined); setReason("");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <details onToggle={e => { if (e.currentTarget.open) void apiGet<Receipt[]>(root, t("activityLoadFailed")).then(value => { setReceipts(value); setSelected(value[0]?.id ?? ""); }).catch(e => setError(e.message)); }}><summary>{t("preservationConfirmExport")}</summary><div className="stacked-form">
    <p className="muted">{t("preservationExportHelp")}</p>{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <div className="field"><label htmlFor={`${field}-export`}>{t("export")}</label><select id={`${field}-export`} value={selected} onChange={e => { setSelected(e.target.value); setFile(undefined); setNotice(""); }}>{receipts.map(r => <option key={r.id} value={r.id}>{new Date(r.createdAt).toLocaleString()}{r.acknowledgedAt ? ` · ${t("preservationHandoffRecorded")}` : ""}</option>)}</select></div>
    {receipt && !receipt.acknowledgedAt && <><div className="field"><label htmlFor={`${field}-file`}>ZIP</label><input id={`${field}-file`} type="file" accept=".zip,application/zip" disabled={busy} onChange={e => setFile(e.target.files?.[0])} /></div><div className="field"><label htmlFor={`${field}-reason`}>{t("lifecycleReason")}: {t("preservationConfirmExport")}</label><textarea id={`${field}-reason`} rows={2} maxLength={1000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></div><button type="button" disabled={busy || !file || !reason.trim()} onClick={() => void confirm()}>{t("preservationConfirmExport")}</button></>}
  </div></details>;
}
