import { useEffect, useState } from "react";
import type React from "react";
import type { PublicConfiguration } from "../app/models";
import { errorMessage } from "../api/errors";
import { SectionHelp } from "../components/SectionHelp";
import type { AccessSummary, DirectoryProviderSummary, DirectoryUserSummary, ExistingUserSummary, MemberSummary, OrganizationUnitSummary, RoleAssignmentSummary, RoleSummary, SiteSummary } from "../siteAdmin/models";
import { loadDirectoryProviders, loadOrganizationUnits, loadSiteAccess, loadSites as fetchSites, loadWorkContext, mutateSiteAccess, searchDirectoryUsers, searchExistingUsers } from "../siteAdmin/siteAdminApi";
import type { Session } from "../work/WorkContextModels";
import { buildPersonnelUnits } from "./personnelHierarchy";
import { PersonnelLists } from "./PersonnelLists";
import { PersonnelPageHeader } from "./PersonnelPageHeader";
import { LocalUserDialog, RoleCreateDialog } from "./PersonnelCreateDialogs";
import { DirectoryUserDialog, ExistingUserDialog, PasswordResetDialog, RemoveMemberDialog } from "./PersonnelAccountDialogs";
import { MemberEditDialog, RoleEditDialog } from "./PersonnelRoleDialogs";
import { useTranslation } from "../localization/LocalizationProvider";

export function PersonnelPage({ session, configuration }: { session: Session; configuration: PublicConfiguration }) {
  const t = useTranslation();
  const [helpOpen, setHelpOpen] = useState(false);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [units, setUnits] = useState<OrganizationUnitSummary[]>([]);
  const [access, setAccess] = useState<AccessSummary>({
    members: [],
    roles: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [userForm, setUserForm] = useState({
    displayName: "",
    email: "",
    username: "",
    organizationUnitId: "",
  });
  const [roleForm, setRoleForm] = useState({
    organizationUnitId: "",
    name: "",
    hasLeaderAccess: false,
    canPlan: false,
  });
  const [assignmentForm, setAssignmentForm] = useState({
    roleId: "",
    validTo: "",
    canLeadParentLevel: false,
  });
  const [userCreatorOpen, setUserCreatorOpen] = useState(false);
  const [existingUserCreatorOpen, setExistingUserCreatorOpen] = useState(false);
  const [existingUserQuery, setExistingUserQuery] = useState("");
  const [existingUserResults, setExistingUserResults] = useState<ExistingUserSummary[]>([]);
  const [selectedExistingUser, setSelectedExistingUser] = useState<ExistingUserSummary | null>(null);
  const [existingUserUnitId, setExistingUserUnitId] = useState("");
  const [directoryCreatorOpen, setDirectoryCreatorOpen] = useState(false);
  const [directoryProviders, setDirectoryProviders] = useState<DirectoryProviderSummary[]>([]);
  const [directoryProvider, setDirectoryProvider] = useState("");
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryResults, setDirectoryResults] = useState<DirectoryUserSummary[]>([]);
  const [selectedDirectoryUser, setSelectedDirectoryUser] = useState<DirectoryUserSummary | null>(null);
  const [directoryUnitId, setDirectoryUnitId] = useState("");
  const [roleCreatorOpen, setRoleCreatorOpen] = useState(false);
  const [memberEditor, setMemberEditor] = useState<MemberSummary | null>(null);
  const [passwordReset, setPasswordReset] = useState<
    (MemberSummary & { resetCode?: string; expiresAt?: string }) | null
  >(null);
  const [memberToRemove, setMemberToRemove] = useState<MemberSummary | null>(
    null,
  );
  const [roleEditor, setRoleEditor] = useState<RoleSummary | null>(null);

  async function loadData(siteId: string) {
    if (!siteId) return;
    try {
      const [nextUnits, nextAccess] = await Promise.all([
        loadOrganizationUnits(siteId),
        loadSiteAccess(siteId),
      ]);
      setUnits(nextUnits);
      setAccess(nextAccess);
      setError("");
      setRoleForm((current) => ({
        ...current,
        organizationUnitId: nextUnits.some(
          (value) => value.id === current.organizationUnitId,
        )
          ? current.organizationUnitId
          : (nextUnits.find((value) => value.isActive)?.id ?? ""),
      }));
      setUserForm((current) => ({
        ...current,
        organizationUnitId: nextUnits.some((value) => value.id === current.organizationUnitId)
          ? current.organizationUnitId
          : (nextUnits.find((value) => value.isActive)?.id ?? ""),
      }));
      setAssignmentForm((current) => ({
        ...current,
        roleId: nextAccess.roles.some((value) => value.id === current.roleId)
          ? current.roleId
          : (nextAccess.roles[0]?.id ?? ""),
      }));
    } catch (problem) {
      setError(errorMessage(problem, t("personnelLoadFailed")));
    }
  }

  useEffect(() => {
    Promise.all([
      fetchSites(),
      loadWorkContext(),
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
        setSelectedSiteId(managed[0]?.id ?? "");
      })
      .catch(() => setError(t("sitesLoadFailed")));
  }, []);
  useEffect(() => {
    void loadData(selectedSiteId);
  }, [selectedSiteId]);
  useEffect(() => {
    if (!directoryCreatorOpen || !selectedSiteId) return;
    loadDirectoryProviders(selectedSiteId)
      .then((providers) => { setDirectoryProviders(providers); setDirectoryProvider((current) => providers.some((provider) => provider.key === current) ? current : (providers[0]?.key ?? "")); })
      .catch(() => setError(t("directoryProvidersLoadFailed")));
  }, [directoryCreatorOpen, selectedSiteId]);
  useEffect(() => {
    if (!directoryCreatorOpen || !directoryProvider || directoryQuery.trim().length < 2) { setDirectoryResults([]); return; }
    const timer = window.setTimeout(() => {
      searchDirectoryUsers(selectedSiteId, directoryProvider, directoryQuery.trim())
        .then(setDirectoryResults)
        .catch(() => setError(t("directorySearchFailed")));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [directoryCreatorOpen, directoryProvider, directoryQuery, selectedSiteId]);
  useEffect(() => {
    if (!existingUserCreatorOpen || existingUserQuery.trim().length < 2) { setExistingUserResults([]); return; }
    const timer = window.setTimeout(() => {
      searchExistingUsers(selectedSiteId, existingUserQuery.trim())
        .then(setExistingUserResults)
        .catch(() => setError(t("existingUsersSearchFailed")));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [existingUserCreatorOpen, existingUserQuery, selectedSiteId]);

  async function mutate<T = void>(
    path: string,
    method: "POST" | "PUT" | "DELETE",
    body?: object,
  ): Promise<T> {
    const result = await mutateSiteAccess<T>(selectedSiteId, path, method, body);
    await loadData(selectedSiteId);
    return result;
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await mutate<{ resetCode: string }>("local-users", "POST", userForm);
      setUserForm((current) => ({ ...current, resetCode: result.resetCode }));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("localUserCreateFailed"));
    }
    setBusy(false);
  }
  async function addDirectoryUser(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedDirectoryUser || !directoryUnitId) return;
    setBusy(true);
    try {
      await mutate("directory-users", "POST", { ...selectedDirectoryUser, organizationUnitId: directoryUnitId });
      setDirectoryCreatorOpen(false); setDirectoryQuery(""); setDirectoryResults([]); setSelectedDirectoryUser(null);
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("directoryUserAddFailed")); }
    setBusy(false);
  }
  async function addExistingLocalUser(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedExistingUser || !existingUserUnitId) return;
    setBusy(true);
    try {
      await mutate("existing-local-users", "POST", { personId: selectedExistingUser.id, organizationUnitId: existingUserUnitId });
      setExistingUserCreatorOpen(false); setExistingUserQuery(""); setExistingUserResults([]); setSelectedExistingUser(null);
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("existingUserAddFailed")); }
    setBusy(false);
  }
  async function createRole(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await mutate("roles", "POST", roleForm);
      setRoleForm((current) => ({
        ...current,
        name: "",
        hasLeaderAccess: false,
        canPlan: false,
      }));
      setRoleCreatorOpen(false);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("roleCreateFailed"));
    }
    setBusy(false);
  }
  async function assignRoleToMember() {
    if (!memberEditor || !assignmentForm.roleId) return;
    setBusy(true);
    try {
      await mutate("role-assignments", "POST", {
        roleId: assignmentForm.roleId,
        personId: memberEditor.id,
        validFrom: new Date().toISOString(),
        validTo: assignmentForm.validTo
          ? new Date(`${assignmentForm.validTo}T23:59:59Z`).toISOString()
          : null,
        canLeadParentLevel: assignmentForm.canLeadParentLevel,
      });
      setAssignmentForm((current) => ({ ...current, validTo: "", canLeadParentLevel: false }));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("roleAssignFailed"));
    }
    setBusy(false);
  }
  async function saveMember(event: React.FormEvent) {
    event.preventDefault();
    if (!memberEditor) return;
    setBusy(true);
    try {
      await mutate(`members/${memberEditor.id}`, "PUT", {
        displayName: memberEditor.displayName,
        email: memberEditor.email,
        username: memberEditor.username,
        isActive: memberEditor.isActive,
        organizationUnitId: memberEditor.organizationUnitId,
      });
      setMemberEditor(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("memberUpdateFailed"));
    }
    setBusy(false);
  }
  async function resetMemberPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!passwordReset) return;
    setBusy(true);
    try {
      const result = await mutate<{ resetCode: string; expiresAt: string }>(`members/${passwordReset.id}/password-reset`, "POST");
      setPasswordReset({ ...passwordReset, ...result });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("memberPasswordResetFailed"));
    }
    setBusy(false);
  }
  async function removeMember(member: MemberSummary) {
    setBusy(true);
    try {
      await mutate(`members/${member.id}`, "DELETE");
      setMemberToRemove(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("memberRemoveFailed"));
    }
    setBusy(false);
  }
  async function removeAssignment(assignment: RoleAssignmentSummary) {
    setBusy(true);
    try {
      await mutate(`role-assignments/${assignment.id}`, "DELETE");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("roleAssignmentRemoveFailed"));
    }
    setBusy(false);
  }
  async function updateAssignmentParentLeadership(
    assignment: RoleAssignmentSummary,
    enabled: boolean,
  ) {
    setBusy(true);
    try {
      await mutate(`role-assignments/${assignment.id}`, "PUT", {
        canLeadParentLevel: enabled,
      });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("parentLeadershipUpdateFailed"));
    }
    setBusy(false);
  }
  async function saveRole(event: React.FormEvent) {
    event.preventDefault();
    if (!roleEditor) return;
    setBusy(true);
    try {
      await mutate(`roles/${roleEditor.id}`, "PUT", {
        organizationUnitId: roleEditor.organizationUnitId,
        name: roleEditor.name,
        hasLeaderAccess: roleEditor.hasLeaderAccess,
        canPlan: roleEditor.canPlan,
      });
      setRoleEditor(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("roleUpdateFailed"));
    }
    setBusy(false);
  }
  async function deleteRole() {
    if (!roleEditor) return;
    setBusy(true);
    try {
      await mutate(`roles/${roleEditor.id}`, "DELETE");
      setRoleEditor(null);
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : roleEditor.assignments.length
          ? t("roleDeleteAssignmentsFirst")
          : t("roleDeleteFailed"),
      );
    }
    setBusy(false);
  }

  const personnelUnits = buildPersonnelUnits(units);
  const selectedAssignmentRole = access.roles.find(
    (role) => role.id === assignmentForm.roleId,
  );
  const selectedAssignmentUnit = personnelUnits.find(
    ({ unit }) => unit.id === selectedAssignmentRole?.organizationUnitId,
  )?.unit;
  const canGrantParentLeadership = Boolean(
    selectedAssignmentRole?.isLeader &&
      selectedAssignmentUnit?.worksAtParentLevel,
  );
  const selectedSite = sites.find((site) => site.id === selectedSiteId);
  const canManageSelectedSite = Boolean(
    selectedSite?.siteManagers.some((manager) => manager.id === session.personId),
  );
  const directoryEnabled = configuration.entitlements.includes("external-identity") &&
    (configuration.authentication.activeDirectoryConfigurationEnabled || configuration.authentication.ldapConfigurationEnabled);

  return (
    <div className="page">
      <PersonnelPageHeader
        canManage={canManageSelectedSite}
        localEnabled={configuration.authentication.localEnabled}
        directoryEnabled={directoryEnabled}
        hasUnits={units.length > 0}
        onHelp={() => setHelpOpen(true)}
        onCreateLocalUser={() => setUserCreatorOpen(true)}
        onAddExistingUser={() => { setExistingUserUnitId(personnelUnits[0]?.unit.id ?? ""); setExistingUserCreatorOpen(true); }}
        onAddDirectoryUser={() => { setDirectoryUnitId(personnelUnits[0]?.unit.id ?? ""); setDirectoryCreatorOpen(true); }}
        onCreateRole={() => setRoleCreatorOpen(true)}
      />
      {sites.length === 0 ? (
        <section className="panel empty-state">
          <div>
            <h2>{t("personnelAreaUnavailable")}</h2>
            <p className="muted">
              {t("personnelAreaUnavailableIntro")}
            </p>
          </div>
        </section>
      ) : (
        <>
          {sites.length > 1 && <section className="panel personnel-site">
            <div className="field">
              <label htmlFor="personnel-site">Site</label>
              <select
                id="personnel-site"
                value={selectedSiteId}
                onChange={(event) => setSelectedSiteId(event.target.value)}
              >
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
          </section>}
          {error && (
            <p className="error-message status-message" role="alert">
              {error}
            </p>
          )}
          {!canManageSelectedSite && (
            <p className="muted status-message">{t("personnelReadOnly")}</p>
          )}
          <PersonnelLists
            access={access}
            units={personnelUnits}
            canManage={canManageSelectedSite}
            busy={busy}
            onEditMember={setMemberEditor}
            onResetPassword={(member) =>
              setPasswordReset({ ...member })
            }
            onRemoveMember={setMemberToRemove}
            onRemoveAssignment={(assignment) => {
              void removeAssignment(assignment);
            }}
            onEditRole={setRoleEditor}
          />
        </>
      )}
      {helpOpen && <SectionHelp title={t("personnelHelpTitle")} intro={t("personnelHelpIntro")} steps={[{title:t("personnelHelpFindTitle"),text:t("personnelHelpFindText")},{title:t("personnelHelpAddTitle"),text:t("personnelHelpAddText")},{title:t("personnelHelpPlaceTitle"),text:t("personnelHelpPlaceText")},{title:t("personnelHelpRolesTitle"),text:t("personnelHelpRolesText")},{title:t("personnelHelpOwnershipTitle"),text:t("personnelHelpOwnershipText")}]} note={t("personnelHelpNote")} onClose={() => setHelpOpen(false)} />}
      <LocalUserDialog open={canManageSelectedSite && userCreatorOpen} units={personnelUnits} form={userForm} busy={busy} onChange={setUserForm} onSubmit={createUser} onClose={() => { setUserCreatorOpen(false); setUserForm({ displayName: "", email: "", username: "", organizationUnitId: personnelUnits[0]?.unit.id ?? "" }); }} />
      <DirectoryUserDialog
        open={canManageSelectedSite && directoryCreatorOpen}
        localEnabled={configuration.authentication.localEnabled}
        providers={directoryProviders}
        provider={directoryProvider}
        query={directoryQuery}
        results={directoryResults}
        selectedUser={selectedDirectoryUser}
        unitId={directoryUnitId}
        units={personnelUnits}
        busy={busy}
        onProviderChange={(value) => { setDirectoryProvider(value); setDirectoryQuery(""); setSelectedDirectoryUser(null); }}
        onQueryChange={(value) => { setDirectoryQuery(value); setSelectedDirectoryUser(null); }}
        onSelectUser={(person) => { setSelectedDirectoryUser(person); setDirectoryQuery(person.displayName || person.username); }}
        onUnitChange={setDirectoryUnitId}
        onSubmit={addDirectoryUser}
        onClose={() => setDirectoryCreatorOpen(false)}
      />
      <ExistingUserDialog
        open={canManageSelectedSite && existingUserCreatorOpen}
        query={existingUserQuery}
        results={existingUserResults}
        selectedUser={selectedExistingUser}
        unitId={existingUserUnitId}
        units={personnelUnits}
        busy={busy}
        onQueryChange={(value) => { setExistingUserQuery(value); setSelectedExistingUser(null); }}
        onSelectUser={(person) => { setSelectedExistingUser(person); setExistingUserQuery(person.displayName); }}
        onUnitChange={setExistingUserUnitId}
        onSubmit={addExistingLocalUser}
        onClose={() => setExistingUserCreatorOpen(false)}
      />
      <RoleCreateDialog open={canManageSelectedSite && roleCreatorOpen} units={personnelUnits} form={roleForm} busy={busy} onChange={setRoleForm} onSubmit={createRole} onClose={() => setRoleCreatorOpen(false)} />
      {canManageSelectedSite && <MemberEditDialog
        member={memberEditor}
        units={units}
        personnelUnits={personnelUnits}
        access={access}
        assignment={assignmentForm}
        canGrantParentLeadership={canGrantParentLeadership}
        busy={busy}
        onMemberChange={setMemberEditor}
        onAssignmentChange={setAssignmentForm}
        onRemoveAssignment={(assignment) => { void removeAssignment(assignment); }}
        onParentLeadershipChange={(assignment, enabled) => { void updateAssignmentParentLeadership(assignment, enabled); }}
        onAssignRole={() => { void assignRoleToMember(); }}
        onSubmit={saveMember}
        onClose={() => setMemberEditor(null)}
      />}
      {canManageSelectedSite && <PasswordResetDialog value={passwordReset} busy={busy} onSubmit={resetMemberPassword} onClose={() => setPasswordReset(null)} />}
      {canManageSelectedSite && <RemoveMemberDialog member={memberToRemove} busy={busy} onConfirm={removeMember} onClose={() => setMemberToRemove(null)} />}
      {canManageSelectedSite && <RoleEditDialog role={roleEditor} units={personnelUnits} busy={busy} onChange={setRoleEditor} onSubmit={saveRole} onDelete={deleteRole} onClose={() => setRoleEditor(null)} />}
    </div>
  );
}
