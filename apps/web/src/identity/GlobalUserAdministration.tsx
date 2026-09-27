import { useEffect, useState } from "react";
import type React from "react";
import { Modal } from "../components/Modal";
import type { GlobalUser, UserSite } from "./models";
import {
  assignGlobalUsers,
  deleteGlobalUsers,
  loadGlobalUsers,
  moveGlobalUser,
  resetGlobalPasswords,
} from "./identityApi";
import type { PasswordResetCode } from "./identityApi";

export function GlobalUserAdministration({
  language: displayLanguage,
  timeZone: displayTimeZone,
  refreshToken,
  setError,
  setNotice,
}: {
  language: string;
  timeZone: string;
  refreshToken: number;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
}) {
  const [users,setUsers]=useState<GlobalUser[]>([]);
  const [userSites,setUserSites]=useState<UserSite[]>([]);
  const [userQuery,setUserQuery]=useState("");
  const [userSiteFilter,setUserSiteFilter]=useState("");
  const [userPage,setUserPage]=useState(1);
  const [userTotal,setUserTotal]=useState(0);
  const [usersLoading,setUsersLoading]=useState(true);
  const [movingUser,setMovingUser]=useState<GlobalUser|null>(null);
  const [moveSourceSiteId,setMoveSourceSiteId]=useState("");
  const [moveTargetSiteId,setMoveTargetSiteId]=useState("");
  const [moving,setMoving]=useState(false);
  const [bulkPasswordOpen,setBulkPasswordOpen]=useState(false);
  const [passwordResetCodes,setPasswordResetCodes]=useState<PasswordResetCode[]>([]);
  const [resettingPassword,setResettingPassword]=useState(false);
  const [selectedUserIds,setSelectedUserIds]=useState<Set<string>>(new Set());
  const [bulkAssignOpen,setBulkAssignOpen]=useState(false);
  const [bulkDeleteOpen,setBulkDeleteOpen]=useState(false);
  const [bulkTargetSiteId,setBulkTargetSiteId]=useState("");
  const [bulkBusy,setBulkBusy]=useState(false);
  const userPageSize=25;
  async function loadUsers(nextPage=1,query=userQuery,siteFilter=userSiteFilter){
    setUsersLoading(true);
    try {
      const result=await loadGlobalUsers(nextPage,userPageSize,query,siteFilter);
      setUsers(result.items);setUserSites(result.sites);setUserTotal(result.total);setUserPage(result.page);setSelectedUserIds(new Set());
    } finally {
      setUsersLoading(false);
    }
  }
  useEffect(() => {
    void loadUsers(refreshToken === 0 ? 1 : userPage, refreshToken === 0 ? "" : userQuery).catch((problem) =>
      setError(problem instanceof Error ? problem.message : "Den globale brukeroversikten kunne ikke lastes."),
    );
  }, [refreshToken]);

  function openMove(user:GlobalUser){const source=user.siteMemberships.find(membership=>membership.isActive)?.siteId??"";setMovingUser(user);setMoveSourceSiteId(source);setMoveTargetSiteId(userSites.find(site=>site.id!==source&&!user.siteMemberships.some(membership=>membership.siteId===site.id&&membership.isActive))?.id??"");}
  async function moveUser(event:React.FormEvent){event.preventDefault();if(!movingUser||!moveSourceSiteId||!moveTargetSiteId)return;setMoving(true);setError("");try{await moveGlobalUser(movingUser.id,moveSourceSiteId,moveTargetSiteId);setMovingUser(null);setNotice(`${movingUser.displayName} er flyttet. Mottakende Site Manager må tildele enhet og roller.`);await loadUsers(userPage);}catch(problem){setError(problem instanceof Error?problem.message:"Brukeren kunne ikke flyttes.");}finally{setMoving(false);}}
  async function resetGlobalUserPasswords(event:React.FormEvent){event.preventDefault();const ids=[...selectedUserIds];if(ids.length===0)return;setResettingPassword(true);setError("");try{const result=await resetGlobalPasswords(ids);setPasswordResetCodes(result.resetCodes);setNotice(`Engangskoder er opprettet for ${ids.length} bruker(e).`);await loadUsers(userPage);}catch(problem){setError(problem instanceof Error?problem.message:"Engangskodene kunne ikke opprettes.");}finally{setResettingPassword(false);}}
  const orphanUsers=users.filter(user=>!user.siteMemberships.some(membership=>membership.isActive)&&!user.loginIdentities.some(identity=>identity.isPlatformManager));
  const resettableUsers=users.filter(user=>!user.loginIdentities.some(identity=>identity.isPlatformManager)&&user.loginIdentities.some(identity=>identity.isActive)&&!user.externalIdentities.some(identity=>identity.isActive&&(identity.provider==="ad"||identity.provider==="ldap")));
  const selectableUsers=(userQuery||userSiteFilter)?resettableUsers:orphanUsers;
  const selectedUsers=selectableUsers.filter(user=>selectedUserIds.has(user.id));
  const selectedOrphans=orphanUsers.filter(user=>selectedUserIds.has(user.id));
  function selectUser(id:string,checked:boolean){setSelectedUserIds(current=>{const next=new Set(current);if(checked)next.add(id);else next.delete(id);return next;});}
  function selectAll(checked:boolean){setSelectedUserIds(checked?new Set(selectableUsers.map(user=>user.id)):new Set());}
  function beginAssign(ids:string[]){setSelectedUserIds(new Set(ids));setBulkTargetSiteId(userSites[0]?.id??"");setBulkAssignOpen(true);}
  function beginDelete(ids:string[]){setSelectedUserIds(new Set(ids));setBulkDeleteOpen(true);}
  async function bulkAction(kind:"assign"|"delete"){const ids=[...selectedUserIds];if(ids.length===0)return;setBulkBusy(true);setError("");try{if(kind==="assign")await assignGlobalUsers(ids,bulkTargetSiteId);else await deleteGlobalUsers(ids);setBulkAssignOpen(false);setBulkDeleteOpen(false);setNotice(kind==="assign"?`${ids.length} bruker(e) er tildelt siten.`:`${ids.length} bruker(e) er slettet. Historiske aktørreferanser er beholdt.`);await loadUsers(1,userQuery);}catch(problem){setError(problem instanceof Error?problem.message:kind==="assign"?"Brukerne kunne ikke tildeles siten.":"Brukerne kunne ikke slettes.");}finally{setBulkBusy(false);}}
  return (
    <>
      <section className="panel platform-user-overview">
        <div className="section-heading"><div><h2>Global brukeroversikt</h2><p className="muted">Uten søk vises bare brukere uten aktiv site. Søk for å finne øvrige personer i installasjonen.</p></div><span className="muted">{userTotal} treff</span></div>
        <form className="platform-user-search" onSubmit={event=>{event.preventDefault();void loadUsers(1).catch(problem=>setError(problem instanceof Error?problem.message:"Brukersøket kunne ikke fullføres."));}}><div className="field"><label htmlFor="global-user-search">Søk i navn, e-post, brukernavn eller identitetsleverandør</label><input id="global-user-search" type="search" value={userQuery} onChange={event=>setUserQuery(event.target.value)} placeholder="Søk etter bruker"/></div><div className="field"><label htmlFor="global-user-site-filter">Site</label><select id="global-user-site-filter" value={userSiteFilter} onChange={event=>setUserSiteFilter(event.target.value)}><option value="">Ingen site-filtrering</option>{userSites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></div><button className="secondary-button" type="submit">Søk</button>{(userQuery||userSiteFilter)&&<button className="text-button" type="button" onClick={()=>{setUserQuery("");setUserSiteFilter("");void loadUsers(1,"","");}}>Nullstill</button>}</form>
        {!usersLoading&&selectableUsers.length>0&&<div className="platform-user-bulk"><label><input type="checkbox" checked={selectableUsers.every(user=>selectedUserIds.has(user.id))} onChange={event=>selectAll(event.target.checked)}/> Velg alle på siden</label><span>{selectedUsers.length} valgt</span><button className="secondary-button" type="button" disabled={selectedUsers.length===0} onClick={()=>{setPasswordResetCodes([]);setBulkPasswordOpen(true);}}>Tilbakestill passord</button>{selectedUsers.length>0&&selectedUsers.length===selectedOrphans.length&&<><button className="secondary-button" type="button" onClick={()=>beginAssign(selectedOrphans.map(user=>user.id))}>Tildel site</button><button className="danger-button" type="button" onClick={()=>beginDelete(selectedOrphans.map(user=>user.id))}>Slett</button></>}</div>}
        {!usersLoading&&users.length>0&&<div className="platform-user-columns" aria-hidden="true"><span/><span>Bruker</span><span>Identitet</span><span>Site</span><span>Sist innlogget</span><span>Handlinger</span></div>}
        {usersLoading?<p className="muted">Laster brukere …</p>:users.length===0?<p className="empty-state">{userQuery||userSiteFilter?"Ingen brukere samsvarer med filteret.":"Ingen brukere mangler aktiv site."}</p>:<div className="platform-user-list">{users.map(user=>{const activeMemberships=user.siteMemberships.filter(membership=>membership.isActive);const activeExternal=user.externalIdentities.filter(identity=>identity.isActive);const platformManager=user.loginIdentities.some(identity=>identity.isPlatformManager);const hasLocalLogin=user.loginIdentities.some(identity=>identity.isActive);const directoryManaged=activeExternal.some(identity=>identity.provider==="ad"||identity.provider==="ldap");const orphan=activeMemberships.length===0&&!platformManager;const selectable=selectableUsers.some(candidate=>candidate.id===user.id);const lastLogin=user.loginIdentities.map(identity=>identity.lastSignedInAt).filter((value):value is string=>Boolean(value)).sort().at(-1);return <article className="platform-user-row" key={user.id}>{selectable?<input className="platform-user-select" type="checkbox" aria-label={`Velg ${user.displayName}`} checked={selectedUserIds.has(user.id)} onChange={event=>selectUser(user.id,event.target.checked)}/>:<span/>}<div className="platform-user-primary"><strong>{user.displayName}</strong><span>{user.email??"Ingen e-postadresse"}</span><small className="muted">{user.loginIdentities.map(identity=>identity.username).join(", ")||"Ingen lokal innlogging"}</small></div><div className="platform-user-identities">{platformManager?<span className="identity-source platform">Systemkonto</span>:user.loginIdentities.length>0&&<span className="identity-source local">Lokal</span>}{activeExternal.map(identity=><span className="identity-source external" key={`${user.id}-${identity.provider}`}>{identity.provider.toUpperCase()}</span>)}{!user.isActive&&<span className="identity-source inactive">Deaktivert</span>}</div><div className="platform-user-sites">{platformManager?<span className="muted">Plattform</span>:activeMemberships.length?activeMemberships.map(membership=><span key={membership.siteId}>{membership.siteName}{membership.isSiteManager?" · Site Manager":""}</span>):<span className="muted">Ingen aktiv site</span>}</div><div className="platform-user-login"><span className="muted">Sist innlogget</span><strong>{lastLogin?new Intl.DateTimeFormat(displayLanguage,{dateStyle:"medium",timeStyle:"short",timeZone:displayTimeZone}).format(new Date(lastLogin)):"Aldri"}</strong></div><div className="platform-user-actions">{platformManager?<span className="muted">Plattformforvaltet</span>:user.isCurrentUser?<span className="muted">Innlogget bruker</span>:orphan?<><button className="secondary-button" type="button" onClick={()=>beginAssign([user.id])}>Tildel site</button><button className="link-button danger" type="button" onClick={()=>beginDelete([user.id])}>Slett</button></>:<button className="secondary-button" type="button" disabled={activeMemberships.length===0||userSites.every(site=>activeMemberships.some(membership=>membership.siteId===site.id))} onClick={()=>openMove(user)}>Flytt</button>}</div></article>;})}</div>}
        {userTotal>userPageSize&&<div className="pagination"><button className="secondary-button" type="button" disabled={userPage<=1||usersLoading} onClick={()=>void loadUsers(userPage-1).catch(problem=>setError(problem instanceof Error?problem.message:"Brukersiden kunne ikke lastes."))}>Forrige</button><span>Side {userPage} av {Math.ceil(userTotal/userPageSize)}</span><button className="secondary-button" type="button" disabled={userPage>=Math.ceil(userTotal/userPageSize)||usersLoading} onClick={()=>void loadUsers(userPage+1).catch(problem=>setError(problem instanceof Error?problem.message:"Brukersiden kunne ikke lastes."))}>Neste</button></div>}
      </section>
      {movingUser&&<Modal title="Flytt bruker mellom sites" onClose={()=>!moving&&setMovingUser(null)}><form className="stacked-form" onSubmit={moveUser}><p><strong>{movingUser.displayName}</strong>{movingUser.email&&<> · {movingUser.email}</>}</p><div className="field"><label htmlFor="move-user-source">Fra site</label><select id="move-user-source" value={moveSourceSiteId} onChange={event=>{const source=event.target.value;setMoveSourceSiteId(source);setMoveTargetSiteId(userSites.find(site=>site.id!==source&&!movingUser.siteMemberships.some(membership=>membership.siteId===site.id&&membership.isActive))?.id??"");}}>{movingUser.siteMemberships.filter(membership=>membership.isActive).map(membership=><option key={membership.siteId} value={membership.siteId}>{membership.siteName}</option>)}</select></div><div className="field"><label htmlFor="move-user-target">Til site</label><select id="move-user-target" value={moveTargetSiteId} onChange={event=>setMoveTargetSiteId(event.target.value)}>{userSites.filter(site=>site.id!==moveSourceSiteId&&!movingUser.siteMemberships.some(membership=>membership.siteId===site.id&&membership.isActive)).map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></div><p className="status-message">Identitet og historikk beholdes. Enhetstilknytning, roller og Site Manager-ansvar i kildesiten fjernes. Mottakende Site Manager må plassere brukeren og tildele nødvendige roller.</p><div className="modal-actions"><button className="secondary-button" type="button" disabled={moving} onClick={()=>setMovingUser(null)}>Avbryt</button><button className="primary-button" type="submit" disabled={moving||!moveTargetSiteId}>{moving?"Flytter …":"Flytt bruker"}</button></div></form></Modal>}
      {bulkPasswordOpen&&<Modal title="Tilbakestill passord" onClose={()=>!resettingPassword&&setBulkPasswordOpen(false)}><form className="stacked-form" onSubmit={resetGlobalUserPasswords}>{passwordResetCodes.length===0?<p className="muted modal-note">Opprett individuelle engangskoder for <strong>{selectedUserIds.size} valgte bruker(e)</strong>. Brukerne velger selv nye passord. Kodene vises bare én gang og utløper etter 30 minutter.</p>:<div className="stacked-form">{passwordResetCodes.map(value=><div className="field" key={value.personId}><label htmlFor={`platform-reset-${value.personId}`}>{value.displayName}</label><input id={`platform-reset-${value.personId}`} readOnly value={value.resetCode} onFocus={event=>event.currentTarget.select()}/></div>)}</div>}<div className="modal-actions"><button className="secondary-button" type="button" disabled={resettingPassword} onClick={()=>setBulkPasswordOpen(false)}>{passwordResetCodes.length?"Lukk":"Avbryt"}</button>{passwordResetCodes.length===0&&<button className="primary-button" type="submit" disabled={resettingPassword}>{resettingPassword?"Oppretter …":"Opprett engangskoder"}</button>}</div></form></Modal>}
      {bulkAssignOpen&&<Modal title="Tildel brukere til site" onClose={()=>!bulkBusy&&setBulkAssignOpen(false)}><form className="stacked-form" onSubmit={event=>{event.preventDefault();void bulkAction("assign");}}><p>{selectedUserIds.size} bruker(e) tildeles valgt site uten enhet eller roller.</p><div className="field"><label htmlFor="bulk-user-site">Site</label><select id="bulk-user-site" value={bulkTargetSiteId} onChange={event=>setBulkTargetSiteId(event.target.value)}>{userSites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></div><p className="muted">Mottakende Site Manager må plassere brukerne i riktig enhet og tildele roller.</p><div className="modal-actions"><button className="secondary-button" type="button" disabled={bulkBusy} onClick={()=>setBulkAssignOpen(false)}>Avbryt</button><button className="primary-button" type="submit" disabled={bulkBusy||!bulkTargetSiteId}>{bulkBusy?"Tildeler …":"Tildel site"}</button></div></form></Modal>}
      {bulkDeleteOpen&&<Modal title="Slett brukere" onClose={()=>!bulkBusy&&setBulkDeleteOpen(false)}><div className="stacked-form"><p><strong>{selectedUserIds.size} bruker(e) slettes.</strong></p><p>Innlogging, e-post, profilbilde og eksterne identitetskoblinger fjernes. Navn og intern person-ID beholdes låst i historiske oppgaver, rapporter, beslutninger og revisjon.</p><div className="modal-actions"><button className="secondary-button" type="button" disabled={bulkBusy} onClick={()=>setBulkDeleteOpen(false)}>Avbryt</button><button className="danger-button" type="button" disabled={bulkBusy} onClick={()=>void bulkAction("delete")}>{bulkBusy?"Sletter …":"Slett valgte"}</button></div></div></Modal>}
    </>
  );
}
