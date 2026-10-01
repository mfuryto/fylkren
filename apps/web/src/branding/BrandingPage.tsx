import { useMemo, useState } from "react";
import type React from "react";
import type { Branding, RegionalSettings } from "../app/models";
import { translate } from "../localization";
import { deleteBrandingLogo, saveBranding, saveRegionalSettings, uploadBrandingLogo } from "./brandingApi";

export function BrandingPage({ branding, regionalSettings, onChanged, onRegionalChanged }: {
  branding: Branding;
  regionalSettings: RegionalSettings;
  onChanged: (value: Branding) => void;
  onRegionalChanged: (value: RegionalSettings) => void;
}) {
  const [form, setForm] = useState(branding);
  const [regionalForm, setRegionalForm] = useState(regionalSettings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const t = (key: Parameters<typeof translate>[1]) => translate(regionalSettings.defaultLanguage, key);
  const timeZones = useMemo(() => {
    const values = (Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] }).supportedValuesOf?.("timeZone") ?? [];
    return Array.from(new Set(["UTC", regionalForm.timeZone, ...values])).sort();
  }, [regionalForm.timeZone]);

  async function persist() {
    setBusy(true);
    try {
      await saveBranding(form);
      onChanged(form);
      setMessage(t("appearanceSaved"));
      setError("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("appearanceSaveFailed"));
    }
    setBusy(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    await persist();
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const logo = event.target.files?.[0];
    if (!logo) return;
    setBusy(true);
    try {
      await uploadBrandingLogo(logo);
      onChanged({ ...form, hasLogo: true });
      setForm((current) => ({ ...current, hasLogo: true }));
      setMessage(t("logoSaved"));
      setError("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("logoSaveFailed"));
    }
    setBusy(false);
    event.target.value = "";
  }

  async function removeLogo() {
    setBusy(true);
    try {
      await deleteBrandingLogo();
      const next = { ...form, hasLogo: false };
      setForm(next);
      onChanged(next);
      setMessage(t("logoRemoved"));
      setError("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("logoRemoveFailed"));
    }
    setBusy(false);
  }

  async function saveRegional(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await saveRegionalSettings(regionalForm);
      setRegionalForm(saved);
      onRegionalChanged(saved);
      setMessage(translate(saved.defaultLanguage, "regionalSaved"));
      setError("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("regionalSaveFailed"));
    }
    setBusy(false);
  }

  return (
    <div className="page platform-admin-page">
      <header className="page-header"><div><h1>{t("appearanceTitle")}</h1><p className="muted">{t("appearanceIntro")}</p></div></header>
      {error && <p className="status-message error-message">{error}</p>}
      {message && <p className="status-message status-active">{message}</p>}
      <div className="appearance-settings">
        <form className="panel appearance-section" onSubmit={saveRegional}>
          <div className="section-heading appearance-section-heading"><div><h2>{t("regionalTitle")}</h2><p className="muted">{t("regionalIntro")}</p></div></div>
          <div className="appearance-field-grid">
            <div className="field"><label htmlFor="regional-language">{t("language")}</label><select id="regional-language" value={regionalForm.defaultLanguage} onChange={(event) => setRegionalForm({ ...regionalForm, defaultLanguage: event.target.value as RegionalSettings["defaultLanguage"] })}><option value="en-GB">{t("languageEnglishUK")}</option><option value="en-US">{t("languageEnglishUS")}</option><option value="nb-NO">{t("languageNorwegian")}</option></select></div>
            <div className="field"><label htmlFor="regional-time-zone">{t("timeZone")}</label><select id="regional-time-zone" value={regionalForm.timeZone} onChange={(event) => setRegionalForm({ ...regionalForm, timeZone: event.target.value })}>{timeZones.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div className="field"><label htmlFor="regional-clock-format">{t("clockFormat")}</label><select id="regional-clock-format" value={regionalForm.clockFormat} onChange={(event) => setRegionalForm({ ...regionalForm, clockFormat: event.target.value as RegionalSettings["clockFormat"] })}><option value="12-hour">{t("clock12")}</option><option value="24-hour">{t("clock24")}</option></select></div>
            <div className="field"><label htmlFor="regional-measurement-system">{t("measurementSystem")}</label><select id="regional-measurement-system" value={regionalForm.measurementSystem} onChange={(event) => setRegionalForm({ ...regionalForm, measurementSystem: event.target.value as RegionalSettings["measurementSystem"] })}><option value="metric">{t("metric")}</option><option value="imperial">{t("imperial")}</option></select></div>
          </div>
          <p className="status-message appearance-note">{t("regionalStorageNote")}</p>
          <div className="appearance-actions"><button className="primary-button" disabled={busy}>{t("saveRegional")}</button></div>
        </form>

        <form className="panel appearance-section" onSubmit={save}>
          <div className="section-heading appearance-section-heading"><div><h2>{t("visualIdentity")}</h2><p className="muted">{t("visualIdentityIntro")}</p></div></div>
          <div className="appearance-field-grid">
            <div className="field"><label htmlFor="brand-name">{t("productName")}</label><input id="brand-name" required minLength={2} maxLength={80} value={form.productName} onChange={(event) => setForm({ ...form, productName: event.target.value })} /></div>
            <div className="field"><label htmlFor="instance-name">{t("instanceName")}</label><input id="instance-name" required minLength={2} maxLength={80} value={form.instanceName} onChange={(event) => setForm({ ...form, instanceName: event.target.value })} /></div>
            <div className="field"><label htmlFor="brand-theme">{t("theme")}</label><select id="brand-theme" value={form.theme} onChange={(event) => setForm({ ...form, theme: event.target.value as Branding["theme"] })}><option value="light">{t("themeLight")}</option><option value="dark">{t("themeDark")}</option><option value="system">{t("themeSystem")}</option></select></div>
          </div>
          <p className="status-message appearance-note"><strong>{t("note")}</strong> {t("authenticatorNameNote")}</p>
          <div className="appearance-subsection"><h3>{t("colors")}</h3><div className="color-fields" aria-label={t("colors")}>
            <div className="field"><label htmlFor="brand-primary">{t("primaryColor")}</label><input id="brand-primary" type="color" value={form.primaryColor} onChange={(event) => setForm({ ...form, primaryColor: event.target.value })} /></div>
            <div className="field"><label htmlFor="brand-accent">{t("accentColor")}</label><input id="brand-accent" type="color" value={form.accentColor} onChange={(event) => setForm({ ...form, accentColor: event.target.value })} /></div>
            <div className="field"><label htmlFor="brand-topbar">{t("topBarColor")}</label><input id="brand-topbar" type="color" value={form.topBarColor} onChange={(event) => setForm({ ...form, topBarColor: event.target.value })} /></div>
            <div className="field"><label htmlFor="brand-topbar-text">{t("topBarTextColor")}</label><input id="brand-topbar-text" type="color" value={form.topBarTextColor} onChange={(event) => setForm({ ...form, topBarTextColor: event.target.value })} /></div>
          </div></div>
          <div className="appearance-actions"><button className="primary-button" disabled={busy}>{t("saveAppearance")}</button></div>
        </form>

        <section className="panel appearance-section">
          <div className="section-heading appearance-section-heading"><div><h2>{t("logo")}</h2><p className="muted">{t("logoIntro")}</p></div></div>
          <div className="appearance-logo-layout">
            <div className="brand-preview" style={{ background: form.topBarColor, color: form.topBarTextColor, "--brand": form.primaryColor } as React.CSSProperties}>
              <span className={form.hasLogo ? "product-mark custom-logo" : "product-mark"}>{form.hasLogo ? <img alt={t("currentLogo")} src={`/api/branding/logo?v=${Date.now()}`} /> : form.productName.slice(0, 1)}</span><strong>{form.productName}</strong>
            </div>
            <div className="appearance-logo-controls"><label className="secondary-button file-button">{t("chooseLogo")}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={upload} /></label>{form.hasLogo && <button className="link-button danger" type="button" disabled={busy} onClick={removeLogo}>{t("removeLogo")}</button>}<p className="muted modal-note">{t("logoHelp")}</p></div>
          </div>
        </section>

        <section className="panel appearance-section">
          <div className="section-heading appearance-section-heading"><div><h2>{t("customCss")}</h2><p className="muted">{t("customCssHelp")}</p></div></div>
          <div className="field"><label htmlFor="brand-custom-css">CSS</label><textarea id="brand-custom-css" className="custom-css-editor" rows={12} maxLength={20_000} spellCheck={false} placeholder={".panel {\n  border-radius: 8px;\n}"} value={form.customCss} onChange={(event) => setForm({ ...form, customCss: event.target.value })} /></div>
          <p className="muted modal-note">{t("customCssLimit")}</p>
          <div className="appearance-actions"><button className="primary-button" type="button" disabled={busy} onClick={() => void persist()}>{t("saveCss")}</button></div>
        </section>
      </div>
    </div>
  );
}
