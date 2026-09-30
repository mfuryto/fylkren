import { useEffect, useState } from "react";
import type React from "react";
import type { DirectoryIdentityLink, FederatedIdentityLink, IdentityConfiguration } from "./models";
import { addDirectoryIdentity, addOidcIdentity, addSamlIdentity, loadDirectoryLinks, loadIdentityConfiguration, loadOidcLinks, loadSamlLinks, removeDirectoryIdentity, removeOidcIdentity, removeSamlIdentity, synchronizeDirectoryLifecycle, testDirectoryConnection } from "./identityApi";
import { GlobalUserAdministration } from "./GlobalUserAdministration";
import { errorMessage } from "../api/errors";
import { EnterpriseRequiredNotice } from "../components/EnterpriseRequiredNotice";
import { IdentityProviderSettingsDialog } from "./IdentityProviderSettingsDialog";
import type { IdentityProvider } from "./models";
import { useTranslation } from "../localization/LocalizationProvider";

export function IdentityProvidersPage({ language: displayLanguage, timeZone: displayTimeZone, canManageExternalIdentity }: { language: string; timeZone: string; canManageExternalIdentity: boolean }) {
  const t = useTranslation();
  const [data, setData] = useState<IdentityConfiguration | null>(null);
  const [oidcLinks,setOidcLinks]=useState<FederatedIdentityLink[]>([]);
  const [oidcLink,setOidcLink]=useState({username:"",subjectId:""});
  const [samlLinks,setSamlLinks]=useState<FederatedIdentityLink[]>([]);
  const [samlLink,setSamlLink]=useState({username:"",nameId:""});
  const [directoryLinks,setDirectoryLinks]=useState<DirectoryIdentityLink[]>([]);
  const [directoryLink,setDirectoryLink]=useState({provider:"ad",localUsername:"",directoryUsername:""});
  const [testingDirectory,setTestingDirectory]=useState("");
  const [synchronizingDirectory,setSynchronizingDirectory]=useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [userRefreshToken, setUserRefreshToken] = useState(0);
  const [providerEditor,setProviderEditor]=useState<IdentityProvider|null>(null);

  async function reloadConfiguration(){setData(await loadIdentityConfiguration());}

  useEffect(() => {
    loadIdentityConfiguration()
      .then(setData)
      .catch(problem => setError(errorMessage(problem,t("identityConfigurationLoadFailed"))));
    loadOidcLinks().then(setOidcLinks).catch(()=>setOidcLinks([]));
    loadSamlLinks().then(setSamlLinks).catch(()=>setSamlLinks([]));
    loadDirectoryLinks().then(setDirectoryLinks).catch(()=>setDirectoryLinks([]));
  }, []);
  useEffect(()=>{if(!data)return;const enabled=data.providers.filter(provider=>(provider.key==="ad"||provider.key==="ldap")&&provider.operational);if(enabled.length>0&&!enabled.some(provider=>provider.key===directoryLink.provider))setDirectoryLink(current=>({...current,provider:enabled[0].key}));},[data,directoryLink.provider]);
  async function addOidcLink(event:React.FormEvent){event.preventDefault();setError("");try{await addOidcIdentity(oidcLink);setOidcLink({username:"",subjectId:""});setOidcLinks(await loadOidcLinks());setUserRefreshToken(current=>current+1);}catch(problem){setError(problem instanceof Error?problem.message:t("oidcLinkSaveFailed"));}}
  async function addSamlLink(event:React.FormEvent){event.preventDefault();setError("");try{await addSamlIdentity(samlLink);setSamlLink({username:"",nameId:""});setSamlLinks(await loadSamlLinks());setUserRefreshToken(current=>current+1);}catch(problem){setError(problem instanceof Error?problem.message:t("samlLinkSaveFailed"));}}
  async function addDirectoryLink(event:React.FormEvent){event.preventDefault();setError("");setNotice("");try{await addDirectoryIdentity(directoryLink);setDirectoryLink({...directoryLink,localUsername:"",directoryUsername:""});setDirectoryLinks(await loadDirectoryLinks());setNotice(t("directoryIdentityLinked"));setUserRefreshToken(current=>current+1);}catch(problem){setError(problem instanceof Error?problem.message:t("directoryLinkSaveFailed"));}}
  async function removeDirectoryLink(id:string){setError("");try{await removeDirectoryIdentity(id);setDirectoryLinks(directoryLinks.filter(link=>link.id!==id));setUserRefreshToken(current=>current+1);}catch(problem){setError(problem instanceof Error?problem.message:t("directoryLinkRemoveFailed"));}}
  async function removeOidcLink(id:string){setError("");try{await removeOidcIdentity(id);setOidcLinks(oidcLinks.filter(link=>link.id!==id));setUserRefreshToken(current=>current+1);}catch(problem){setError(problem instanceof Error?problem.message:t("oidcLinkRemoveFailed"));}}
  async function removeSamlLink(id:string){setError("");try{await removeSamlIdentity(id);setSamlLinks(samlLinks.filter(link=>link.id!==id));setUserRefreshToken(current=>current+1);}catch(problem){setError(problem instanceof Error?problem.message:t("samlLinkRemoveFailed"));}}
  async function testDirectory(provider:string){setTestingDirectory(provider);setError("");setNotice("");const providerName=provider==="ad"?"Active Directory":"LDAP";try{await testDirectoryConnection(provider);setNotice(t("directoryConnectionOk",{provider:providerName}));}catch(problem){setError(problem instanceof Error?problem.message:t("directoryConnectionFailed",{provider:providerName}));}finally{setTestingDirectory("");}}
  async function synchronizeDirectories(){setSynchronizingDirectory(true);setError("");setNotice("");try{const summary=await synchronizeDirectoryLifecycle();setDirectoryLinks(await loadDirectoryLinks());setNotice(t("directorySyncSummary",summary));setUserRefreshToken(current=>current+1);}catch(problem){setError(problem instanceof Error?problem.message:t("directorySyncFailed"));}finally{setSynchronizingDirectory(false);}}
  const lifecycleLabel=(status:string)=>({active:t("directoryActive"),disabled:t("directoryDisabled"),expired:t("directoryExpired"),"inactive-filter":t("directoryInactiveFilter"),missing:t("directoryMissing"),"missing-pending":t("directoryMissingPending"),unavailable:t("directoryUnavailable"),pending:t("directoryPending")}[status]??status);
  const formatTimestamp=(value:string|null)=>value?new Intl.DateTimeFormat(displayLanguage,{dateStyle:"short",timeStyle:"short",timeZone:displayTimeZone}).format(new Date(value)):t("notChecked");

  return (
    <div className="page platform-admin-page">
      <header className="page-header">
        <div>
          <h1>{t("identity")}</h1>
          <p className="muted">{t("identityIntro")}</p>
        </div>
      </header>
      {error && <p className="status-message error-message">{error}</p>}
      {notice && <p className="status-message">{notice}</p>}
      <GlobalUserAdministration language={displayLanguage} timeZone={displayTimeZone} refreshToken={userRefreshToken} setError={setError} setNotice={setNotice} />
      {!data ? (
        <section className="panel">{t("loading")}</section>
      ) : (
        <>
          <section className="identity-provider-grid">
            <article className="panel identity-provider-card">
              <div>
                <h2>{t("localAccount")}</h2>
                <span
                  className={data.local.enabled ? "status-active" : "muted"}
                >
                  {data.local.enabled ? t("active") : t("inactive")}
                </span>
              </div>
              <p>{t("localSignInIntro")}</p>
              <strong>
                {data.local.operational ? t("operational") : t("notOperational")}
              </strong>
              <button className="secondary-button" type="button" onClick={()=>setProviderEditor({name:t("localAccount"),key:"local",enabledRequested:data.local.enabled,configurationPresent:true,operational:data.local.operational,stableIdentifier:"internal person ID",lastTestedAt:null,lastTestSucceeded:null})}>{t("configure")}</button>
            </article>
            {data.providers.map((provider) => (
              <article
                className="panel identity-provider-card"
                key={provider.key}
              >
                <div>
                  <h2>{provider.name}</h2>
                  <span className={provider.operational ? "status-active" : "muted"}>{provider.operational ? t("operational") : t("notActive")}</span>
                </div>
                <p>
                  {t("stableIdentifier")}: <code>{provider.stableIdentifier}</code>
                </p>
                <dl>
                  <div>
                    <dt>{t("configurationProvided")}</dt>
                    <dd>{provider.configurationPresent ? t("yes") : t("no")}</dd>
                  </div>
                  <div>
                    <dt>{t("activationRequested")}</dt>
                    <dd>{provider.enabledRequested ? t("yes") : t("no")}</dd>
                  </div>
                </dl>
                <button className="secondary-button" type="button" disabled={!canManageExternalIdentity} onClick={()=>setProviderEditor(provider)}>{t("configure")}</button>
              </article>
            ))}
          </section>
          <section className="panel identity-migration">
            <h2>{t("existingUserLinks")}</h2>
            <p>{t("identityMigrationPrinciple")}</p>
            <p className="muted">{t("identityUsernameMatching")}</p>
            <p className="status-message">{t("externalIdentityLinkNotice")}</p>
            {!canManageExternalIdentity&&<EnterpriseRequiredNotice>{t("externalIdentityEnterpriseNotice")}</EnterpriseRequiredNotice>}
            {data.providers.some(provider=>provider.key==="ad"&&provider.operational)||data.providers.some(provider=>provider.key==="ldap"&&provider.operational) ? <>
              <form className="stacked-form" onSubmit={addDirectoryLink}><h3>{t("linkDirectoryIdentity")}</h3><div className="field"><label>{t("provider")}</label><select disabled={!canManageExternalIdentity} value={directoryLink.provider} onChange={event=>setDirectoryLink({...directoryLink,provider:event.target.value})}>{data.providers.filter(provider=>(provider.key==="ad"||provider.key==="ldap")&&provider.operational).map(provider=><option key={provider.key} value={provider.key}>{provider.name}</option>)}</select></div><div className="field"><label>{t("existingLocalUsername")}</label><input required disabled={!canManageExternalIdentity} value={directoryLink.localUsername} onChange={event=>setDirectoryLink({...directoryLink,localUsername:event.target.value})}/></div><div className="field"><label>{t("directoryUsername")}</label><input required maxLength={256} disabled={!canManageExternalIdentity} value={directoryLink.directoryUsername} onChange={event=>setDirectoryLink({...directoryLink,directoryUsername:event.target.value})}/></div><button className="primary-button" disabled={!canManageExternalIdentity}>{t("linkDirectoryIdentity")}</button></form>
              <div className="type-list">{directoryLinks.map(link=><div className="type-row" key={link.id}><span><strong>{link.displayName}</strong><small className="muted">{link.provider.toUpperCase()} · {link.directoryUsername} · {link.subjectId}</small><small className={!link.accessEnabled?"error-message":link.lifecycleStatus==="active"?"status-active":"muted"}>{lifecycleLabel(link.lifecycleStatus)} · {t("lastChecked",{date:formatTimestamp(link.lastCheckedAt)})}</small></span><button className="link-button danger" type="button" onClick={() => removeDirectoryLink(link.id)}>{t("removeLink")}</button></div>)}</div>
              <div className="status-message"><strong>{t("directoryLifecycle")}</strong><br/>{t("directoryLifecycleIntro")}</div>
              <div className="inline-actions"><button className="primary-button" type="button" disabled={synchronizingDirectory} onClick={synchronizeDirectories}>{synchronizingDirectory?t("synchronizing"):t("synchronizeNow")}</button>{data.providers.filter(provider=>(provider.key==="ad"||provider.key==="ldap")&&provider.operational).map(provider=><button className="secondary-button" type="button" disabled={Boolean(testingDirectory)||!canManageExternalIdentity} key={provider.key} onClick={()=>testDirectory(provider.key)}>{testingDirectory===provider.key?t("testing"):t("testProvider",{provider:provider.name})}</button>)}</div>
            </> : null}
            <form className="stacked-form" onSubmit={addOidcLink}><h3>{t("linkOidcIdentity")}</h3><div className="field"><label>{t("existingLocalUsername")}</label><input required disabled={!canManageExternalIdentity} value={oidcLink.username} onChange={event=>setOidcLink({...oidcLink,username:event.target.value})}/></div><div className="field"><label>{t("oidcSubject")}</label><input required maxLength={256} disabled={!canManageExternalIdentity} value={oidcLink.subjectId} onChange={event=>setOidcLink({...oidcLink,subjectId:event.target.value})}/></div><button className="primary-button" disabled={!canManageExternalIdentity}>{t("linkIdentity")}</button></form>
            <div className="type-list">{oidcLinks.map(link=><div className="type-row" key={link.id}><span><strong>{link.displayName}</strong><small className="muted">{link.username} · sub: {link.subjectId}</small><small className="muted">{t("issuer")}: {link.providerInstanceId}</small></span><button className="link-button danger" type="button" onClick={()=>removeOidcLink(link.id)}>{t("removeLink")}</button></div>)}</div>
            <form className="stacked-form" onSubmit={addSamlLink}><h3>{t("linkSamlIdentity")}</h3><div className="field"><label>{t("existingLocalUsername")}</label><input required disabled={!canManageExternalIdentity} value={samlLink.username} onChange={event=>setSamlLink({...samlLink,username:event.target.value})}/></div><div className="field"><label>{t("permanentNameId")}</label><input required maxLength={256} disabled={!canManageExternalIdentity} value={samlLink.nameId} onChange={event=>setSamlLink({...samlLink,nameId:event.target.value})}/></div><p className="muted">{t("nameIdHelp")}</p><button className="primary-button" disabled={!canManageExternalIdentity}>{t("linkIdentity")}</button></form>
            <div className="type-list">{samlLinks.map(link=><div className="type-row" key={link.id}><span><strong>{link.displayName}</strong><small className="muted">{link.username} · NameID: {link.subjectId}</small><small className="muted">{t("idpEntity")}: {link.providerInstanceId}</small></span><button className="link-button danger" type="button" onClick={()=>removeSamlLink(link.id)}>{t("removeLink")}</button></div>)}</div>
          </section>
        </>
      )}

      {providerEditor&&<IdentityProviderSettingsDialog provider={providerEditor} onClose={()=>setProviderEditor(null)} onSaved={reloadConfiguration}/>}

    </div>
  );
}
