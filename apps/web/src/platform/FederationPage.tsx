import { useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "../api/errors";
import { Modal } from "../components/Modal";
import { EnterpriseRequiredNotice } from "../components/EnterpriseRequiredNotice";
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
    void refresh().catch(error => setMessage(errorMessage(error, "Federeringsoppsettet kunne ikke lastes.")));
  }, []);
  useEffect(() => {
    if (!identity?.keyRotationPending) return;
    const timer = window.setInterval(() => {
      void refresh().catch(error => setMessage(errorMessage(error,
        "Status for nøkkelrotasjonen kunne ikke oppdateres.")));
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
      }).catch(error => { if (current) setMessage(errorMessage(error, "Motpartens site-oversikt kunne ikke lastes.")); });
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
    } catch (error) { setMessage(errorMessage(error, "Handlingen kunne ikke fullføres.")); }
    finally { setBusy(false); }
  }

  async function addPeer(event: FormEvent) {
    event.preventDefault();
    if (!discovery || !fingerprintConfirmed) return;
    await act(async () => {
      await createFederationPeer(name.trim(), discovery);
      setSelectedId(discovery.instanceId);
      setName(""); setBaseUrl(""); setDiscovery(null); setFingerprintConfirmed(false);
    }, "Motpartens signerte identitet er godkjent på denne instansen.");
  }

  async function discoverPeer() {
    setBusy(true); setMessage(""); setDiscovery(null); setFingerprintConfirmed(false);
    try {
      const result = await discoverFederationPeer(baseUrl.trim());
      setDiscovery(result);
      setMessage("Signert identitet er hentet. Kontroller fingeravtrykket via en uavhengig kanal før godkjenning.");
    } catch (error) { setMessage(errorMessage(error, "Motpartens identitet kunne ikke hentes.")); }
    finally { setBusy(false); }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage("Kopiert."); }
    catch { setMessage("Kunne ikke kopiere automatisk. Marker teksten og kopier den manuelt."); }
  }

  async function discoverRecovery() {
    if (!selectedId) return;
    setBusy(true); setMessage(""); setRecoveryDiscovery(null);
    setRecoveryFingerprintConfirmed(false);
    try {
      const result = await discoverFederationPeerRecovery(selectedId);
      setRecoveryDiscovery(result);
      setMessage("En ny signert nøkkel er hentet direkte. Kontroller fingeravtrykket via en uavhengig kanal.");
    } catch (error) { setMessage(errorMessage(error, "En ny nøkkel kunne ikke bekreftes hos motparten.")); }
    finally { setBusy(false); }
  }

  async function approveRecovery() {
    if (!selectedId || !recoveryDiscovery || !recoveryFingerprintConfirmed) return;
    await act(async () => {
      await approveFederationPeerRecovery(selectedId, recoveryDiscovery.fingerprint);
      setRecoveryDiscovery(null); setRecoveryFingerprintConfirmed(false);
    }, "Motpartens gjenopprettede nøkkel er godkjent. Test tilkoblingen på nytt for å hente sites.", true);
  }

  return <div className="page platform-admin-page">
    <header className="page-header"><div><h1>Federering</h1><p className="muted">Koble selvstendige Fylkren-installasjoner på et lukket eller åpent nett.</p></div><button className="help-button" type="button" onClick={() => setHelpOpen(true)}><i aria-hidden="true">?</i><span>Hjelp</span></button></header>
    {!canManage && <EnterpriseRequiredNotice>Installer en gyldig Enterprise-lisens for å konfigurere og aktivere federering. Hele funksjonen vises nedenfor, men handlingene er deaktivert.</EnterpriseRequiredNotice>}
    {message && <p className="status-message" role="status">{message}</p>}

    <section id="federation-local-identity" className="panel stacked-form">
      <h2>Denne instansen</h2>
      <div className="field"><span className="field-label">Instans-ID</span><code className="federation-value">{identity?.instanceId ?? "Laster …"}</code>
        {identity?.instanceId && <button className="secondary-button" type="button" onClick={() => void copy(identity.instanceId)}>Kopier instans-ID</button>}
      </div>
      {identity?.keyConfigured ? <>
        <div className="field"><span className="field-label">Fingeravtrykk for offentlig nøkkel</span><code className="federation-value">{identity.fingerprint}</code></div>
        <div className="field"><label htmlFor="federation-own-key">Offentlig nøkkel som deles med motparten</label>
          <textarea id="federation-own-key" rows={3} readOnly value={identity.publicKeySpki ?? ""} />
          <button className="secondary-button" type="button" onClick={() => void copy(identity.publicKeySpki ?? "")}>Kopier offentlig nøkkel</button>
        </div>
        {identity.keyUsable === false && <p className="status-message">Den private federeringsnøkkelen kan ikke åpnes med denne installasjonens Data Protection-nøkler. Vanlig nøkkelrotasjon er ikke mulig.</p>}
        {identity.keyUsable === false ? <div className="field">
          <p className="muted">Opprett en ny nøkkel bare etter at korrekt database- og nøkkelring-backup er forsøkt gjenopprettet. Alle motparter må godkjenne det nye fingeravtrykket og teste tilkoblingen på nytt.</p>
          <button className="secondary-button" type="button" disabled={busy || !canManage}
            onClick={() => void act(recoverFederationIdentity, "En ny federeringsnøkkel er opprettet. Del og kontroller det nye fingeravtrykket med hver motpart.")}>Gjenopprett med ny nøkkel</button>
        </div> : identity.keyRotationPending ? <div className="field">
          <span className="field-label">Automatisk nøkkelrotasjon pågår</span>
          <p className="muted">Serveren kontakter alle aktive motparter og prøver automatisk igjen ved nettverks- eller tidsavvik. Ingen manuell nøkkeloverføring er nødvendig.</p>
        </div> : <div><button className="secondary-button" type="button" disabled={busy || !canManage}
          onClick={() => void act(createFederationKeyRotation, "Automatisk nøkkelrotasjon er startet.")}>Start nøkkelrotasjon</button></div>}
      </> : <div><button className="primary-button" type="button" disabled={busy || !identity || !canManage} onClick={() => void act(createFederationIdentity, "Offentlig nøkkel er klar til å deles med motparten.")}>Opprett federeringsnøkkel</button></div>}
    </section>

    <section id="federation-add-peer" className="panel stacked-form">
      <h2>Legg til motpart</h2>
      <p className="muted">Begge Platform Managers gjør dette på sin egen instans. Serveren henter og beviser identiteten direkte; fingeravtrykket må fortsatt sammenlignes via en uavhengig kanal.</p>
      <form className="stacked-form" onSubmit={event => void addPeer(event)}>
        <div className="field"><label htmlFor="federation-peer-name">Navn</label><input id="federation-peer-name" required minLength={2} maxLength={120} disabled={!canManage} value={name} onChange={event => setName(event.target.value)} /></div>
        <div className="field"><label htmlFor="federation-peer-url">HTTPS-adresse</label><input id="federation-peer-url" required type="url" placeholder="https://fylkren.example.no" disabled={!canManage} value={baseUrl} onChange={event => { setBaseUrl(event.target.value); setDiscovery(null); setFingerprintConfirmed(false); }} /></div>
        {!discovery && <div><button className="secondary-button" type="button" disabled={busy || !baseUrl.trim() || !canManage} onClick={() => void discoverPeer()}>Hent signert identitet</button></div>}
        {discovery && <div className="field">
          <span className="field-label">Oppdaget instans-ID</span><code className="federation-value">{discovery.instanceId}</code>
          <span className="field-label">Nøkkelfingeravtrykk</span><code className="federation-value">{discovery.fingerprint}</code>
          <label><input type="checkbox" disabled={!canManage} checked={fingerprintConfirmed} onChange={event => setFingerprintConfirmed(event.target.checked)} /> Jeg har sammenlignet fingeravtrykket via en uavhengig kanal.</label>
          <div><button className="primary-button" type="submit" disabled={busy || !fingerprintConfirmed || name.trim().length < 2 || !canManage}>Godkjenn motpart på denne instansen</button></div>
        </div>}
      </form>
    </section>

    <section id="federation-peers" className="panel stacked-form">
      <h2>Motparter og tilkobling</h2>
      {peers.length === 0 ? <p className="empty-state">Ingen motparter er registrert.</p> : <div className="field">
        <label htmlFor="federation-selected-peer">Velg motpart</label>
        <select id="federation-selected-peer" value={selectedId} disabled={busy} onChange={event => setSelectedId(event.target.value)}>
          {peers.map(peer => <option key={peer.instanceId} value={peer.instanceId}>{peer.name} · {peer.isActive ? "Aktiv" : "Deaktivert"}</option>)}
        </select>
      </div>}
      {selected && <>
        <p className="federation-value"><strong>{selected.name}</strong><br /><code>{selected.instanceId}</code><br />{selected.baseUrl}</p>
        <p>Status: {selected.isActive ? selected.lastProofAt ? "Prøvekobling bekreftet" : "Ikke bekreftet" : "Deaktivert"}. Oppdragsrouting er {routing?.enabled ? "aktiv" : "deaktivert"}.</p>
        {selected.pinnedPublicKeySpki && <div className="field"><span className="field-label">Festet offentlig nøkkel</span><code className="federation-value">{selected.pinnedPublicKeySpki}</code></div>}
        {selected.fingerprint && <div className="field"><span className="field-label">Motpartens nøkkelfingeravtrykk – sammenlign via en uavhengig kanal</span><code className="federation-value">{selected.fingerprint}</code></div>}
        {selected.keyRotationPending && <p className="status-message">Motpartens nye nøkkel er kontrollert og klargjort automatisk.</p>}
        {selected.isActive && selected.pinnedPublicKeySpki && identity?.keyConfigured && <div>
          <button className="secondary-button" type="button" disabled={busy || selected.keyRotationPending || !canManage} onClick={() => void act(async () => { await probeFederationPeer(selectedId); await syncFederationCatalog(selectedId); }, "Tilkoblingen er bekreftet, og motpartens sites er hentet.", true)}>Test tilkobling</button>
          <button className="secondary-button" type="button" disabled={busy || selected.keyRotationPending || !canManage} onClick={() => void discoverRecovery()}>Kontroller gjenopprettet nøkkel</button>
        </div>}
        {recoveryDiscovery && <div className="field">
          <span className="field-label">Nytt nøkkelfingeravtrykk</span><code className="federation-value">{recoveryDiscovery.fingerprint}</code>
          <label><input type="checkbox" disabled={!canManage} checked={recoveryFingerprintConfirmed} onChange={event => setRecoveryFingerprintConfirmed(event.target.checked)} /> Jeg har bekreftet nøkkeltapet og sammenlignet det nye fingeravtrykket via en uavhengig kanal.</label>
          <p className="muted">Godkjenning suspenderer mottatt site-oversikt. Test tilkoblingen på nytt for å hente den oppdaterte oversikten.</p>
          <button className="primary-button" type="button" disabled={busy || !recoveryFingerprintConfirmed || !canManage} onClick={() => void approveRecovery()}>Godkjenn gjenopprettet nøkkel</button>
        </div>}
      </>}
    </section>

    {selected && <section id="federation-sites" className="panel stacked-form">
      <h2>Sites</h2>
      <h3>Lokale toppnivå-sites</h3>
      <p className="muted">Aktive toppnivå-sites blir automatisk tilgjengelige for godkjente motparter når oppdragsrouting er aktivert. Child-sites vises ikke som egne federerte mottakere.</p>
      {topSites.length === 0 ? <p className="empty-state">Ingen aktive toppnivå-sites finnes.</p> : <div className="admin-list">
        {topSites.map(site => <div className="admin-list-row" key={site.id}><span><strong>{site.name}</strong><small>Automatisk synlig</small></span></div>)}
      </div>}
      <h3>Sites mottatt fra motparten</h3>
      {selected.isActive && selected.lastProofAt && <div><button className="secondary-button" type="button" disabled={busy || !canManage} onClick={() => void act(() => syncFederationCatalog(selectedId), "Site-oversikten er oppdatert.", true)}>Oppdater site-oversikt</button></div>}
      <div className="admin-list">{remoteSites.length === 0 ? <p className="empty-state">Ingen sites er mottatt.</p> : remoteSites.map(site => <div className="admin-list-row" key={site.siteId}><span><strong>{site.name}</strong><small>{site.siteId} · Revisjon {site.catalogRevision}</small></span><span>{site.isActive ? "Aktiv" : "Trukket tilbake"}</span></div>)}</div>
    </section>}

    <section id="federation-routing" className="panel stacked-form">
      <h2>Oppdragsrouting</h2>
      <p className="muted">Aktivering åpner sending og mottak mellom alle aktive toppnivå-sites hos de godkjente instansene. Oppsett og historikk beholdes hvis routing senere deaktiveres.</p>
      {routing && !routing.readyToEnable && <div className="status-message">
        <strong>Dette gjenstår før aktivering:</strong>
        <ul>
          {(routingBlockers.has("federation_identity_required") || routingBlockers.has("usable_federation_key_required")) &&
            <li>Opprett eller gjenopprett nøkkelen under <strong>Denne instansen</strong>.</li>}
          {routingBlockers.has("proved_peer_required") && <li>Legg til en motpart og fullfør tilkoblingstesten.</li>}
          {routingBlockers.has("secure_https_configuration_required") && <li>Rett serverens HTTPS-, offentlig adresse-, proxy- eller klokkeoppsett.</li>}
        </ul>
      </div>}
      {routing && !routing.enabled && <>
        <label><input type="checkbox" disabled={!canManage} checked={routingConfirmed}
          onChange={event => setRoutingConfirmed(event.target.checked)} /> Jeg bekrefter at motpart og fingeravtrykk er kontrollert.</label>
        <div><button className="primary-button" type="button"
          disabled={busy || !routing.readyToEnable || !routingConfirmed || !canManage}
          onClick={() => void act(async () => { await setFederationRouting(true); setRoutingConfirmed(false); },
            "Oppdragsrouting er aktivert.")}>Aktiver oppdragsrouting</button></div>
      </>}
      {routing?.enabled && <div><button className="secondary-button" type="button" disabled={busy || !canManage}
        onClick={() => void act(() => setFederationRouting(false), "Oppdragsrouting er deaktivert.")}>Deaktiver oppdragsrouting</button></div>}
    </section>

    {selected && <section className="panel stacked-form">
      <h2>Leveringskø</h2>
      <p className="muted">Viser de 100 nyeste protokollmeldingene uten oppgave- eller rapportinnhold. Automatisk levering bruker et avgrenset antall nye forsøk; permanent feilede meldinger må vurderes før de prøves på nytt.</p>
      {deliveries && <div className="notification-delivery-summary">
        <span><strong>{deliveries.pending}</strong><small>Venter</small></span>
        <span><strong>{deliveries.retrying}</strong><small>Prøver igjen</small></span>
        <span><strong>{deliveries.failed}</strong><small>Permanent feilet</small></span>
        <span><strong>{deliveries.delivered}</strong><small>Levert</small></span>
      </div>}
      {!deliveries || deliveries.items.length === 0 ? <p className="empty-state">Ingen federerte leveringer til denne motparten.</p> : <div className="admin-list">
        {deliveries.items.map(delivery => <div className="admin-list-row notification-delivery-row" key={delivery.messageId}>
          <span><strong>{delivery.messageType}</strong>
            <small>Opprettet {new Date(delivery.createdAt).toLocaleString()} · melding {delivery.messageId}</small>
            <small>{delivery.status === "delivered" && delivery.deliveredAt
              ? `Levert ${new Date(delivery.deliveredAt).toLocaleString()}`
              : delivery.status === "failed" ? "Ingen flere automatiske forsøk"
                : `Neste forsøk ${new Date(delivery.nextAttemptAt).toLocaleString()}`}</small>
            {delivery.lastErrorCode && <small className="delivery-error">Feilkode: {delivery.lastErrorCode}</small>}
          </span>
          <span><strong className={`delivery-status ${delivery.status}`}>{delivery.status === "pending" ? "Venter" : delivery.status === "retrying" ? "Prøver igjen" : delivery.status === "delivered" ? "Levert" : "Feilet"}{delivery.attemptCount > 0 ? ` · ${delivery.attemptCount} forsøk` : ""}</strong>
            {delivery.status === "failed" && <button className="secondary-button" type="button" disabled={busy || !selected.isActive || !canManage}
              onClick={() => void act(() => retryFederationDelivery(selectedId, delivery.messageId), "Leveringen er lagt tilbake i køen.", true)}>Prøv på nytt</button>}
          </span>
        </div>)}
      </div>}
    </section>}
    {helpOpen && <Modal title="Slik setter du opp federering" onClose={() => setHelpOpen(false)}>
      <div className="stacked-form">
        <p><strong>På begge installasjoner:</strong> Opprett federeringsnøkkelen. Privatnøkkelen lagres beskyttet på serveren og skal ikke kopieres manuelt.</p>
        <p><strong>Koble installasjonene:</strong> Skriv inn motpartens offentlige HTTPS-adresse under <em>Legg til motpart</em>. <em>Hent signert identitet</em> henter identiteten direkte fra denne adressen. Sammenlign fingeravtrykket via en uavhengig kanal, godkjenn motparten og kjør <em>Test tilkobling</em>. Testen henter samtidig motpartens aktive toppnivå-sites. Gjør det samme motsatt vei.</p>
        <p><strong>Aktiver:</strong> Under <em>Oppdragsrouting</em> vises nøyaktig hva som eventuelt mangler. Bekreft kontrollen og aktiver på begge installasjoner. Test deretter med en vanlig forespørsel.</p>
        <p>Serverens offentlige HTTPS-adresse, sertifikat, proxy og klokkesynkronisering konfigureres av driftsmiljøet. Alt øvrig oppsett og all aktivering gjøres her i GUI-et.</p>
        <div className="modal-actions"><button className="primary-button" type="button" onClick={() => setHelpOpen(false)}>Lukk</button></div>
      </div>
    </Modal>}
  </div>;
}
