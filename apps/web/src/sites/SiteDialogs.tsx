import type React from "react";
import type { PublicConfiguration } from "../app/models";
import { Modal } from "../components/Modal";
import type { PersonSummary, PlacementOption, SiteSummary } from "../siteAdmin/models";

export type ManagerUserForm = {
  displayName: string;
  email: string;
  username: string;
  password: string;
};

export function SiteDialogs({
  configuration,
  selectedSite,
  placementLabel,
  siteViewerOpen,
  setSiteViewerOpen,
  siteCreatorOpen,
  setSiteCreatorOpen,
  newSiteName,
  setNewSiteName,
  newSiteOverviewDesign,
  setNewSiteOverviewDesign,
  siteEditor,
  setSiteEditor,
  placements,
  managerQuery,
  setManagerQuery,
  people,
  setPeople,
  selectedManagerId,
  setSelectedManagerId,
  managerToRemove,
  setManagerToRemove,
  managerUserForm,
  setManagerUserForm,
  busy,
  createSite,
  saveSite,
  deleteSite,
  assignSiteManager,
  removeSiteManager,
  createManagerUser,
}: {
  configuration: PublicConfiguration;
  selectedSite?: SiteSummary;
  placementLabel: string;
  siteViewerOpen: boolean;
  setSiteViewerOpen: (open: boolean) => void;
  siteCreatorOpen: boolean;
  setSiteCreatorOpen: (open: boolean) => void;
  newSiteName: string;
  setNewSiteName: (name: string) => void;
  newSiteOverviewDesign: SiteSummary["overviewDesign"];
  setNewSiteOverviewDesign: (design: SiteSummary["overviewDesign"]) => void;
  siteEditor: SiteSummary | null;
  setSiteEditor: (site: SiteSummary | null) => void;
  placements: PlacementOption[];
  managerQuery: string;
  setManagerQuery: (query: string) => void;
  people: PersonSummary[];
  setPeople: (people: PersonSummary[]) => void;
  selectedManagerId: string;
  setSelectedManagerId: (id: string) => void;
  managerToRemove: PersonSummary | null;
  setManagerToRemove: (person: PersonSummary | null) => void;
  managerUserForm: ManagerUserForm | null;
  setManagerUserForm: React.Dispatch<React.SetStateAction<ManagerUserForm | null>>;
  busy: boolean;
  createSite: (event: React.FormEvent) => Promise<void>;
  saveSite: (event: React.FormEvent) => Promise<void>;
  deleteSite: () => Promise<void>;
  assignSiteManager: () => Promise<void>;
  removeSiteManager: (person: PersonSummary) => Promise<void>;
  createManagerUser: (event: React.FormEvent) => Promise<void>;
}) {
  return (
    <>
      {siteViewerOpen && selectedSite && (
        <Modal title={selectedSite.name} onClose={() => setSiteViewerOpen(false)}>
            <div className="site-details">
              <div className="section-heading">
                <div>
                  <span
                    className={
                      selectedSite.isActive ? "status-active" : "muted"
                    }
                  >
                    {selectedSite.isActive ? "Aktiv site" : "Deaktivert site"}
                  </span>
                </div>
              </div>
              <div className="site-detail-block">
                <span className="field-label">Plassering</span>
                <p>{placementLabel}</p>
                <p className="muted">
                  Plasseringen styrer hvor oppdrag kommer fra og hvor
                  rapportering går. Den gir ikke administrativ tilgang.
                </p>
              </div>
              <div className="site-detail-block">
                <span className="field-label">Oversiktsdesign</span>
                <p>{selectedSite.overviewDesign === "classic" ? "Klassisk" : "Minimal"}</p>
              </div>
              <div className="site-detail-block">
                <span className="field-label">Site Managers</span>
                {selectedSite.siteManagers.length ? (
                  <div className="manager-list">
                    {selectedSite.siteManagers.map((manager) => (
                      <span className="manager-chip" key={manager.id}>
                        {manager.displayName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="site-warning">Ingen Site Manager er tildelt.</p>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setSiteViewerOpen(false)}>Lukk</button>
            </div>
        </Modal>
      )}
      {siteCreatorOpen && (
        <Modal title="Ny site" onClose={() => setSiteCreatorOpen(false)}>
          <form className="stacked-form" onSubmit={createSite}>
            <div className="field">
              <label htmlFor="new-site-name">Navn</label>
              <input
                id="new-site-name"
                required
                minLength={2}
                maxLength={200}
                value={newSiteName}
                onChange={(event) => setNewSiteName(event.target.value)}
              />
            </div>
            <p className="muted modal-note">
              Siten opprettes som et selvstendig toppnivå. Den kan plasseres
              under en annen site etterpå.
            </p>
            <div className="field">
              <label htmlFor="new-site-overview-design">Oversiktsdesign</label>
              <select id="new-site-overview-design" value={newSiteOverviewDesign} onChange={(event)=>setNewSiteOverviewDesign(event.target.value as SiteSummary["overviewDesign"])}>
                <option value="classic">Klassisk</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setSiteCreatorOpen(false)}
              >
                Avbryt
              </button>
              <button className="primary-button" disabled={busy}>
                Opprett site
              </button>
            </div>
          </form>
        </Modal>
      )}
      {siteEditor && (
        <Modal title="Rediger site" onClose={() => setSiteEditor(null)}>
          <form className="stacked-form" onSubmit={saveSite}>
            <div className="field">
              <label htmlFor="edit-site-name">Navn</label>
              <input
                id="edit-site-name"
                required
                value={siteEditor.name}
                onChange={(event) =>
                  setSiteEditor({ ...siteEditor, name: event.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="edit-site-placement">Plassering</label>
              <select
                id="edit-site-placement"
                value={siteEditor.parentOrganizationUnitId ?? ""}
                onChange={(event) =>
                  setSiteEditor({
                    ...siteEditor,
                    parentOrganizationUnitId: event.target.value || null,
                  })
                }
              >
                <option value="">Ingen – selvstendig toppnivå</option>
                {placements
                  .filter((option) => option.siteId !== siteEditor.id)
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.isSiteRoot
                        ? option.siteName
                        : `${option.siteName} · ${option.unitName}`}
                    </option>
                  ))}
              </select>
            </div>
            <p className="muted modal-note">
              Flytting endrer styrings- og rapporteringslinjen. Sitens interne
              struktur og tilgangsgrense beholdes.
            </p>
            <div className="field">
              <label htmlFor="edit-site-overview-design">Oversiktsdesign</label>
              <select id="edit-site-overview-design" value={siteEditor.overviewDesign} onChange={(event)=>setSiteEditor({...siteEditor,overviewDesign:event.target.value as SiteSummary["overviewDesign"]})}>
                <option value="classic">Klassisk</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={siteEditor.isActive}
                onChange={(event) =>
                  setSiteEditor({
                    ...siteEditor,
                    isActive: event.target.checked,
                  })
                }
              />{" "}
              Aktiv site
            </label>
            <div className="site-detail-block">
              <span className="field-label">Site Managers</span>
              {selectedSite?.siteManagers.length ? (
                <div className="manager-list">
                  {selectedSite.siteManagers.map((manager) => (
                    <span className="manager-chip" key={manager.id}>
                      {manager.displayName}
                      <button type="button" aria-label={`Fjern ${manager.displayName} som Site Manager`} onClick={() => setManagerToRemove(manager)}>×</button>
                    </span>
                  ))}
                </div>
              ) : <p className="site-warning">Ingen Site Manager er tildelt.</p>}
            </div>
            <div className="field">
              <label htmlFor="site-manager-search">Finn bruker som skal bli Site Manager</label>
              <input id="site-manager-search" type="search" autoComplete="off" placeholder="Søk på navn, e-post eller brukernavn" value={managerQuery} onChange={(event) => { setManagerQuery(event.target.value); setSelectedManagerId(""); }} />
              {managerQuery.trim().length > 0 && managerQuery.trim().length < 2 && <p className="muted modal-note">Skriv minst to tegn.</p>}
              {people.length > 0 && !selectedManagerId && <div className="person-search-results" role="listbox" aria-label="Brukertreff">{people.filter((person) => !selectedSite?.siteManagers.some((manager) => manager.id === person.id)).map((person) => <button key={person.id} type="button" role="option" aria-selected="false" onClick={() => { setSelectedManagerId(person.id); setManagerQuery(person.displayName); }}><strong>{person.displayName}</strong>{person.email && <small>{person.email}</small>}</button>)}</div>}
            </div>
            <div className="inline-actions">
              {configuration.authentication.localEnabled && <button className="secondary-button" type="button" onClick={() => setManagerUserForm({ displayName: "", email: "", username: "", password: "" })}>Ny lokal bruker</button>}
              <button className="secondary-button" type="button" disabled={busy || !selectedManagerId} onClick={assignSiteManager}>Tildel Site Manager</button>
            </div>
            <div className="modal-actions">
              <button
                className="danger-button"
                type="button"
                disabled={busy || !siteEditor.isActive}
                onClick={deleteSite}
              >
                Slett site
              </button>
              <span className="action-spacer" />
              <button
                className="secondary-button"
                type="button"
                onClick={() => setSiteEditor(null)}
              >
                Avbryt
              </button>
              <button className="primary-button" disabled={busy}>
                Lagre
              </button>
            </div>
            <p className="muted modal-note">
              Sletting deaktiverer siten og bevarer historikk og audit-spor.
            </p>
          </form>
        </Modal>
      )}
      {managerToRemove && (
        <Modal
          title="Fjern Site Manager"
          onClose={() => setManagerToRemove(null)}
        >
          <p>
            Vil du fjerne <strong>{managerToRemove.displayName}</strong> som
            Site Manager for {selectedSite?.name}?
          </p>
          <p className="muted">Brukeren og historiske handlinger beholdes.</p>
          <div className="modal-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setManagerToRemove(null)}
            >
              Avbryt
            </button>
            <button
              className="danger-button"
              type="button"
              disabled={busy}
              onClick={() => removeSiteManager(managerToRemove)}
            >
              Fjern tildeling
            </button>
          </div>
        </Modal>
      )}
      {managerUserForm && (
        <Modal
          title="Opprett lokal Site Manager-bruker"
          onClose={() => setManagerUserForm(null)}
        >
          <form className="stacked-form" onSubmit={createManagerUser}>
            <p className="muted modal-note">
              Brukeren opprettes i {selectedSite?.name} og kan deretter tildeles
              som Site Manager.
            </p>
            <div className="field">
              <label htmlFor="manager-display-name">Navn</label>
              <input
                id="manager-display-name"
                required
                minLength={2}
                value={managerUserForm.displayName}
                onChange={(event) =>
                  setManagerUserForm({
                    ...managerUserForm,
                    displayName: event.target.value,
                  })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="manager-email">E-postadresse</label>
              <input
                id="manager-email"
                type="email"
                required
                value={managerUserForm.email}
                onChange={(event) =>
                  setManagerUserForm({
                    ...managerUserForm,
                    email: event.target.value,
                  })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="manager-username">Brukernavn</label>
              <input
                id="manager-username"
                required
                minLength={3}
                value={managerUserForm.username}
                onChange={(event) =>
                  setManagerUserForm({
                    ...managerUserForm,
                    username: event.target.value,
                  })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="manager-password">Startpassord</label>
              <input
                id="manager-password"
                type="password"
                required
                minLength={14}
                value={managerUserForm.password}
                onChange={(event) =>
                  setManagerUserForm({
                    ...managerUserForm,
                    password: event.target.value,
                  })
                }
              />
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setManagerUserForm(null)}
              >
                Avbryt
              </button>
              <button className="primary-button" disabled={busy}>
                Opprett bruker
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

