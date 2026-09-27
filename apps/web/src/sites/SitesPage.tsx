import { useEffect, useRef, useState } from "react";
import type React from "react";
import { apiFormMutate, apiMutate, apiRequest, getAntiforgeryToken } from "../api/client";
import { errorMessage } from "../api/errors";
import type { PublicConfiguration } from "../app/models";
import { EnterpriseRequiredNotice } from "../components/EnterpriseRequiredNotice";
import { loadFederationPeers, loadFederationRemoteSites } from "../platform/federationApi";
import type { PersonSummary, PlacementOption, SiteSummary } from "../siteAdmin/models";
import { loadPlacementOptions, loadSites as fetchSites, mutateSiteAccess, searchSitePeople } from "../siteAdmin/siteAdminApi";
import { buildSiteHierarchy, filterSites } from "./siteHierarchy";
import { SiteDialogs, type ManagerUserForm } from "./SiteDialogs";

export function SitesPage({ configuration }: { configuration: PublicConfiguration }) {
  const portabilityFile = useRef<HTMLInputElement>(null);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [placements, setPlacements] = useState<PlacementOption[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [managerQuery, setManagerQuery] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [federatedSiteCount, setFederatedSiteCount] = useState(0);
  const [portabilitySiteId, setPortabilitySiteId] = useState("");
  const [siteCreatorOpen, setSiteCreatorOpen] = useState(false);
  const [siteViewerOpen, setSiteViewerOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteOverviewDesign, setNewSiteOverviewDesign] = useState<SiteSummary["overviewDesign"]>("classic");
  const [siteEditor, setSiteEditor] = useState<SiteSummary | null>(null);
  const activeSiteCount = sites.filter((site) => site.isActive).length;
  const communityLimitReached = configuration.edition === "community" && activeSiteCount >= configuration.communitySiteLimit;
  const [managerToRemove, setManagerToRemove] = useState<PersonSummary | null>(
    null,
  );
  const [managerUserForm, setManagerUserForm] = useState<ManagerUserForm | null>(null);

  async function loadData() {
    try {
      const [nextSites, nextPlacements] = await Promise.all([
        fetchSites(),
        loadPlacementOptions(),
      ]);
      const nextSiteId = nextSites.some((site) => site.id === selectedSiteId)
        ? selectedSiteId
        : (nextSites[0]?.id ?? "");
      setSites(nextSites);
      setPlacements(nextPlacements);
      setSelectedSiteId(nextSiteId);
      setError("");
    } catch (problem) {
      setError(errorMessage(problem,"Siteoversikten kunne ikke lastes."));
    }
  }

  useEffect(() => {
    void loadData();
    void loadFederationPeers().then(async peers => {
      const catalogs = await Promise.all(peers
        .filter(peer => peer.isActive && peer.lastProofAt)
        .map(peer => loadFederationRemoteSites(peer.instanceId)));
      setFederatedSiteCount(catalogs.reduce((count, catalog) =>
        count + catalog.filter(site => site.isActive).length, 0));
    }).catch(() => setFederatedSiteCount(0));
  }, []);
  useEffect(() => {
    if (!siteEditor || managerQuery.trim().length < 2) { setPeople([]); return; }
    const timer = window.setTimeout(() => {
      searchSitePeople(siteEditor.id, managerQuery.trim())
        .then(setPeople)
        .catch(problem => setError(errorMessage(problem,"Brukersøket kunne ikke fullføres.")));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [siteEditor?.id, managerQuery]);

  async function mutate(
    path: string,
    method: "POST" | "PUT" | "DELETE",
    body?: object,
  ) {
    await apiMutate(path, method, body, "Handlingen kunne ikke utføres.");
    await loadData();
  }

  async function createSite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await mutate("/api/sites", "POST", { name: newSiteName, overviewDesign: newSiteOverviewDesign });
      setNewSiteName("");
      setNewSiteOverviewDesign("classic");
      setSiteCreatorOpen(false);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Siten kunne ikke opprettes.");
    }
    setBusy(false);
  }
  async function saveSite(event: React.FormEvent) {
    event.preventDefault();
    if (!siteEditor) return;
    setBusy(true);
    try {
      await mutate(`/api/sites/${siteEditor.id}`, "PUT", {
        name: siteEditor.name,
        parentOrganizationUnitId: siteEditor.parentOrganizationUnitId,
        isActive: siteEditor.isActive,
        overviewDesign: siteEditor.overviewDesign,
      });
      setSiteEditor(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Siten kunne ikke oppdateres.");
    }
    setBusy(false);
  }
  async function deleteSite() {
    if (!siteEditor) return;
    setBusy(true);
    try {
      await mutate(`/api/sites/${siteEditor.id}`, "DELETE");
      setSiteEditor(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Siten kunne ikke slettes.");
    }
    setBusy(false);
  }
  async function assignSiteManager() {
    if (!selectedSiteId || !selectedManagerId) return;
    setBusy(true);
    try {
      await mutate(`/api/sites/${selectedSiteId}/site-managers`, "POST", {
        personId: selectedManagerId,
      });
      setSelectedManagerId("");
      setManagerQuery("");
      setPeople([]);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Site Manager kunne ikke tildeles.");
    }
    setBusy(false);
  }
  async function removeSiteManager(person: PersonSummary) {
    setBusy(true);
    try {
      await mutate(
        `/api/sites/${selectedSiteId}/site-managers/${person.id}`,
        "DELETE",
      );
      setManagerToRemove(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Site Manager-tildelingen kunne ikke fjernes.");
    }
    setBusy(false);
  }
  async function createManagerUser(event: React.FormEvent) {
    event.preventDefault();
    if (!managerUserForm || !selectedSiteId) return;
    setBusy(true);
    try {
      const person = await mutateSiteAccess<PersonSummary>(selectedSiteId, "local-users", "POST", managerUserForm);
      setManagerUserForm(null);
      await loadData();
      setSelectedManagerId(person.id);
      setPeople([person]);
      setManagerQuery(person.displayName);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Den lokale brukeren kunne ikke opprettes.");
    }
    setBusy(false);
  }

  async function exportSite(site: SiteSummary) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const token = await getAntiforgeryToken();
      const response = await apiRequest(`/api/portability/sites/${site.id}/export`, "Eksportpakken kunne ikke opprettes.", { method: "POST", headers: { "X-Fylkren-CSRF": token } });
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `fylkren-site-${site.id}-export.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus(`Eksportpakken for ${site.name} er lastet ned.`);
    } catch (problem) {
      setError(errorMessage(problem, "Eksportpakken kunne ikke opprettes."));
    }
    setBusy(false);
  }

  async function validatePackage(file: File) {
    if (!portabilitySiteId) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const form = new FormData();
      form.append("package", file);
      const result = await apiFormMutate<{ valid: boolean; datasetCount: number; attachmentCount: number; errors: string[]; warnings: string[] }>(`/api/portability/sites/${portabilitySiteId}/imports/validate`, "POST", form, "Eksportpakken kunne ikke valideres.");
      if (!result.valid) setError(`Pakken ble avvist: ${result.errors.join(" ")}`);
      else setStatus(`Pakken er gyldig. ${result.datasetCount} datasett og ${result.attachmentCount} vedlegg ble kontrollert. Ingen data ble endret.`);
    } catch (problem) {
      setError(errorMessage(problem, "Eksportpakken kunne ikke valideres."));
    }
    if (portabilityFile.current) portabilityFile.current.value = "";
    setBusy(false);
  }

  const { orderedSites, placementById, siteDepths, childSitesByParent } = buildSiteHierarchy(sites, placements);
  const visibleSites = filterSites(orderedSites, placementById, query);
  const selectedSite = sites.find((site) => site.id === selectedSiteId);
  const selectedPlacement = selectedSite?.parentOrganizationUnitId
    ? placementById.get(selectedSite.parentOrganizationUnitId)
    : undefined;
  const placementLabel = selectedPlacement
    ? selectedPlacement.isSiteRoot
      ? `Under ${selectedPlacement.siteName}`
      : `Under ${selectedPlacement.siteName} · ${selectedPlacement.unitName}`
    : "Selvstendig toppnivå";

  return (
    <div className="page platform-admin-page">
      <header className="page-header">
        <div>
          <h1>Sites</h1>
          <p className="muted">
            Samlet oversikt over sites, relasjoner og Site Managers.
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={communityLimitReached}
          onClick={() => setSiteCreatorOpen(true)}
        >
          Ny site
        </button>
      </header>
      {configuration.edition === "community" && (
        <p className="muted">
          Community: {activeSiteCount} av {configuration.communitySiteLimit} aktive sites.
        </p>
      )}
      {communityLimitReached && <EnterpriseRequiredNotice>Community-grensen for aktive sites er nådd. Enterprise kreves for å opprette eller reaktivere flere sites.</EnterpriseRequiredNotice>}
      {error && (
        <p className="status-message" role="alert">
          {error}
        </p>
      )}
      {status && <p className="status-message success" role="status">{status}</p>}
      <input ref={portabilityFile} className="sr-only" type="file" accept=".zip,application/zip" tabIndex={-1} aria-hidden="true" onChange={event => { const file = event.target.files?.[0]; if (file) void validatePackage(file); }} />
      <div className="summary-grid" aria-label="Sitesammendrag">
        <div className="summary-card">
          <span>Totalt</span>
          <strong>{sites.length}</strong>
        </div>
        <div className="summary-card">
          <span>Aktive</span>
          <strong>{sites.filter((site) => site.isActive).length}</strong>
        </div>
        <div className="summary-card">
          <span>Uten Site Manager</span>
          <strong>
            {
              sites.filter(
                (site) => site.isActive && site.siteManagers.length === 0,
              ).length
            }
          </strong>
        </div>
        <div className="summary-card">
          <span>Toppnivå</span>
          <strong>
            {sites.filter((site) => !site.parentOrganizationUnitId).length}
          </strong>
        </div>
        <div className="summary-card">
          <span>Federerte</span>
          <strong>{federatedSiteCount}</strong>
        </div>
      </div>
      {sites.length === 0 && !error ? (
        <section className="panel empty-state">
          <div>
            <h2>Ingen sites er opprettet</h2>
            <p className="muted">
              Opprett den første siten for å etablere et administrativt og
              organisatorisk nivå.
            </p>
          </div>
        </section>
      ) : (
        <div className="sites-layout">
          <section className="panel site-directory">
            <div className="field">
              <label htmlFor="site-search">Finn site</label>
              <input
                id="site-search"
                type="search"
                placeholder="Navn, leder eller plassering"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="site-tree" role="list">
              {visibleSites.map((site) => {
                const placement = site.parentOrganizationUnitId
                  ? placementById.get(site.parentOrganizationUnitId)
                  : undefined;
                const children = childSitesByParent.get(site.id) ?? [];
                return (
                  <div
                    className={`site-tree-row${(siteDepths.get(site.id) ?? 0) > 0 ? " site-tree-row-child" : ""}`}
                    role="listitem"
                    key={site.id}
                    style={{ "--site-depth": siteDepths.get(site.id) ?? 0 } as React.CSSProperties}
                  >
                    <span className="site-tree-main">
                      <strong>{site.name}</strong>
                      <span>
                        {placement
                          ? placement.isSiteRoot
                            ? `Under ${placement.siteName}`
                            : `${placement.siteName} · ${placement.unitName}`
                          : "Selvstendig toppnivå"}
                      </span>
                      {children.length > 0 && (
                        <span>
                          Underlagte sites: {children.map((child) => child.name).join(", ")}
                        </span>
                      )}
                    </span>
                    <span className={site.isActive ? "status-active" : "muted"}>
                      {site.isActive ? "Aktiv" : "Slettet"}
                    </span>
                    <div className="row-actions">
                      <button className="secondary-button" type="button" disabled={busy} onClick={() => void exportSite(site)}>
                        Eksporter
                      </button>
                      <button className="secondary-button" type="button" disabled={busy} onClick={() => { setPortabilitySiteId(site.id); portabilityFile.current?.click(); }}>
                        Valider pakke
                      </button>
                      <button className="secondary-button" type="button" onClick={() => { setSelectedSiteId(site.id); setSiteViewerOpen(true); }}>
                        Vis
                      </button>
                      <button className="secondary-button" type="button" onClick={() => { setSelectedSiteId(site.id); setSelectedManagerId(""); setManagerQuery(""); setPeople([]); setSiteEditor(site); }}>
                        Rediger
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
      <SiteDialogs
        configuration={configuration}
        selectedSite={selectedSite}
        placementLabel={placementLabel}
        siteViewerOpen={siteViewerOpen}
        setSiteViewerOpen={setSiteViewerOpen}
        siteCreatorOpen={siteCreatorOpen}
        setSiteCreatorOpen={setSiteCreatorOpen}
        newSiteName={newSiteName}
        setNewSiteName={setNewSiteName}
        newSiteOverviewDesign={newSiteOverviewDesign}
        setNewSiteOverviewDesign={setNewSiteOverviewDesign}
        siteEditor={siteEditor}
        setSiteEditor={setSiteEditor}
        placements={placements}
        managerQuery={managerQuery}
        setManagerQuery={setManagerQuery}
        people={people}
        setPeople={setPeople}
        selectedManagerId={selectedManagerId}
        setSelectedManagerId={setSelectedManagerId}
        managerToRemove={managerToRemove}
        setManagerToRemove={setManagerToRemove}
        managerUserForm={managerUserForm}
        setManagerUserForm={setManagerUserForm}
        busy={busy}
        createSite={createSite}
        saveSite={saveSite}
        deleteSite={deleteSite}
        assignSiteManager={assignSiteManager}
        removeSiteManager={removeSiteManager}
        createManagerUser={createManagerUser}
      />
    </div>
  );
}
