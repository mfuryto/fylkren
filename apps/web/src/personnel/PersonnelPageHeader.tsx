type PersonnelPageHeaderProps = {
  canManage: boolean;
  localEnabled: boolean;
  directoryEnabled: boolean;
  hasUnits: boolean;
  onHelp: () => void;
  onCreateLocalUser: () => void;
  onAddExistingUser: () => void;
  onAddDirectoryUser: () => void;
  onCreateRole: () => void;
};

export function PersonnelPageHeader({
  canManage,
  localEnabled,
  directoryEnabled,
  hasUnits,
  onHelp,
  onCreateLocalUser,
  onAddExistingUser,
  onAddDirectoryUser,
  onCreateRole,
}: PersonnelPageHeaderProps) {
  const t = useTranslation();
  return (
    <header className="page-header">
      <div>
        <h1>{t("personnel")}</h1>
        <p className="muted">{t("personnelIntro")}</p>
      </div>
      <div className="task-actions" aria-label={t("personnelActions")}>
        <button className="help-button" type="button" onClick={onHelp}><i aria-hidden="true">?</i><span>{t("help")}</span></button>
        {canManage && <>
          {localEnabled && <button className="primary-button" type="button" onClick={onCreateLocalUser}>{t("addLocalUser")}</button>}
          {localEnabled && <button className="secondary-button" type="button" disabled={!hasUnits} onClick={onAddExistingUser}>{t("addExistingUser")}</button>}
          {directoryEnabled && <button className={localEnabled ? "secondary-button" : "primary-button"} type="button" disabled={!hasUnits} onClick={onAddDirectoryUser}>{localEnabled ? t("addDirectoryPersonnel") : t("addUser")}</button>}
          <button className="secondary-button" type="button" disabled={!hasUnits} onClick={onCreateRole}>{t("createWorkRole")}</button>
        </>}
      </div>
    </header>
  );
}
import { useTranslation } from "../localization/LocalizationProvider";
