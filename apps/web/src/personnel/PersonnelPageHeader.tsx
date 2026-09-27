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
  return (
    <header className="page-header">
      <div>
        <h1>Personell</h1>
        <p className="muted">Brukere, roller og bemanning.</p>
      </div>
      <div className="task-actions" aria-label="Personellhandlinger">
        <button className="help-button" type="button" onClick={onHelp}><i aria-hidden="true">?</i><span>Hjelp</span></button>
        {canManage && <>
          {localEnabled && <button className="primary-button" type="button" onClick={onCreateLocalUser}>Legg til lokal bruker</button>}
          {localEnabled && <button className="secondary-button" type="button" disabled={!hasUnits} onClick={onAddExistingUser}>Legg til eksisterende bruker</button>}
          {directoryEnabled && <button className={localEnabled ? "secondary-button" : "primary-button"} type="button" disabled={!hasUnits} onClick={onAddDirectoryUser}>{localEnabled ? "Legg til fra AD/LDAP" : "Legg til bruker"}</button>}
          <button className="secondary-button" type="button" disabled={!hasUnits} onClick={onCreateRole}>Opprett arbeidsrolle</button>
        </>}
      </div>
    </header>
  );
}
