import type React from "react";
import type { PublicConfiguration } from "../app/models";
import { Modal } from "../components/Modal";
import type { PersonSummary, PlacementOption, SiteSummary } from "../siteAdmin/models";
import { useTranslation } from "../localization/LocalizationProvider";

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
  const t = useTranslation();
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
                    {selectedSite.isActive ? t("activeSite") : t("inactiveSite")}
                  </span>
                </div>
              </div>
              <div className="site-detail-block">
                <span className="field-label">{t("placement")}</span>
                <p>{placementLabel}</p>
                <p className="muted">
                  {t("placementHelp")}
                </p>
              </div>
              <div className="site-detail-block">
                <span className="field-label">{t("overviewDesign")}</span>
                <p>{selectedSite.overviewDesign === "classic" ? t("classic") : t("minimal")}</p>
              </div>
              <div className="site-detail-block">
                <span className="field-label">{t("siteManagers")}</span>
                {selectedSite.siteManagers.length ? (
                  <div className="manager-list">
                    {selectedSite.siteManagers.map((manager) => (
                      <span className="manager-chip" key={manager.id}>
                        {manager.displayName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="site-warning">{t("noSiteManager")}</p>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setSiteViewerOpen(false)}>{t("close")}</button>
            </div>
        </Modal>
      )}
      {siteCreatorOpen && (
        <Modal title={t("newSite")} onClose={() => setSiteCreatorOpen(false)}>
          <form className="stacked-form" onSubmit={createSite}>
            <div className="field">
              <label htmlFor="new-site-name">{t("name")}</label>
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
              {t("newSiteIntro")}
            </p>
            <div className="field">
              <label htmlFor="new-site-overview-design">{t("overviewDesign")}</label>
              <select id="new-site-overview-design" value={newSiteOverviewDesign} onChange={(event)=>setNewSiteOverviewDesign(event.target.value as SiteSummary["overviewDesign"])}>
                <option value="classic">{t("classic")}</option>
                <option value="minimal">{t("minimal")}</option>
              </select>
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setSiteCreatorOpen(false)}
              >
                {t("cancel")}
              </button>
              <button className="primary-button" disabled={busy}>
                {t("createSite")}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {siteEditor && (
        <Modal title={t("editSite")} onClose={() => setSiteEditor(null)}>
          <form className="stacked-form" onSubmit={saveSite}>
            <div className="field">
              <label htmlFor="edit-site-name">{t("name")}</label>
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
              <label htmlFor="edit-site-placement">{t("placement")}</label>
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
                <option value="">{t("noPlacement")}</option>
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
              {t("moveSiteHelp")}
            </p>
            <div className="field">
              <label htmlFor="edit-site-overview-design">{t("overviewDesign")}</label>
              <select id="edit-site-overview-design" value={siteEditor.overviewDesign} onChange={(event)=>setSiteEditor({...siteEditor,overviewDesign:event.target.value as SiteSummary["overviewDesign"]})}>
                <option value="classic">{t("classic")}</option>
                <option value="minimal">{t("minimal")}</option>
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
              {t("activeSite")}
            </label>
            <div className="site-detail-block">
              <span className="field-label">{t("siteManagers")}</span>
              {selectedSite?.siteManagers.length ? (
                <div className="manager-list">
                  {selectedSite.siteManagers.map((manager) => (
                    <span className="manager-chip" key={manager.id}>
                      {manager.displayName}
                      <button type="button" aria-label={t("removeManagerLabel", { name: manager.displayName })} onClick={() => setManagerToRemove(manager)}>×</button>
                    </span>
                  ))}
                </div>
              ) : <p className="site-warning">{t("noSiteManager")}</p>}
            </div>
            <div className="field">
              <label htmlFor="site-manager-search">{t("findSiteManager")}</label>
              <input id="site-manager-search" type="search" autoComplete="off" placeholder={t("managerSearchPlaceholder")} value={managerQuery} onChange={(event) => { setManagerQuery(event.target.value); setSelectedManagerId(""); }} />
              {managerQuery.trim().length > 0 && managerQuery.trim().length < 2 && <p className="muted modal-note">{t("minimumTwoCharacters")}</p>}
              {people.length > 0 && !selectedManagerId && <div className="person-search-results" role="listbox" aria-label={t("userResults")}>{people.filter((person) => !selectedSite?.siteManagers.some((manager) => manager.id === person.id)).map((person) => <button key={person.id} type="button" role="option" aria-selected="false" onClick={() => { setSelectedManagerId(person.id); setManagerQuery(person.displayName); }}><strong>{person.displayName}</strong>{person.email && <small>{person.email}</small>}</button>)}</div>}
            </div>
            <div className="inline-actions">
              {configuration.authentication.localEnabled && <button className="secondary-button" type="button" onClick={() => setManagerUserForm({ displayName: "", email: "", username: "", password: "" })}>{t("newLocalUser")}</button>}
              <button className="secondary-button" type="button" disabled={busy || !selectedManagerId} onClick={assignSiteManager}>{t("assignSiteManager")}</button>
            </div>
            <div className="modal-actions">
              <button
                className="danger-button"
                type="button"
                disabled={busy || !siteEditor.isActive}
                onClick={deleteSite}
              >
                {t("deactivate")}
              </button>
              <span className="action-spacer" />
              <button
                className="secondary-button"
                type="button"
                onClick={() => setSiteEditor(null)}
              >
                {t("cancel")}
              </button>
              <button className="primary-button" disabled={busy}>
                {t("save")}
              </button>
            </div>
            <p className="muted modal-note">
              {t("deleteSiteHelp")}
            </p>
          </form>
        </Modal>
      )}
      {managerToRemove && (
        <Modal
          title={t("removeSiteManager")}
          onClose={() => setManagerToRemove(null)}
        >
          <p>
            {t("removeSiteManagerQuestion", { name: managerToRemove.displayName, site: selectedSite?.name ?? "" })}
          </p>
          <p className="muted">{t("userHistoryRetained")}</p>
          <div className="modal-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setManagerToRemove(null)}
            >
              {t("cancel")}
            </button>
            <button
              className="danger-button"
              type="button"
              disabled={busy}
              onClick={() => removeSiteManager(managerToRemove)}
            >
              {t("removeAssignment")}
            </button>
          </div>
        </Modal>
      )}
      {managerUserForm && (
        <Modal
          title={t("createLocalManager")}
          onClose={() => setManagerUserForm(null)}
        >
          <form className="stacked-form" onSubmit={createManagerUser}>
            <p className="muted modal-note">
              {t("createLocalManagerIntro", { site: selectedSite?.name ?? "" })}
            </p>
            <div className="field">
              <label htmlFor="manager-display-name">{t("name")}</label>
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
              <label htmlFor="manager-email">{t("emailAddress")}</label>
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
              <label htmlFor="manager-username">{t("username")}</label>
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
              <label htmlFor="manager-password">{t("startPassword")}</label>
              <input
                id="manager-password"
                type="password"
                autoComplete="new-password"
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
                {t("cancel")}
              </button>
              <button className="primary-button" disabled={busy}>
                {t("createUser")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
