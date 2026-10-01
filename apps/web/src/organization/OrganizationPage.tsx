import { useEffect, useState } from "react";
import type React from "react";
import { apiMutate } from "../api/client";
import { Modal } from "../components/Modal";
import { SectionHelp } from "../components/SectionHelp";
import type { AccessSummary, OrganizationUnitSummary, SiteSummary } from "../siteAdmin/models";
import { loadOrganizationUnits, loadSiteAccess, loadSites as fetchSites, loadWorkContext } from "../siteAdmin/siteAdminApi";
import type { Session } from "../work/WorkContextModels";
import { orderOrganizationUnits } from "./organizationHierarchy";
import { OrganizationStructure } from "./OrganizationStructure";
import { OrganizationRoles } from "./OrganizationRoles";
import { useTranslation } from "../localization/LocalizationProvider";

export function OrganizationPage({ session }: { session: Session }) {
  const t = useTranslation();
  const [helpOpen, setHelpOpen] = useState(false);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [units, setUnits] = useState<OrganizationUnitSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [creating, setCreating] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [unitName, setUnitName] = useState("");
  const [parentId, setParentId] = useState("");
  const [isTemporary, setIsTemporary] = useState(false);
  const [worksAtParentLevel, setWorksAtParentLevel] = useState(false);
  const [isSiteLeadership, setIsSiteLeadership] = useState(false);
  const [unitEditor, setUnitEditor] = useState<OrganizationUnitSummary | null>(
    null,
  );
  const [unitCreatorOpen, setUnitCreatorOpen] = useState(false);
  const [access, setAccess] = useState<AccessSummary>({
    members: [],
    roles: [],
  });

  function loadSites() {
    const controller = new AbortController();
    Promise.all([
      fetchSites({ signal: controller.signal }),
      loadWorkContext({ signal: controller.signal }),
    ])
      .then(([data, context]) => ({ data, context }))
      .then(({ data, context }) => {
        const ledSites = new Set(context.sites.filter((site) => site.isTopLevelLeader).map((site) => site.siteId));
        const visibleLeaderSites = new Set(context.units.filter((unit) => unit.isLeader).map((unit) => unit.siteId));
        const managed = data.filter(
          (site) =>
            site.isActive &&
            (ledSites.has(site.id) || visibleLeaderSites.has(site.id) || site.siteManagers.some(
              (manager) => manager.id === session.personId,
            )),
        );
        setSites(managed);
        setSelectedSiteId((current) =>
          managed.some((site) => site.id === current)
            ? current
            : (managed[0]?.id ?? ""),
        );
        setState("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setState("error");
      });
    return () => controller.abort();
  }

  useEffect(() => {
    const cancelSites = loadSites();
    return cancelSites;
  }, []);

  useEffect(() => {
    if (!selectedSiteId) {
      setUnits([]);
      return;
    }
    const controller = new AbortController();
    loadOrganizationUnits(selectedSiteId, { signal: controller.signal })
      .then(setUnits)
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setState("error");
      });
    return () => controller.abort();
  }, [selectedSiteId]);

  async function createUnit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedSiteId) return;
    setCreating(true);
    try {
      const unit = await apiMutate<OrganizationUnitSummary>(`/api/sites/${selectedSiteId}/organization-units`, "POST", {
        name: unitName,
        parentId: parentId || null,
        isTemporary,
        worksAtParentLevel,
        isSiteLeadership,
      }, t("organizationUnitCreateFailed"));
      setUnits((current) => [...current, unit]);
      setUnitName("");
      setParentId("");
      setIsTemporary(false);
      setWorksAtParentLevel(false);
      setIsSiteLeadership(false);
      setUnitCreatorOpen(false);
    } catch {
      setState("error");
    }
    setCreating(false);
  }

  const selectedSite = sites.find((site) => site.id === selectedSiteId);
  const canManageSelectedSite = selectedSite?.siteManagers.some(
      (manager) => manager.id === session.personId,
    ) ?? false;
  const orderedUnits = orderOrganizationUnits(units);

  function loadAccess() {
    if (!selectedSiteId) return;
    loadSiteAccess(selectedSiteId)
      .then((data) => {
        setAccess(data);
      })
      .catch(() => setState("error"));
  }

  useEffect(loadAccess, [selectedSiteId, units.length]);

  async function saveUnit(event: React.FormEvent) {
    event.preventDefault();
    if (!unitEditor) return;
    try {
      const updated = await apiMutate<OrganizationUnitSummary>(`/api/sites/${selectedSiteId}/organization-units/${unitEditor.id}`, "PUT", unitEditor, t("organizationUnitSaveFailed"));
      setUnits((current) =>
        current.map((value) => (value.id === updated.id ? updated : value)),
      );
      setUnitEditor(null);
    } catch { setState("error"); }
  }
  async function reorderUnit(unitId: string, direction: "up" | "down") {
    try {
      await apiMutate(`/api/sites/${selectedSiteId}/organization-units/${unitId}/reorder`, "POST", { direction }, t("organizationUnitReorderFailed"));
      setUnits(await loadOrganizationUnits(selectedSiteId));
    } catch {
      setState("error");
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t("organizationTitle")}</h1>
          <p className="muted">
            {t("organizationIntro")}
          </p>
        </div>
        <div className="task-actions">
        <button className="help-button" type="button" onClick={() => setHelpOpen(true)}><i aria-hidden="true">?</i><span>{t("help")}</span></button>
        {canManageSelectedSite && (
          <button
            className="primary-button"
            type="button"
            onClick={() => setUnitCreatorOpen(true)}
          >
            {t("newInternalUnit")}
          </button>
        )}
        </div>
      </header>
      {state === "loading" && (
        <p className="status-message">{t("loadingOrganization")}</p>
      )}
      {state === "error" && (
        <p className="status-message">{t("organizationLoadFailed")}</p>
      )}
      {state === "ready" && sites.length === 0 && (
        <section className="panel empty-state">
          <div>
            <span className="empty-state-symbol" aria-hidden="true">
              ◇
            </span>
            <h2>{t("noOrganizationAreas")}</h2>
            <p className="muted">
              {t("noOrganizationAreasIntro")}
            </p>
          </div>
        </section>
      )}
      {state === "ready" && sites.length > 0 && (
        <>
          {sites.length > 1 && <section className="panel site-workspace">
            <div className="field">
              <label htmlFor="selected-site">{t("selectedSite")}</label>
              <select
                id="selected-site"
                value={selectedSiteId}
                onChange={(event) => setSelectedSiteId(event.target.value)}
              >
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.parentOrganizationUnitId ? "↳ " : ""}
                    {site.name}
                    {site.isActive ? "" : t("deletedSuffix")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="field-label">{t("areaLabel")}</span>
              <p>{t("selectedSiteOrganization")}</p>
            </div>
          </section>}

          {!canManageSelectedSite && (
            <p className="muted status-message">{t("organizationReadOnly")}</p>
          )}

          <OrganizationStructure
            units={units}
            orderedUnits={orderedUnits}
            canManage={canManageSelectedSite}
            onEdit={setUnitEditor}
            onReorder={(unitId, direction) => void reorderUnit(unitId, direction)}
          />
          <OrganizationRoles orderedUnits={orderedUnits} access={access} />
        </>
      )}
      {helpOpen && <SectionHelp title={t("organizationHelpTitle")} intro={t("organizationHelpIntro")} steps={[{title:t("organizationHelpSelectTitle"),text:t("organizationHelpSelectText")},{title:t("organizationHelpStructureTitle"),text:t("organizationHelpStructureText")},{title:t("organizationHelpLeadershipTitle"),text:t("organizationHelpLeadershipText")},{title:t("organizationHelpManageTitle"),text:t("organizationHelpManageText")},{title:t("organizationHelpPersonnelTitle"),text:t("organizationHelpPersonnelText")}]} note={t("organizationHelpNote")} onClose={() => setHelpOpen(false)} />}
      {canManageSelectedSite && unitEditor && (
        <Modal title={t("editInternalUnit")} onClose={() => setUnitEditor(null)}>
          <form className="stacked-form" onSubmit={saveUnit}>
            <div className="field">
              <label htmlFor="edit-unit-name">{t("name")}</label>
              <input
                id="edit-unit-name"
                required
                value={unitEditor.name}
                onChange={(event) =>
                  setUnitEditor({ ...unitEditor, name: event.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="edit-unit-parent">{t("placement")}</label>
              <select
                id="edit-unit-parent"
                value={unitEditor.parentId ?? ""}
                disabled={unitEditor.isSiteLeadership}
                onChange={(event) =>
                  setUnitEditor({
                    ...unitEditor,
                    parentId: event.target.value || null,
                    isSiteLeadership: event.target.value ? false : unitEditor.isSiteLeadership,
                  })
                }
              >
                <option value="">{t("directlyUnder", { name: selectedSite?.name ?? "" })}</option>
                {units
                  .filter((value) => value.id !== unitEditor.id)
                  .map((value) => (
                    <option key={value.id} value={value.id}>
                      {value.name}
                    </option>
                  ))}
              </select>
            </div>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={unitEditor.isTemporary}
                onChange={(event) =>
                  setUnitEditor({
                    ...unitEditor,
                    isTemporary: event.target.checked,
                  })
                }
              />{" "}
              {t("temporaryUnit")}
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={unitEditor.worksAtParentLevel}
                onChange={(event) =>
                  setUnitEditor({
                    ...unitEditor,
                    worksAtParentLevel: event.target.checked,
                  })
                }
              />{" "}
              {t("worksAtParentLevel")}
            </label>
            <p className="muted modal-note">
              {t("parentLevelAccessHelp")}
            </p>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={unitEditor.isSiteLeadership}
                disabled={unitEditor.parentId !== null || unitEditor.isSiteLeadership || units.some((unit) => unit.isSiteLeadership && unit.id !== unitEditor.id)}
                onChange={(event) =>
                  setUnitEditor({
                    ...unitEditor,
                    isSiteLeadership: event.target.checked,
                  })
                }
              />{" "}
              {t("siteLeadershipUnit")}
            </label>
            <p className="muted modal-note">
              {units.some((unit) => unit.isSiteLeadership && unit.id !== unitEditor.id)
                ? t("leadershipExistsCannotMove")
                : unitEditor.isSiteLeadership
                  ? t("leadershipUnitProtected")
                  : t("leadershipUnitLeaderHelp")}
            </p>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={unitEditor.isActive}
                disabled={unitEditor.isSiteLeadership}
                onChange={(event) =>
                  setUnitEditor({
                    ...unitEditor,
                    isActive: event.target.checked,
                  })
                }
              />{" "}
              {t("activeUnit")}
            </label>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setUnitEditor(null)}
              >
                {t("cancel")}
              </button>
              <button className="primary-button">{t("save")}</button>
            </div>
          </form>
        </Modal>
      )}
      {canManageSelectedSite && unitCreatorOpen && (
        <Modal
          title={t("newInternalUnit")}
          onClose={() => setUnitCreatorOpen(false)}
        >
          <form className="stacked-form" onSubmit={createUnit}>
            <p className="muted modal-note">
              {t("newUnitIntro", { site: selectedSite?.name ?? "" })}
            </p>
            <div className="field">
              <label htmlFor="new-unit-name">{t("name")}</label>
              <input
                id="new-unit-name"
                required
                minLength={2}
                maxLength={200}
                value={unitName}
                onChange={(event) => setUnitName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="new-parent-unit">{t("placement")}</label>
              <select
                id="new-parent-unit"
                value={parentId}
                onChange={(event) => {
                  setParentId(event.target.value);
                  if (event.target.value) setIsSiteLeadership(false);
                }}
              >
                <option value="">{t("directlyUnder", { name: selectedSite?.name ?? "" })}</option>
                {units
                  .filter((unit) => unit.isActive)
                  .map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
              </select>
            </div>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={isTemporary}
                onChange={(event) => setIsTemporary(event.target.checked)}
              />{" "}
              {t("temporaryUnit")}
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={worksAtParentLevel}
                onChange={(event) =>
                  setWorksAtParentLevel(event.target.checked)
                }
              />{" "}
              {t("worksAtParentLevel")}
            </label>
            <p className="muted modal-note">
              {t("parentLevelAccessHelp")}
            </p>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={isSiteLeadership}
                disabled={Boolean(parentId) || units.some((unit) => unit.isSiteLeadership)}
                onChange={(event) => setIsSiteLeadership(event.target.checked)}
              />{" "}
              {t("siteLeadershipUnit")}
            </label>
            <p className="muted modal-note">
              {units.some((unit) => unit.isSiteLeadership)
                ? t("leadershipExistsForNewUnit")
                : t("leadershipNewUnitHelp")}
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setUnitCreatorOpen(false)}
              >
                {t("cancel")}
              </button>
              <button className="primary-button" disabled={creating}>
                {creating ? t("creating") : t("createUnit")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
