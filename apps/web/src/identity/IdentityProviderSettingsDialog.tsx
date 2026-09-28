import { useEffect, useState } from "react";
import type React from "react";
import { Modal } from "../components/Modal";
import { errorMessage } from "../api/errors";
import { loadIdentityProviderSettings, saveIdentityProviderSettings, testIdentityProvider } from "./identityApi";
import type { IdentityProvider, IdentityProviderSettings } from "./models";

export function IdentityProviderSettingsDialog({ provider, onClose, onSaved }: { provider: IdentityProvider; onClose: () => void; onSaved: () => Promise<void> }) {
  const [settings,setSettings]=useState<IdentityProviderSettings|null>(null);
  const [secret,setSecret]=useState("");
  const [clearSecret,setClearSecret]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  useEffect(()=>{void loadIdentityProviderSettings(provider.key).then(setSettings).catch(problem=>setMessage(errorMessage(problem,"Oppsettet kunne ikke lastes.")));},[provider.key]);
  if(!settings)return <Modal title={`Konfigurer ${provider.name}`} onClose={onClose}><p className="status-message">{message||"Laster …"}</p></Modal>;
  const config=settings.configuration;
  const setConfig=(values:Partial<typeof config>)=>setSettings({...settings,configuration:{...config,...values}});
  const save=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setMessage("");try{await saveIdentityProviderSettings(provider.key,settings.enabled,{...config,secret:secret||null},clearSecret);setSecret("");setClearSecret(false);setSettings(await loadIdentityProviderSettings(provider.key));await onSaved();setMessage("Oppsettet er lagret og tatt i bruk.");}catch(problem){setMessage(errorMessage(problem,"Oppsettet kunne ikke lagres."));}finally{setBusy(false);}};
  const test=async()=>{setBusy(true);setMessage("");try{await testIdentityProvider(provider.key);setSettings(await loadIdentityProviderSettings(provider.key));await onSaved();setMessage("Tilkoblingstesten var vellykket.");}catch(problem){setSettings(await loadIdentityProviderSettings(provider.key));setMessage(errorMessage(problem,"Tilkoblingstesten mislyktes."));}finally{setBusy(false);}};
  const directory=provider.key==="ad"||provider.key==="ldap";
  return <Modal title={`Konfigurer ${provider.name}`} onClose={onClose}>
    <form className="stacked-form" onSubmit={save}>
      <label className="checkbox-row"><input type="checkbox" checked={settings.enabled} onChange={event=>setSettings({...settings,enabled:event.target.checked})}/><span>Aktiver {provider.name} som innloggingstjeneste</span></label>
      {directory&&<>
        <div className="smtp-settings-grid"><div className="field"><label>Server</label><input required={settings.enabled} maxLength={255} value={config.server??""} onChange={event=>setConfig({server:event.target.value})}/></div><div className="field"><label>Port</label><input type="number" min={1} max={65535} value={config.port} onChange={event=>setConfig({port:Number(event.target.value)})}/></div></div>
        <div className="field"><label>Tilkoblingssikkerhet</label><select value={config.security} onChange={event=>setConfig({security:event.target.value as "ldaps"|"starttls"})}><option value="ldaps">LDAPS</option><option value="starttls">StartTLS</option></select></div>
        <div className="field"><label>Base DN</label><input required={settings.enabled} maxLength={1000} value={config.baseDn??""} onChange={event=>setConfig({baseDn:event.target.value})}/></div>
        <div className="field"><label>Brukersøkebase (valgfri)</label><input maxLength={1000} value={config.userSearchBase??""} onChange={event=>setConfig({userSearchBase:event.target.value})}/></div>
        <div className="field"><label>Lookup bind DN</label><input required={settings.enabled} maxLength={1000} autoComplete="off" value={config.bindDn??""} onChange={event=>setConfig({bindDn:event.target.value})}/></div>
        {provider.key==="ad"&&<div className="field"><label>AD-domene (valgfritt)</label><input maxLength={255} value={config.domain??""} onChange={event=>setConfig({domain:event.target.value})}/></div>}
        <div className="smtp-settings-grid"><div className="field"><label>Brukernavnattributt</label><input required value={config.usernameAttribute} onChange={event=>setConfig({usernameAttribute:event.target.value})}/></div><div className="field"><label>Stabil ID-attributt</label><input required value={config.stableIdAttribute} onChange={event=>setConfig({stableIdAttribute:event.target.value})}/></div></div>
        <div className="smtp-settings-grid"><div className="field"><label>Navneattributt</label><input required value={config.displayNameAttribute} onChange={event=>setConfig({displayNameAttribute:event.target.value})}/></div><div className="field"><label>E-postattributt</label><input required value={config.emailAttribute} onChange={event=>setConfig({emailAttribute:event.target.value})}/></div></div>
        <div className="field"><label>Filter for aktiv konto</label><input required maxLength={512} value={config.lifecycleActiveFilter} onChange={event=>setConfig({lifecycleActiveFilter:event.target.value})}/></div>
      </>}
      {provider.key==="oidc"&&<><div className="field"><label>Authority</label><input required={settings.enabled} type="url" maxLength={1000} value={config.authority??""} onChange={event=>setConfig({authority:event.target.value})}/></div><div className="field"><label>Client ID</label><input required={settings.enabled} maxLength={500} value={config.clientId??""} onChange={event=>setConfig({clientId:event.target.value})}/></div><div className="field"><label>Callback path</label><input required value={config.callbackPath} onChange={event=>setConfig({callbackPath:event.target.value})}/></div></>}
      {provider.key==="saml"&&<><div className="field"><label>Metadata-URL</label><input required={settings.enabled} type="url" maxLength={1000} value={config.metadataUrl??""} onChange={event=>setConfig({metadataUrl:event.target.value})}/></div><div className="field"><label>Fylkren SP Entity ID</label><input required={settings.enabled} maxLength={1000} value={config.entityId??""} onChange={event=>setConfig({entityId:event.target.value})}/></div><div className="field"><label>IdP Entity ID</label><input required={settings.enabled} maxLength={1000} value={config.identityProviderEntityId??""} onChange={event=>setConfig({identityProviderEntityId:event.target.value})}/></div><div className="field"><label>Module path</label><input required value={config.modulePath} onChange={event=>setConfig({modulePath:event.target.value})}/></div></>}
      {provider.key==="local"&&<><div className="field"><label>Vanlig innloggingsside</label><select value={config.ssoAutoRedirectProvider??""} onChange={event=>setConfig({ssoAutoRedirectProvider:event.target.value||null})}><option value="">Vis tilgjengelige innloggingsmetoder</option><option value="oidc">Gå direkte til OIDC</option><option value="saml">Gå direkte til SAML</option></select></div><p className="status-message">Ved direkte SSO kan en lokal Platform Manager fortsatt bruke nødadressen <code>/?local=1</code>. Valgt SSO-tjeneste må være aktiv og ha bestått tilkoblingstest.</p><p className="muted">Behold helst én lokal Platform Manager som nødtilgang dersom identitetstjenesten eller nettverket er utilgjengelig.</p></>}
      {(directory||provider.key==="oidc")&&<><div className="field"><label>{provider.key==="oidc"?"Client secret":"Bind-passord"}</label><input type="password" maxLength={2000} autoComplete="new-password" value={secret} placeholder={settings.hasSecret?"Lagret – la stå tomt for å beholde":"Ikke angitt"} onChange={event=>setSecret(event.target.value)}/></div>{settings.hasSecret&&<label className="checkbox-row"><input type="checkbox" checked={clearSecret} onChange={event=>setClearSecret(event.target.checked)}/><span>Fjern lagret hemmelighet</span></label>}</>}
      {settings.lastTestedAt&&<p className={settings.lastTestSucceeded?"status-message":"status-message error-message"}>Sist testet: {new Date(settings.lastTestedAt).toLocaleString()} – {settings.lastTestSucceeded?"Vellykket":settings.lastTestError||"Mislyktes"}</p>}
      {message&&<p className="status-message">{message}</p>}
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Lukk</button>{provider.key!=="local"&&<button className="secondary-button" type="button" disabled={busy} onClick={()=>void test()}>Test lagret oppsett</button>}<button className="primary-button" disabled={busy}>Lagre og bruk</button></div>
    </form>
  </Modal>;
}
