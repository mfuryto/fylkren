import { useEffect, useState } from "react";
import type React from "react";
import { apiGet, apiMutate } from "../api/client";
import { errorMessage } from "../api/errors";
import { EnterpriseRequiredNotice } from "../components/EnterpriseRequiredNotice";
import { Modal } from "../components/Modal";
import { PaginationNav } from "../components/PaginationNav";
import { useTranslation } from "../localization/LocalizationProvider";

type Site = { id: string; name: string };
type Catalogue = { eventType: string; schemaVersion: number };
type Subscription = { id: string; name: string; endpointUrl: string; eventTypes: string; isActive: boolean; createdAt: string };
type Delivery = { id: string; subscriptionName: string; eventType: string; status: string; attemptCount: number; lastHttpStatus: number | null; lastError: string | null; createdAt: string };

export function WebhookSettings({ canManage = true }: { canManage?: boolean }) {
  const t = useTranslation();
  const [sites, setSites] = useState<Site[]>([]), [catalogue, setCatalogue] = useState<Catalogue[]>([]), [subscriptions, setSubscriptions] = useState<Subscription[]>([]), [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [siteId, setSiteId] = useState(""), [open, setOpen] = useState(false), [name, setName] = useState(""), [url, setUrl] = useState(""), [events, setEvents] = useState<string[]>([]), [secret, setSecret] = useState<string | null>(null), [message, setMessage] = useState("");
  const [deliveryPage, setDeliveryPage] = useState(1), [deliveryTotal, setDeliveryTotal] = useState(0);
  useEffect(() => { Promise.all([apiGet<Site[]>("/api/platform/webhooks/sites", t("webhookSitesLoadFailed")), apiGet<Catalogue[]>("/api/platform/webhooks/catalog", t("webhookCatalogLoadFailed"))]).then(([siteValues, catalogueValues]) => { setSites(siteValues); setCatalogue(catalogueValues); setSiteId(siteValues[0]?.id ?? ""); setEvents(catalogueValues.map(value => value.eventType)); }).catch(error => setMessage(errorMessage(error, t("webhookSetupLoadFailed")))); }, []);
  async function load(id: string, page = deliveryPage) {
    if (!id) return;
    const [subscriptionValues, deliveryValues] = await Promise.all([apiGet<Subscription[]>(`/api/platform/webhooks/sites/${id}`, t("webhooksLoadFailed")), apiGet<{ items: Delivery[]; total: number }>(`/api/platform/webhooks/sites/${id}/deliveries?page=${page}`, t("webhookDeliveriesLoadFailed"))]);
    setSubscriptions(subscriptionValues); setDeliveries(deliveryValues.items); setDeliveryTotal(deliveryValues.total);
  }
  useEffect(() => { setDeliveryPage(1); void load(siteId, 1).catch(error => setMessage(errorMessage(error, t("webhookSetupLoadFailed")))); }, [siteId]);
  useEffect(() => { if (siteId) void load(siteId, deliveryPage).catch(error => setMessage(errorMessage(error, t("webhookDeliveriesLoadFailed")))); }, [deliveryPage]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    try { const result = await apiMutate<{ secret: string }>(`/api/platform/webhooks/sites/${siteId}`, "POST", { name, endpointUrl: url, eventTypes: events }, t("webhookCreateFailed")); setOpen(false); setSecret(result.secret); setName(""); setUrl(""); await load(siteId); }
    catch (error) { setMessage(errorMessage(error, t("webhookCreateFailed"))); }
  }
  async function deactivate(id: string) {
    try { await apiMutate(`/api/platform/webhooks/sites/${siteId}/${id}`, "DELETE", undefined, t("webhookDeactivateFailed")); await load(siteId); }
    catch (error) { setMessage(errorMessage(error, t("webhookDeactivateFailed"))); }
  }
  return <section className="panel"><div className="section-heading"><div><h2>{t("webhooks")}</h2><p className="muted">{t("webhooksIntro")}</p></div><button className="primary-button" type="button" disabled={!siteId || !canManage} onClick={() => setOpen(true)}>{t("newWebhook")}</button></div>
    {!canManage && <EnterpriseRequiredNotice>{t("webhooksEnterpriseNotice")}</EnterpriseRequiredNotice>}
    {message && <p className="status-message">{message}</p>}<div className="field"><label htmlFor="webhook-site">{t("site")}</label><select id="webhook-site" value={siteId} onChange={event => setSiteId(event.target.value)}>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
    <div className="admin-list">{subscriptions.length === 0 ? <p className="empty-state">{t("noWebhooks")}</p> : subscriptions.map(subscription => <div className="admin-list-row" key={subscription.id}><span><strong>{subscription.name}</strong><small>{subscription.endpointUrl}</small><small>{subscription.eventTypes.split(" ").join(", ")}</small></span><div className="inline-actions"><span>{subscription.isActive ? t("active") : t("inactive")}</span>{subscription.isActive && <button className="secondary-button danger" type="button" onClick={() => void deactivate(subscription.id)}>{t("deactivate")}</button>}</div></div>)}</div>
    <div className="section-heading"><div><h3>{t("deliveryHistory")}</h3><p className="muted">{t("deliveryHistoryIntro")}</p></div></div><div className="admin-list">{deliveries.length === 0 ? <p className="empty-state">{t("noDeliveries")}</p> : deliveries.map(delivery => <div className="admin-list-row" key={delivery.id}><span><strong>{delivery.eventType}</strong><small>{delivery.subscriptionName} · {delivery.status} · {t("attempts", { count: delivery.attemptCount })}{delivery.lastHttpStatus ? ` · HTTP ${delivery.lastHttpStatus}` : ""}</small>{delivery.lastError && <small>{delivery.lastError}</small>}</span></div>)}</div><PaginationNav page={deliveryPage} totalItems={deliveryTotal} onPageChange={setDeliveryPage} label={t("webhookDeliveries")} />
    {open && <Modal title={t("createWebhook")} onClose={() => setOpen(false)}><form className="stacked-form" onSubmit={create}><div className="field"><label>{t("name")}</label><input required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></div><div className="field"><label>{t("httpsAddress")}</label><input required type="url" placeholder="https://integration.example/webhooks" value={url} onChange={event => setUrl(event.target.value)} /></div><div className="site-detail-block"><strong>{t("events")}</strong>{catalogue.map(item => <label className="checkbox-row" key={item.eventType}><input type="checkbox" checked={events.includes(item.eventType)} onChange={event => setEvents(values => event.target.checked ? [...values, item.eventType] : values.filter(value => value !== item.eventType))} /><span><code>{item.eventType}</code> · v{item.schemaVersion}</span></label>)}</div><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setOpen(false)}>{t("cancel")}</button><button className="primary-button" disabled={!name.trim() || !url || events.length === 0}>{t("create")}</button></div></form></Modal>}
    {secret && <Modal title={t("saveSigningKeyNow")} dismissible={false} onClose={() => setSecret(null)}><p>{t("signingKeyOneTime")}</p><textarea className="api-secret" readOnly rows={3} value={secret} onFocus={event => event.currentTarget.select()} /><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => void navigator.clipboard.writeText(secret)}>{t("copy")}</button><button className="primary-button" type="button" onClick={() => setSecret(null)}>{t("signingKeyStored")}</button></div></Modal>}
  </section>;
}
