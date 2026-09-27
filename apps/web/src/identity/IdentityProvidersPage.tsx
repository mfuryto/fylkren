import { useEffect, useState } from "react";
import type React from "react";
import type { DirectoryIdentityLink, FederatedIdentityLink, IdentityConfiguration } from "./models";
import { addDirectoryIdentity, addOidcIdentity, addSamlIdentity, loadDirectoryLinks, loadIdentityConfiguration, loadOidcLinks, loadSamlLinks, removeDirectoryIdentity, testDirectoryConnection } from "./identityApi";
import { GlobalUserAdministration } from "./GlobalUserAdministration";
import { errorMessage } from "../api/errors";
import { EnterpriseRequiredNotice } from "../components/EnterpriseRequiredNotice";

export function IdentityProvidersPage({ language: displayLanguage, timeZone: displayTimeZone, canManageExternalIdentity }: { language: string; timeZone: string; canManageExternalIdentity: boolean }) {
  const [data, setData] = useState<IdentityConfiguration | null>(null);
  const [oidcLinks,setOidcLinks]=useState<FederatedIdentityLink[]>([]);
  const [oidcLink,setOidcLink]=useState({username:"",subjectId:""});
  const [samlLinks,setSamlLinks]=useState<FederatedIdentityLink[]>([]);
  const [samlLink,setSamlLink]=useState({username:"",nameId:""});
  const [directoryLinks,setDirectoryLinks]=useState<DirectoryIdentityLink[]>([]);
  const [directoryLink,setDirectoryLink]=useState({provider:"ad",localUsername:"",directoryUsername:""});
  const [testingDirectory,setTestingDirectory]=useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [userRefreshToken, setUserRefreshToken] = useState(0);

  useEffect(() => {
    loadIdentityConfiguration()
      .then(setData)
      .catch(problem => setError(errorMessage(problem,"Identitetskonfigurasjonen kunne ikke lastes.")));
    loadOidcLinks().then(setOidcLinks).catch(()=>setOidcLinks([]));
    loadSamlLinks().then(setSamlLinks).catch(()=>setSamlLinks([]));
    loadDirectoryLinks().then(setDirectoryLinks).catch(()=>setDirectoryLinks([]));
  }, []);
  useEffect(()=>{if(!data)return;const enabled=data.providers.filter(provider=>(provider.key==="ad"||provider.key==="ldap")&&provider.operational);if(enabled.length>0&&!enabled.some(provider=>provider.key===directoryLink.provider))setDirectoryLink(current=>({...current,provider:enabled[0].key}));},[data,directoryLink.provider]);
  async function addOidcLink(event:React.FormEvent){event.preventDefault();setError("");try{await addOidcIdentity(oidcLink);setOidcLink({username:"",subjectId:""});setOidcLinks(await loadOidcLinks());setUserRefreshToken(current=>current+1);}catch(problem){setError(problem instanceof Error?problem.message:"OIDC-koblingen kunne ikke lagres.");}}
  async function addSamlLink(event:React.FormEvent){event.preventDefault();setError("");try{await addSamlIdentity(samlLink);setSamlLink({username:"",nameId:""});setSamlLinks(await loadSamlLinks());setUserRefreshToken(current=>current+1);}catch(problem){setError(problem instanceof Error?problem.message:"SAML-koblingen kunne ikke lagres.");}}
  async function addDirectoryLink(event:React.FormEvent){event.preventDefault();setError("");setNotice("");try{await addDirectoryIdentity(directoryLink);setDirectoryLink({...directoryLink,localUsername:"",directoryUsername:""});setDirectoryLinks(await loadDirectoryLinks());setNotice("Katalogidentiteten er koblet.");setUserRefreshToken(current=>current+1);}catch(problem){setError(problem instanceof Error?problem.message:"Katalogkoblingen kunne ikke lagres.");}}
  async function removeDirectoryLink(id:string){setError("");try{await removeDirectoryIdentity(id);setDirectoryLinks(directoryLinks.filter(link=>link.id!==id));setUserRefreshToken(current=>current+1);}catch(problem){setError(problem instanceof Error?problem.message:"Katalogkoblingen kunne ikke fjernes.");}}
  async function testDirectory(provider:string){setTestingDirectory(provider);setError("");setNotice("");try{await testDirectoryConnection(provider);setNotice(`${provider === "ad" ? "Active Directory" : "LDAP"}-forbindelsen er i orden.`);}catch(problem){setError(problem instanceof Error?problem.message:"Katalogforbindelsen kunne ikke testes.");}finally{setTestingDirectory("");}}

  return (
    <div className="page platform-admin-page">
      <header className="page-header">
        <div>
          <h1>Identitet</h1>
          <p className="muted">
            Plattformens innloggingskilder og migreringsgrunnlag.
          </p>
        </div>
      </header>
      {error && <p className="status-message error-message">{error}</p>}
      {notice && <p className="status-message">{notice}</p>}
      <GlobalUserAdministration language={displayLanguage} timeZone={displayTimeZone} refreshToken={userRefreshToken} setError={setError} setNotice={setNotice} />
      {!data ? (
        <section className="panel">Laster …</section>
      ) : (
        <>
          <section className="identity-provider-grid">
            <article className="panel identity-provider-card">
              <div>
                <h2>Lokal konto</h2>
                <span
                  className={data.local.enabled ? "status-active" : "muted"}
                >
                  {data.local.enabled ? "Aktiv" : "Deaktivert"}
                </span>
              </div>
              <p>Lokal brukernavn- og passordinnlogging.</p>
              <strong>
                {data.local.operational ? "Operativ" : "Ikke operativ"}
              </strong>
            </article>
            {data.providers.map((provider) => (
              <article
                className="panel identity-provider-card"
                key={provider.key}
              >
                <div>
                  <h2>{provider.name}</h2>
                  <span className={provider.operational ? "status-active" : "muted"}>{provider.operational ? "Operativ" : "Ikke aktiv"}</span>
                </div>
                <p>
                  Stabil identifikator: <code>{provider.stableIdentifier}</code>
                </p>
                <dl>
                  <div>
                    <dt>Konfigurasjon angitt</dt>
                    <dd>{provider.configurationPresent ? "Ja" : "Nei"}</dd>
                  </div>
                  <div>
                    <dt>Aktivering forespurt</dt>
                    <dd>{provider.enabledRequested ? "Ja" : "Nei"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </section>
          <section className="panel identity-migration">
            <h2>Kobling av eksisterende brukere</h2>
            <p>{data.migration.principle}</p>
            <p className="muted">{data.migration.usernameMatching}</p>
            <p className="status-message">OIDC, SAML, AD og LDAP oppretter ikke personer automatisk. Ekstern identitet kobles kontrollert til en eksisterende intern person.</p>
            {!canManageExternalIdentity&&<EnterpriseRequiredNotice>Enterprise kreves for å opprette nye koblinger til AD, LDAP, OIDC og SAML. Eksisterende koblinger er fortsatt synlige, og tilknyttede brukere kan fortsatt logge inn.</EnterpriseRequiredNotice>}
            {data.providers.some(provider=>provider.key==="ad"&&provider.operational)||data.providers.some(provider=>provider.key==="ldap"&&provider.operational) ? <>
              <form className="stacked-form" onSubmit={addDirectoryLink}><h3>Koble katalogidentitet</h3><div className="field"><label>Leverandør</label><select disabled={!canManageExternalIdentity} value={directoryLink.provider} onChange={event=>setDirectoryLink({...directoryLink,provider:event.target.value})}>{data.providers.filter(provider=>(provider.key==="ad"||provider.key==="ldap")&&provider.operational).map(provider=><option key={provider.key} value={provider.key}>{provider.name}</option>)}</select></div><div className="field"><label>Eksisterende lokalt brukernavn</label><input required disabled={!canManageExternalIdentity} value={directoryLink.localUsername} onChange={event=>setDirectoryLink({...directoryLink,localUsername:event.target.value})}/></div><div className="field"><label>Brukernavn i katalogen</label><input required maxLength={256} disabled={!canManageExternalIdentity} value={directoryLink.directoryUsername} onChange={event=>setDirectoryLink({...directoryLink,directoryUsername:event.target.value})}/></div><button className="primary-button" disabled={!canManageExternalIdentity}>Koble katalogidentitet</button></form>
              <div className="type-list">{directoryLinks.map(link=><div className="type-row" key={link.id}><span><strong>{link.displayName}</strong><small className="muted">{link.provider.toUpperCase()} · {link.directoryUsername} · {link.subjectId}</small></span><button className="link-button danger" type="button" onClick={()=>removeDirectoryLink(link.id)}>Fjern kobling</button></div>)}</div>
              <div className="inline-actions">{data.providers.filter(provider=>(provider.key==="ad"||provider.key==="ldap")&&provider.operational).map(provider=><button className="secondary-button" type="button" disabled={Boolean(testingDirectory)||!canManageExternalIdentity} key={provider.key} onClick={()=>testDirectory(provider.key)}>{testingDirectory===provider.key?"Tester …":`Test ${provider.name}`}</button>)}</div>
            </> : null}
            <form className="stacked-form" onSubmit={addOidcLink}><h3>Koble OIDC-identitet</h3><div className="field"><label>Eksisterende lokalt brukernavn</label><input required disabled={!canManageExternalIdentity} value={oidcLink.username} onChange={event=>setOidcLink({...oidcLink,username:event.target.value})}/></div><div className="field"><label>OIDC subject (sub)</label><input required maxLength={256} disabled={!canManageExternalIdentity} value={oidcLink.subjectId} onChange={event=>setOidcLink({...oidcLink,subjectId:event.target.value})}/></div><button className="primary-button" disabled={!canManageExternalIdentity}>Koble identitet</button></form>
            <div className="type-list">{oidcLinks.map(link=><div className="type-row" key={link.id}><span><strong>{link.displayName}</strong><small className="muted">{link.username} · sub: {link.subjectId}</small></span></div>)}</div>
            <form className="stacked-form" onSubmit={addSamlLink}><h3>Koble SAML-identitet</h3><div className="field"><label>Eksisterende lokalt brukernavn</label><input required disabled={!canManageExternalIdentity} value={samlLink.username} onChange={event=>setSamlLink({...samlLink,username:event.target.value})}/></div><div className="field"><label>Permanent NameID</label><input required maxLength={256} disabled={!canManageExternalIdentity} value={samlLink.nameId} onChange={event=>setSamlLink({...samlLink,nameId:event.target.value})}/></div><p className="muted">Bruk den eksakte permanente NameID-verdien som identitetsleverandøren sender. E-post eller visningsnavn brukes ikke som koblingsnøkkel.</p><button className="primary-button" disabled={!canManageExternalIdentity}>Koble SAML-identitet</button></form>
            <div className="type-list">{samlLinks.map(link=><div className="type-row" key={link.id}><span><strong>{link.displayName}</strong><small className="muted">{link.username} · NameID: {link.subjectId}</small></span></div>)}</div>
          </section>
        </>
      )}

    </div>
  );
}
