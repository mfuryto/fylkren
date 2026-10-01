import { useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "../api/errors";
import { Modal } from "../components/Modal";
import { EnterpriseRequiredNotice } from "../components/EnterpriseRequiredNotice";
import { useLanguage, useTranslation } from "../localization/LocalizationProvider";
import { loadSites } from "../siteAdmin/siteAdminApi";
import type { SiteSummary } from "../siteAdmin/models";
import {
  approveFederationPeerRecovery, createFederationIdentity, createFederationKeyRotation,
  createFederationPeer, discoverFederationPeer, loadFederationIdentity,
  loadFederationRouting, setFederationRouting,
  loadFederationDeliveries, loadFederationPeers,
  loadFederationRemoteSites,
  probeFederationPeer, recoverFederationIdentity,
  discoverFederationPeerRecovery,
  syncFederationCatalog, retryFederationDelivery,
  type FederationDeliveries, type FederationIdentity,
  type FederationPeer, type FederationPeerDiscovery, type FederationRouting,
  type FederationRemoteSite,
} from "./federationApi";

export function FederationPage({ canManage }: { canManage: boolean }) {
  const t = useTranslation();
  const language = useLanguage();
  const [identity, setIdentity] = useState<FederationIdentity | null>(null);
  const [routing, setRouting] = useState<FederationRouting | null>(null);
  const [peers, setPeers] = useState<FederationPeer[]>([]);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [remoteSites, setRemoteSites] = useState<FederationRemoteSite[]>([]);
  const [deliveries, setDeliveries] = useState<FederationDeliveries | null>(null);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [discovery, setDiscovery] = useState<FederationPeerDiscovery | null>(null);
  const [fingerprintConfirmed, setFingerprintConfirmed] = useState(false);
  const [recoveryDiscovery, setRecoveryDiscovery] = useState<FederationPeerDiscovery | null>(null);
  const [recoveryFingerprintConfirmed, setRecoveryFingerprintConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [routingConfirmed, setRoutingConfirmed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const selected = peers.find(peer => peer.instanceId === selectedId);
  const topSites = sites.filter(site => site.isActive && site.parentOrganizationUnitId === null);
  const routingBlockers = new Set(routing?.blockers ?? []);

  async function refresh() {
    const [nextIdentity, nextRouting, nextPeers, nextSites] = await Promise.all([
      loadFederationIdentity(), loadFederationRouting(), loadFederationPeers(), loadSites(),
    ]);
    setIdentity(nextIdentity);
    setRouting(nextRouting);
    setPeers(nextPeers);
    setSites(nextSites);
    setSelectedId(current => nextPeers.some(peer => peer.instanceId === current)
      ? current : nextPeers[0]?.instanceId ?? "");
  }

  async function refreshPeer(id: string) {
    if (!id) { setRemoteSites([]); setDeliveries(null); return; }
    const [nextRemoteSites, nextDeliveries] = await Promise.all([
      loadFederationRemoteSites(id), loadFederationDeliveries(id),
    ]);
    setRemoteSites(nextRemoteSites);
    setDeliveries(nextDeliveries);
  }

  useEffect(() => {
    void refresh().catch(error => setMessage(errorMessage(error, t("federationSetupLoadFailed"))));
  }, []);
  useEffect(() => {
    if (!identity?.keyRotationPending) return;
    const timer = window.setInterval(() => {
      void refresh().catch(error => setMessage(errorMessage(error,
        t("federationRotationStatusFailed"))));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [identity?.keyRotationPending]);
  useEffect(() => {
    let current = true;
    setRemoteSites([]);
    setDeliveries(null);
    setRecoveryDiscovery(null);
    setRecoveryFingerprintConfirmed(false);
    if (selectedId) {
      void Promise.all([
        loadFederationRemoteSites(selectedId), loadFederationDeliveries(selectedId),
      ]).then(([nextRemoteSites, nextDeliveries]) => {
        if (!current) return;
        setRemoteSites(nextRemoteSites);
        setDeliveries(nextDeliveries);
      }).catch(error => { if (current) setMessage(errorMessage(error, t("federationRemoteSitesLoadFailed"))); });
    }
    return () => { current = false; };
  }, [selectedId]);

  async function act(action: () => Promise<unknown>, success: string, reloadPeer = false) {
    setBusy(true); setMessage("");
    try {
      await action();
      await refresh();
      if (reloadPeer && selectedId) await refreshPeer(selectedId);
      setMessage(success);
    } catch (error) { setMessage(errorMessage(error, t("federationActionFailed"))); }
    finally { setBusy(false); }
  }

  async function addPeer(event: FormEvent) {
    event.preventDefault();
    if (!discovery || !fingerprintConfirmed) return;
    await act(async () => {
      await createFederationPeer(name.trim(), discovery);
      setSelectedId(discovery.instanceId);
      setName(""); setBaseUrl(""); setDiscovery(null); setFingerprintConfirmed(false);
    }, t("federationPeerApproved"));
  }

  async function discoverPeer() {
    setBusy(true); setMessage(""); setDiscovery(null); setFingerprintConfirmed(false);
    try {
      const result = await discoverFederationPeer(baseUrl.trim());
      setDiscovery(result);
      setMessage(t("federationIdentityDiscovered"));
    } catch (error) { setMessage(errorMessage(error, t("federationPeerIdentityFailed"))); }
    finally { setBusy(false); }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage(t("copied")); }
    catch { setMessage(t("copyManual")); }
  }

  async function discoverRecovery() {
    if (!selectedId) return;
    setBusy(true); setMessage(""); setRecoveryDiscovery(null);
    setRecoveryFingerprintConfirmed(false);
    try {
      const result = await discoverFederationPeerRecovery(selectedId);
      setRecoveryDiscovery(result);
      setMessage(t("federationRecoveryDiscovered"));
    } catch (error) { setMessage(errorMessage(error, t("federationRecoveryDiscoveryFailed"))); }
    finally { setBusy(false); }
  }

  async function approveRecovery() {
    if (!selectedId || !recoveryDiscovery || !recoveryFingerprintConfirmed) return;
    await act(async () => {
      await approveFederationPeerRecovery(selectedId, recoveryDiscovery.fingerprint);
      setRecoveryDiscovery(null); setRecoveryFingerprintConfirmed(false);
    }, t("federationRecoveryApproved"), true);
  }

  return <div className="page platform-admin-page">
    <header className="page-header"><div><h1>{t("federation")}</h1><p className="muted">{t("federationIntro")}</p></div><button className="help-button" type="button" onClick={() => setHelpOpen(true)}><i aria-hidden="true">?</i><span>{t("help")}</span></button></header>
    {!canManage && <EnterpriseRequiredNotice>{t("federationEnterpriseNotice")}</EnterpriseRequiredNotice>}
    {message && <p className="status-message" role="status">{message}</p>}

    <section id="federation-local-identity" className="panel stacked-form">
      <h2>{t("thisInstance")}</h2>
      <div className="field"><span className="field-label">{t("instanceId")}</span><code className="federation-value">{identity?.instanceId ?? t("loading")}</code>
        {identity?.instanceId && <button className="secondary-button" type="button" onClick={() => void copy(identity.instanceId)}>{t("copyInstanceId")}</button>}
      </div>
      {identity?.keyConfigured ? <>
        <div className="field"><span className="field-label">{t("publicKeyFingerprint")}</span><code className="federation-value">{identity.fingerprint}</code></div>
        <div className="field"><label htmlFor="federation-own-key">{t("sharedPublicKey")}</label>
          <textarea id="federation-own-key" rows={3} readOnly value={identity.publicKeySpki ?? ""} />
          <button className="secondary-button" type="button" onClick={() => void copy(identity.publicKeySpki ?? "")}>{t("copyPublicKey")}</button>
        </div>
        {identity.keyUsable === false && <p className="status-message">{t("unusableFederationKey")}</p>}
        {identity.keyUsable === false ? <div className="field">
          <p className="muted">{t("recoverKeyWarning")}</p>
          <button className="secondary-button" type="button" disabled={busy || !canManage}
            onClick={() => void act(recoverFederationIdentity, t("federationKeyRecovered"))}>{t("recoverWithNewKey")}</button>
        </div> : identity.keyRotationPending ? <div className="field">
          <span className="field-label">{t("automaticKeyRotation")}</span>
          <p className="muted">{t("automaticKeyRotationIntro")}</p>
        </div> : <div><button className="secondary-button" type="button" disabled={busy || !canManage}
          onClick={() => void act(createFederationKeyRotation, t("keyRotationStarted"))}>{t("startKeyRotation")}</button></div>}
      </> : <div><button className="primary-button" type="button" disabled={busy || !identity || !canManage} onClick={() => void act(createFederationIdentity, t("federationPublicKeyReady"))}>{t("createFederationKey")}</button></div>}
    </section>

    <section id="federation-add-peer" className="panel stacked-form">
      <h2>{t("addPeer")}</h2>
      <p className="muted">{t("addPeerIntro")}</p>
      <form className="stacked-form" onSubmit={event => void addPeer(event)}>
        <div className="field"><label htmlFor="federation-peer-name">{t("name")}</label><input id="federation-peer-name" required minLength={2} maxLength={120} disabled={!canManage} value={name} onChange={event => setName(event.target.value)} /></div>
        <div className="field"><label htmlFor="federation-peer-url">{t("httpsAddress")}</label><input id="federation-peer-url" required type="url" placeholder="https://fylkren.example.com" disabled={!canManage} value={baseUrl} onChange={event => { setBaseUrl(event.target.value); setDiscovery(null); setFingerprintConfirmed(false); }} /></div>
        {!discovery && <div><button className="secondary-button" type="button" disabled={busy || !baseUrl.trim() || !canManage} onClick={() => void discoverPeer()}>{t("retrieveSignedIdentity")}</button></div>}
        {discovery && <div className="field">
          <span className="field-label">{t("discoveredInstanceId")}</span><code className="federation-value">{discovery.instanceId}</code>
          <span className="field-label">{t("keyFingerprint")}</span><code className="federation-value">{discovery.fingerprint}</code>
          <label><input type="checkbox" disabled={!canManage} checked={fingerprintConfirmed} onChange={event => setFingerprintConfirmed(event.target.checked)} /> {t("fingerprintConfirmed")}</label>
          <div><button className="primary-button" type="submit" disabled={busy || !fingerprintConfirmed || name.trim().length < 2 || !canManage}>{t("approvePeer")}</button></div>
        </div>}
      </form>
    </section>

    <section id="federation-peers" className="panel stacked-form">
      <h2>{t("peersAndConnection")}</h2>
      {peers.length === 0 ? <p className="empty-state">{t("noPeers")}</p> : <div className="field">
        <label htmlFor="federation-selected-peer">{t("selectPeer")}</label>
        <select id="federation-selected-peer" value={selectedId} disabled={busy} onChange={event => setSelectedId(event.target.value)}>
          {peers.map(peer => <option key={peer.instanceId} value={peer.instanceId}>{peer.name} · {peer.isActive ? t("active") : t("inactive")}</option>)}
        </select>
      </div>}
      {selected && <>
        <p className="federation-value"><strong>{selected.name}</strong><br /><code>{selected.instanceId}</code><br />{selected.baseUrl}</p>
        <p>{t("federationStatus")}: {selected.isActive ? selected.lastProofAt ? t("connectionConfirmed") : t("notConfirmed") : t("inactive")}. {t("routingStatus", { status: routing?.enabled ? t("active").toLowerCase() : t("inactive").toLowerCase() })}</p>
        {selected.pinnedPublicKeySpki && <div className="field"><span className="field-label">{t("pinnedPublicKey")}</span><code className="federation-value">{selected.pinnedPublicKeySpki}</code></div>}
        {selected.fingerprint && <div className="field"><span className="field-label">{t("peerFingerprint")}</span><code className="federation-value">{selected.fingerprint}</code></div>}
        {selected.keyRotationPending && <p className="status-message">{t("peerRotationReady")}</p>}
        {selected.isActive && selected.pinnedPublicKeySpki && identity?.keyConfigured && <div>
          <button className="secondary-button" type="button" disabled={busy || selected.keyRotationPending || !canManage} onClick={() => void act(async () => { await probeFederationPeer(selectedId); await syncFederationCatalog(selectedId); }, t("connectionConfirmedSitesLoaded"), true)}>{t("testConnection")}</button>
          <button className="secondary-button" type="button" disabled={busy || selected.keyRotationPending || !canManage} onClick={() => void discoverRecovery()}>{t("checkRecoveredKey")}</button>
        </div>}
        {recoveryDiscovery && <div className="field">
          <span className="field-label">{t("newKeyFingerprint")}</span><code className="federation-value">{recoveryDiscovery.fingerprint}</code>
          <label><input type="checkbox" disabled={!canManage} checked={recoveryFingerprintConfirmed} onChange={event => setRecoveryFingerprintConfirmed(event.target.checked)} /> {t("recoveredKeyConfirmed")}</label>
          <p className="muted">{t("recoveryApprovalWarning")}</p>
          <button className="primary-button" type="button" disabled={busy || !recoveryFingerprintConfirmed || !canManage} onClick={() => void approveRecovery()}>{t("approveRecoveredKey")}</button>
        </div>}
      </>}
    </section>

    {selected && <section id="federation-sites" className="panel stacked-form">
      <h2>Sites</h2>
      <h3>{t("localTopLevelSites")}</h3>
      <p className="muted">{t("localTopLevelSitesIntro")}</p>
      {topSites.length === 0 ? <p className="empty-state">{t("noActiveTopLevelSites")}</p> : <div className="admin-list">
        {topSites.map(site => <div className="admin-list-row" key={site.id}><span><strong>{site.name}</strong><small>{t("automaticallyVisible")}</small></span></div>)}
      </div>}
      <h3>{t("peerSites")}</h3>
      {selected.isActive && selected.lastProofAt && <div><button className="secondary-button" type="button" disabled={busy || !canManage} onClick={() => void act(() => syncFederationCatalog(selectedId), t("siteCatalogueUpdated"), true)}>{t("refreshSiteCatalogue")}</button></div>}
      <div className="admin-list">{remoteSites.length === 0 ? <p className="empty-state">{t("noRemoteSites")}</p> : remoteSites.map(site => <div className="admin-list-row" key={site.siteId}><span><strong>{site.name}</strong><small>{site.siteId} · {t("revision", { revision: site.catalogRevision })}</small></span><span>{site.isActive ? t("active") : t("withdrawn")}</span></div>)}</div>
    </section>}

    <section id="federation-routing" className="panel stacked-form">
      <h2>{t("workRouting")}</h2>
      <p className="muted">{t("workRoutingIntro")}</p>
      {routing && !routing.readyToEnable && <div className="status-message">
        <strong>{t("routingBlockers")}</strong>
        <ul>
          {(routingBlockers.has("federation_identity_required") || routingBlockers.has("usable_federation_key_required")) &&
            <li>{t("createOrRecoverKey")}</li>}
          {routingBlockers.has("proved_peer_required") && <li>{t("addAndTestPeer")}</li>}
          {routingBlockers.has("secure_https_configuration_required") && <li>{t("correctHostConfiguration")}</li>}
        </ul>
      </div>}
      {routing && !routing.enabled && <>
        <label><input type="checkbox" disabled={!canManage} checked={routingConfirmed}
          onChange={event => setRoutingConfirmed(event.target.checked)} /> {t("routingConfirmation")}</label>
        <div><button className="primary-button" type="button"
          disabled={busy || !routing.readyToEnable || !routingConfirmed || !canManage}
          onClick={() => void act(async () => { await setFederationRouting(true); setRoutingConfirmed(false); },
            t("routingEnabled"))}>{t("enableRouting")}</button></div>
      </>}
      {routing?.enabled && <div><button className="secondary-button" type="button" disabled={busy || !canManage}
        onClick={() => void act(() => setFederationRouting(false), t("routingDisabled"))}>{t("disableRouting")}</button></div>}
    </section>

    {selected && <section className="panel stacked-form">
      <h2>{t("deliveryQueue")}</h2>
      <p className="muted">{t("deliveryQueueIntro")}</p>
      {deliveries && <div className="notification-delivery-summary">
        <span><strong>{deliveries.pending}</strong><small>{t("pending")}</small></span>
        <span><strong>{deliveries.retrying}</strong><small>{t("retrying")}</small></span>
        <span><strong>{deliveries.failed}</strong><small>{t("permanentlyFailed")}</small></span>
        <span><strong>{deliveries.delivered}</strong><small>{t("delivered")}</small></span>
      </div>}
      {!deliveries || deliveries.items.length === 0 ? <p className="empty-state">{t("noFederationDeliveries")}</p> : <div className="admin-list">
        {deliveries.items.map(delivery => <div className="admin-list-row notification-delivery-row" key={delivery.messageId}>
          <span><strong>{delivery.messageType}</strong>
            <small>{t("createdMessage", { date: new Date(delivery.createdAt).toLocaleString(language), id: delivery.messageId })}</small>
            <small>{delivery.status === "delivered" && delivery.deliveredAt
              ? t("deliveredDate", { date: new Date(delivery.deliveredAt).toLocaleString(language) })
              : delivery.status === "failed" ? t("noAutomaticRetries")
                : t("nextAttemptDate", { date: new Date(delivery.nextAttemptAt).toLocaleString(language) })}</small>
            {delivery.lastErrorCode && <small className="delivery-error">{t("errorCode", { code: delivery.lastErrorCode })}</small>}
          </span>
          <span><strong className={`delivery-status ${delivery.status}`}>{delivery.status === "pending" ? t("pending") : delivery.status === "retrying" ? t("retrying") : delivery.status === "delivered" ? t("delivered") : t("failed")}{delivery.attemptCount > 0 ? ` · ${t("attempts", { count: delivery.attemptCount })}` : ""}</strong>
            {delivery.status === "failed" && <button className="secondary-button" type="button" disabled={busy || !selected.isActive || !canManage}
              onClick={() => void act(() => retryFederationDelivery(selectedId, delivery.messageId), t("retryDeliveryQueued"), true)}>{t("retry")}</button>}
          </span>
        </div>)}
      </div>}
    </section>}
    {helpOpen && <Modal title={t("federationHelpTitle")} onClose={() => setHelpOpen(false)}>
      <div className="stacked-form">
        <p>{t("federationHelpKeys")}</p>
        <p>{t("federationHelpConnect")}</p>
        <p>{t("federationHelpEnable")}</p>
        <p>{t("federationHelpHost")}</p>
        <div className="modal-actions"><button className="primary-button" type="button" onClick={() => setHelpOpen(false)}>{t("close")}</button></div>
      </div>
    </Modal>}
  </div>;
}
