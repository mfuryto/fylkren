import { useEffect, useId, useState } from "react";
import { apiGet, apiRequest, getAntiforgeryToken } from "../api/client";
import { useTranslation } from "../localization/LocalizationProvider";
import { ExportHandoff } from "./ExportHandoff";
import { ActivityTimeline } from "./ActivityTimeline";

type Archive = { siteId: string; name: string; canExport: boolean; stage: string };
type Work = { id: string; referenceCode: string; title: string; description: string; status: string; finalReport?: string | null };
export function ArchivePage({ timeZone }: { timeZone: string }) {
  const t = useTranslation(); const field = useId();
  const [archives, setArchives] = useState<Archive[]>([]); const [siteId, setSiteId] = useState(""); const [items, setItems] = useState<Work[]>([]);
  const [after, setAfter] = useState<string>(); const [next, setNext] = useState<string | null>(null); const [open, setOpen] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    apiGet<Archive[]>("/api/information/archives", t("activityLoadFailed"), { signal: controller.signal }).then(value => { setArchives(value); setSiteId(value[0]?.siteId ?? ""); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [t]);
  useEffect(() => {
    if (!siteId) return;
    const controller = new AbortController(); setError(""); setItems([]);
    apiGet<{ items: Work[]; next: string | null }>(`/api/information/archives/${siteId}/work-items${after ? `?afterId=${after}` : ""}`, t("activityLoadFailed"), { signal: controller.signal }).then(data => { setItems(data.items); setNext(data.next); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [siteId, after, t]);
  async function download() {
    try {
      const token = await getAntiforgeryToken();
      const response = await apiRequest(`/api/portability/sites/${siteId}/export`, t("siteActionFailed"), { method: "POST", headers: { "X-Fylkren-CSRF": token } });
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = `fylkren-${siteId}-archive.zip`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError((e as Error).message); }
  }
  return <section><h1>{t("navArchives")}</h1>{error && <p role="alert">{error}</p>}{loading && <p role="status">{t("loading")}</p>}
    {!loading && archives.length === 0 && <p>{t("archiveNoSites")}</p>}
    {archives.length > 0 && <><div className="report-toolbar"><div className="field"><label htmlFor={field}>{t("site")}</label><select id={field} value={siteId} onChange={e => { setSiteId(e.target.value); setAfter(undefined); setOpen(""); }}>{archives.map(a => <option key={a.siteId} value={a.siteId}>{a.name}</option>)}</select></div>{archives.find(a => a.siteId === siteId)?.canExport && <button type="button" className="secondary-button" onClick={() => void download()}>{t("export")}</button>}</div>
      {siteId && archives.find(a => a.siteId === siteId)?.canExport && <ExportHandoff key={`handoff-${siteId}`} siteId={siteId} />}
      {siteId && <ActivityTimeline key={siteId} siteId={siteId} archive timeZone={timeZone} />}
      <ul>{items.map(item => <li key={item.id}><button className="text-button" type="button" aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? "" : item.id)}>{item.referenceCode} · {item.title}</button>{open === item.id && <article><p>{item.description}</p>{item.finalReport && <pre style={{ whiteSpace: "pre-wrap" }}>{item.finalReport}</pre>}</article>}</li>)}</ul>
      {after && <button type="button" className="text-button" onClick={() => setAfter(undefined)}>{t("previous")}</button>}{next && <button type="button" className="text-button" onClick={() => setAfter(next)}>{t("next")}</button>}
    </>}
  </section>;
}
