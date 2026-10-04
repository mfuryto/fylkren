import { GovernanceLifecycleButton } from "../components/WorkLifecycleButton";
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
  terminateAllGlobalUserSessions,
  terminateGlobalUserSessions,
} from "./identityApi";
import type { PasswordResetCode } from "./identityApi";
import { useTranslation } from "../localization/LocalizationProvider";
import { ListSortControl, type ListSort } from "../components/ListSortControl";

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
  const t = useTranslation();
  const [users,setUsers]=useState<GlobalUser[]>([]);
  const [userSites,setUserSites]=useState<UserSite[]>([]);
  const [userQuery,setUserQuery]=useState("");
  const [userSiteFilter,setUserSiteFilter]=useState("");
  const [userPage,setUserPage]=useState(1);
  const [userTotal,setUserTotal]=useState(0);
  const [usersLoading,setUsersLoading]=useState(true);
  const [sort,setSort]=useState<ListSort>("name-asc");
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
  const [terminateUser,setTerminateUser]=useState<GlobalUser|null>(null);
  const [terminateAllOpen,setTerminateAllOpen]=useState(false);
  const [terminating,setTerminating]=useState(false);
  const userPageSize=25;
  async function loadUsers(nextPage=1,query=userQuery,siteFilter=userSiteFilter,requestedSort=sort){
    setUsersLoading(true);
    try {
      const result=await loadGlobalUsers(nextPage,userPageSize,query,siteFilter,requestedSort);
      setUsers(result.items);setUserSites(result.sites);setUserTotal(result.total);setUserPage(result.page);setSelectedUserIds(new Set());
    } finally {
      setUsersLoading(false);
    }
  }
  useEffect(() => {
    void loadUsers(refreshToken === 0 ? 1 : userPage, refreshToken === 0 ? "" : userQuery).catch((problem) =>
      setError(problem instanceof Error ? problem.message : t("globalUsersLoadFailed")),
    );
  }, [refreshToken]);

  function openMove(user:GlobalUser){const source=user.siteMemberships.find(membership=>membership.isActive)?.siteId??"";setMovingUser(user);setMoveSourceSiteId(source);setMoveTargetSiteId(userSites.find(site=>site.id!==source&&!user.siteMemberships.some(membership=>membership.siteId===site.id&&membership.isActive))?.id??"");}
  async function moveUser(event:React.FormEvent){event.preventDefault();if(!movingUser||!moveSourceSiteId||!moveTargetSiteId)return;setMoving(true);setError("");try{await moveGlobalUser(movingUser.id,moveSourceSiteId,moveTargetSiteId);setMovingUser(null);setNotice(t("userMoved",{name:movingUser.displayName}));await loadUsers(userPage);}catch(problem){setError(problem instanceof Error?problem.message:t("userMoveFailed"));}finally{setMoving(false);}}
  async function resetGlobalUserPasswords(event:React.FormEvent){event.preventDefault();const ids=[...selectedUserIds];if(ids.length===0)return;setResettingPassword(true);setError("");try{const result=await resetGlobalPasswords(ids);setPasswordResetCodes(result.resetCodes);setNotice(t("resetCodesCreated",{count:ids.length}));await loadUsers(userPage);}catch(problem){setError(problem instanceof Error?problem.message:t("resetCodesCreateFailed"));}finally{setResettingPassword(false);}}
  const orphanUsers=users.filter(user=>!user.siteMemberships.some(membership=>membership.isActive)&&!user.loginIdentities.some(identity=>identity.isPlatformManager));
  const resettableUsers=users.filter(user=>!user.loginIdentities.some(identity=>identity.isPlatformManager)&&user.loginIdentities.some(identity=>identity.isActive)&&!user.externalIdentities.some(identity=>identity.isActive&&(identity.provider==="ad"||identity.provider==="ldap")));
  const selectableUsers=(userQuery||userSiteFilter)?resettableUsers:orphanUsers;
  const selectedUsers=selectableUsers.filter(user=>selectedUserIds.has(user.id));
  const selectedOrphans=orphanUsers.filter(user=>selectedUserIds.has(user.id));
  function selectUser(id:string,checked:boolean){setSelectedUserIds(current=>{const next=new Set(current);if(checked)next.add(id);else next.delete(id);return next;});}
  function selectAll(checked:boolean){setSelectedUserIds(checked?new Set(selectableUsers.map(user=>user.id)):new Set());}
  function beginAssign(ids:string[]){setSelectedUserIds(new Set(ids));setBulkTargetSiteId(userSites[0]?.id??"");setBulkAssignOpen(true);}
  function beginDelete(ids:string[]){setSelectedUserIds(new Set(ids));setBulkDeleteOpen(true);}
  async function bulkAction(kind:"assign"|"delete"){const ids=[...selectedUserIds];if(ids.length===0)return;setBulkBusy(true);setError("");try{if(kind==="assign")await assignGlobalUsers(ids,bulkTargetSiteId);else await deleteGlobalUsers(ids);setBulkAssignOpen(false);setBulkDeleteOpen(false);setNotice(t(kind==="assign"?"usersAssigned":"usersDeleted",{count:ids.length}));await loadUsers(1,userQuery);}catch(problem){setError(problem instanceof Error?problem.message:t(kind==="assign"?"usersAssignFailed":"usersDeleteFailed"));}finally{setBulkBusy(false);}}
  async function terminateSessions(){if(!terminateUser)return;setTerminating(true);setError("");try{await terminateGlobalUserSessions(terminateUser.id);setNotice(t("userSessionsTerminated",{name:terminateUser.displayName}));setTerminateUser(null);}catch(problem){setError(problem instanceof Error?problem.message:t("terminateSessionsFailed"));}finally{setTerminating(false);}}
  async function terminateAllSessions(){setTerminating(true);setError("");try{await terminateAllGlobalUserSessions();window.location.assign("/");}catch(problem){setError(problem instanceof Error?problem.message:t("terminateSessionsFailed"));setTerminating(false);}}
  return (
    <>
      <section className="panel platform-user-overview">
        <div className="section-heading"><div><h2>{t("userDirectory")}</h2><p className="muted">{t("userDirectoryIntro")}</p></div><div className="inline-actions"><button className="danger-button" type="button" onClick={()=>setTerminateAllOpen(true)}>{t("terminateAllSessions")}</button><ListSortControl id="global-user-sort" value={sort} onChange={value=>{setSort(value);void loadUsers(1,userQuery,userSiteFilter,value);}}/><span className="muted">{t("results",{count:userTotal})}</span></div></div>
        <form className="platform-user-search" onSubmit={event=>{event.preventDefault();void loadUsers(1).catch(problem=>setError(problem instanceof Error?problem.message:t("userSearchFailed")));}}><div className="field"><label htmlFor="global-user-search">{t("searchUserFields")}</label><input id="global-user-search" type="search" value={userQuery} onChange={event=>setUserQuery(event.target.value)} placeholder={t("searchForUser")}/></div><div className="field"><label htmlFor="global-user-site-filter">{t("site")}</label><select id="global-user-site-filter" value={userSiteFilter} onChange={event=>setUserSiteFilter(event.target.value)}><option value="">{t("noSiteFilter")}</option>{userSites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></div><button className="secondary-button" type="submit">{t("search")}</button>{(userQuery||userSiteFilter)&&<button className="text-button" type="button" onClick={()=>{setUserQuery("");setUserSiteFilter("");void loadUsers(1,"","");}}>{t("clearSearch")}</button>}</form>
        {!usersLoading&&selectableUsers.length>0&&<div className="platform-user-bulk"><label><input type="checkbox" checked={selectableUsers.every(user=>selectedUserIds.has(user.id))} onChange={event=>selectAll(event.target.checked)}/> {t("selectPage")}</label><span>{t("selectedCount",{count:selectedUsers.length})}</span><button className="secondary-button" type="button" disabled={selectedUsers.length===0} onClick={()=>{setPasswordResetCodes([]);setBulkPasswordOpen(true);}}>{t("resetPassword")}</button>{selectedUsers.length>0&&selectedUsers.length===selectedOrphans.length&&<><button className="secondary-button" type="button" onClick={()=>beginAssign(selectedOrphans.map(user=>user.id))}>{t("assignSite")}</button><button className="danger-button" type="button" onClick={()=>beginDelete(selectedOrphans.map(user=>user.id))}>{t("delete")}</button></>}</div>}
        {!usersLoading&&users.length>0&&<div className="platform-user-columns" aria-hidden="true"><span/><span>{t("user")}</span><span>{t("userIdentity")}</span><span>{t("site")}</span><span>{t("lastSignedIn")}</span><span>{t("actions")}</span></div>}
        {usersLoading?<p className="muted">{t("loadingUsers")}</p>:users.length===0?<p className="empty-state">{userQuery||userSiteFilter?t("noUsersMatch"):t("noUsersWithoutSite")}</p>:<div className="platform-user-list">{users.map(user=>{const activeMemberships=user.siteMemberships.filter(membership=>membership.isActive);const activeExternal=user.externalIdentities.filter(identity=>identity.isActive);const platformManager=user.loginIdentities.some(identity=>identity.isPlatformManager);const orphan=activeMemberships.length===0&&!platformManager;const selectable=selectableUsers.some(candidate=>candidate.id===user.id);const lastLogin=user.loginIdentities.map(identity=>identity.lastSignedInAt).filter((value):value is string=>Boolean(value)).sort().at(-1);return <article className="platform-user-row" key={user.id}>{selectable?<input className="platform-user-select" type="checkbox" aria-label={t("selectUser",{name:user.displayName})} checked={selectedUserIds.has(user.id)} onChange={event=>selectUser(user.id,event.target.checked)}/>:<span/>}<div className="platform-user-primary"><strong>{user.displayName}</strong><span>{user.email??t("noEmailAddress")}</span><small className="muted">{user.loginIdentities.map(identity=>identity.username).join(", ")||t("noLocalSignIn")}</small></div><div className="platform-user-identities">{platformManager?<span className="identity-source platform">{t("systemAccount")}</span>:user.loginIdentities.length>0&&<span className="identity-source local">{t("localIdentity")}</span>}{activeExternal.map(identity=><span className="identity-source external" key={`${user.id}-${identity.provider}`}>{identity.provider.toUpperCase()}</span>)}{!user.isActive&&<span className="identity-source inactive">{t("inactive")}</span>}</div><div className="platform-user-sites">{platformManager?<span className="muted">{t("platform")}</span>:activeMemberships.length?activeMemberships.map(membership=><span key={membership.siteId}>{membership.siteName}{membership.isSiteManager?" · Site Manager":""}</span>):<span className="muted">{t("noActiveSite")}</span>}</div><div className="platform-user-login"><span className="muted">{t("lastSignedIn")}</span><strong>{lastLogin?new Intl.DateTimeFormat(displayLanguage,{dateStyle:"medium",timeStyle:"short",timeZone:displayTimeZone}).format(new Date(lastLogin)):t("never")}</strong></div><div className="platform-user-actions">{!user.isCurrentUser&&user.loginIdentities.some(identity=>identity.isActive)&&<button className="secondary-button" type="button" onClick={()=>setTerminateUser(user)}>{t("terminateSessions")}</button>}<GovernanceLifecycleButton kind="person" id={user.id} name={user.displayName} />{platformManager?<span className="muted">{t("platformManaged")}</span>:user.isCurrentUser?<span className="muted">{t("signedInUser")}</span>:orphan?<><button className="secondary-button" type="button" onClick={()=>beginAssign([user.id])}>{t("assignSite")}</button><button className="link-button danger" type="button" onClick={()=>beginDelete([user.id])}>{t("delete")}</button></>:<button className="secondary-button" type="button" disabled={activeMemberships.length===0||userSites.every(site=>activeMemberships.some(membership=>membership.siteId===site.id))} onClick={()=>openMove(user)}>{t("move")}</button>}</div></article>;})}</div>}
        {userTotal>userPageSize&&<div className="pagination"><button className="secondary-button" type="button" disabled={userPage<=1||usersLoading} onClick={()=>void loadUsers(userPage-1).catch(problem=>setError(problem instanceof Error?problem.message:t("userPageLoadFailed")))}>{t("previous")}</button><span>{t("pageOf",{page:userPage,totalPages:Math.ceil(userTotal/userPageSize)})}</span><button className="secondary-button" type="button" disabled={userPage>=Math.ceil(userTotal/userPageSize)||usersLoading} onClick={()=>void loadUsers(userPage+1).catch(problem=>setError(problem instanceof Error?problem.message:t("userPageLoadFailed")))}>{t("next")}</button></div>}
      </section>
      {movingUser&&<Modal title={t("moveUserBetweenSites")} onClose={()=>!moving&&setMovingUser(null)}><form className="stacked-form" onSubmit={moveUser}><p><strong>{movingUser.displayName}</strong>{movingUser.email&&<> · {movingUser.email}</>}</p><div className="field"><label htmlFor="move-user-source">{t("fromSite")}</label><select id="move-user-source" value={moveSourceSiteId} onChange={event=>{const source=event.target.value;setMoveSourceSiteId(source);setMoveTargetSiteId(userSites.find(site=>site.id!==source&&!movingUser.siteMemberships.some(membership=>membership.siteId===site.id&&membership.isActive))?.id??"");}}>{movingUser.siteMemberships.filter(membership=>membership.isActive).map(membership=><option key={membership.siteId} value={membership.siteId}>{membership.siteName}</option>)}</select></div><div className="field"><label htmlFor="move-user-target">{t("toSite")}</label><select id="move-user-target" value={moveTargetSiteId} onChange={event=>setMoveTargetSiteId(event.target.value)}>{userSites.filter(site=>site.id!==moveSourceSiteId&&!movingUser.siteMemberships.some(membership=>membership.siteId===site.id&&membership.isActive)).map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></div><p className="status-message">{t("moveUserWarning")}</p><div className="modal-actions"><button className="secondary-button" type="button" disabled={moving} onClick={()=>setMovingUser(null)}>{t("cancel")}</button><button className="primary-button" type="submit" disabled={moving||!moveTargetSiteId}>{moving?t("moving"):t("moveUser")}</button></div></form></Modal>}
      {bulkPasswordOpen&&<Modal title={t("resetPasswords")} onClose={()=>!resettingPassword&&setBulkPasswordOpen(false)}><form className="stacked-form" onSubmit={resetGlobalUserPasswords}>{passwordResetCodes.length===0?<p className="muted modal-note">{t("resetPasswordIntro",{count:selectedUserIds.size})}</p>:<div className="stacked-form">{passwordResetCodes.map(value=><div className="field" key={value.personId}><label htmlFor={`platform-reset-${value.personId}`}>{value.displayName}</label><input id={`platform-reset-${value.personId}`} readOnly value={value.resetCode} onFocus={event=>event.currentTarget.select()}/></div>)}</div>}<div className="modal-actions"><button className="secondary-button" type="button" disabled={resettingPassword} onClick={()=>setBulkPasswordOpen(false)}>{passwordResetCodes.length?t("close"):t("cancel")}</button>{passwordResetCodes.length===0&&<button className="primary-button" type="submit" disabled={resettingPassword}>{resettingPassword?t("creating"):t("createResetCodes")}</button>}</div></form></Modal>}
      {bulkAssignOpen&&<Modal title={t("assignUsersToSite")} onClose={()=>!bulkBusy&&setBulkAssignOpen(false)}><form className="stacked-form" onSubmit={event=>{event.preventDefault();void bulkAction("assign");}}><p>{t("assignUsersCount",{count:selectedUserIds.size})}</p><div className="field"><label htmlFor="bulk-user-site">{t("site")}</label><select id="bulk-user-site" value={bulkTargetSiteId} onChange={event=>setBulkTargetSiteId(event.target.value)}>{userSites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></div><p className="muted">{t("receivingManagerAction")}</p><div className="modal-actions"><button className="secondary-button" type="button" disabled={bulkBusy} onClick={()=>setBulkAssignOpen(false)}>{t("cancel")}</button><button className="primary-button" type="submit" disabled={bulkBusy||!bulkTargetSiteId}>{bulkBusy?t("assigning"):t("assignSite")}</button></div></form></Modal>}
      {bulkDeleteOpen&&<Modal title={t("deleteUsers")} onClose={()=>!bulkBusy&&setBulkDeleteOpen(false)}><div className="stacked-form"><p><strong>{t("deleteUsersCount",{count:selectedUserIds.size})}</strong></p><p>{t("deleteUsersWarning")}</p><div className="modal-actions"><button className="secondary-button" type="button" disabled={bulkBusy} onClick={()=>setBulkDeleteOpen(false)}>{t("cancel")}</button><button className="danger-button" type="button" disabled={bulkBusy} onClick={()=>void bulkAction("delete")}>{bulkBusy?t("deleting"):t("deleteSelected")}</button></div></div></Modal>}
      {terminateUser&&<Modal title={t("terminateSessions")} onClose={()=>!terminating&&setTerminateUser(null)}><div className="stacked-form"><p>{t("terminateUserSessionsWarning",{name:terminateUser.displayName})}</p><div className="modal-actions"><button className="secondary-button" type="button" disabled={terminating} onClick={()=>setTerminateUser(null)}>{t("cancel")}</button><button className="danger-button" type="button" disabled={terminating} onClick={()=>void terminateSessions()}>{terminating?t("terminatingSessions"):t("terminateSessions")}</button></div></div></Modal>}
      {terminateAllOpen&&<Modal title={t("terminateAllSessions")} onClose={()=>!terminating&&setTerminateAllOpen(false)}><div className="stacked-form"><p>{t("terminateAllSessionsWarning")}</p><div className="modal-actions"><button className="secondary-button" type="button" disabled={terminating} onClick={()=>setTerminateAllOpen(false)}>{t("cancel")}</button><button className="danger-button" type="button" disabled={terminating} onClick={()=>void terminateAllSessions()}>{terminating?t("terminatingSessions"):t("terminateAllSessions")}</button></div></div></Modal>}
    </>
  );
}
