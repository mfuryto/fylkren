import { useState } from "react";
import type React from "react";
import type { Branding } from "../app/models";
import { deleteBrandingLogo, saveBranding, uploadBrandingLogo } from "./brandingApi";

export function BrandingPage({
  branding,
  onChanged,
}: {
  branding: Branding;
  onChanged: (value: Branding) => void;
}) {
  const [form, setForm] = useState(branding);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function persist() {
    setBusy(true);
    try {
      await saveBranding(form);
      onChanged(form);
      setMessage("Utseendet er lagret.");
      setError("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Utseendet kunne ikke lagres.");
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
      setMessage("Logoen er lagret.");
      setError("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Logoen kunne ikke lagres. Bruk PNG, JPEG eller WebP på maksimalt 2 MB.");
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
      setMessage("Logoen er fjernet.");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Logoen kunne ikke fjernes.");
    }
    setBusy(false);
  }
  return (
    <div className="page platform-admin-page">
      <header className="page-header">
        <div>
          <h1>Utseende</h1>
          <p className="muted">
            Produktnavn, installasjonsnavn, logo, tema og kontrollerte
            profilfarger.
          </p>
        </div>
      </header>
      {error && <p className="status-message error-message">{error}</p>}
      {message && <p className="status-message status-active">{message}</p>}
      <div className="branding-layout">
        <form className="panel stacked-form" onSubmit={save}>
          <h2>Visuell profil</h2>
          <div className="field">
            <label htmlFor="brand-name">Produktnavn og sidetittel</label>
            <input
              id="brand-name"
              required
              minLength={2}
              maxLength={80}
              value={form.productName}
              onChange={(event) =>
                setForm({ ...form, productName: event.target.value })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="instance-name">Installasjonsnavn</label>
            <input
              id="instance-name"
              required
              minLength={2}
              maxLength={80}
              value={form.instanceName}
              onChange={(event) =>
                setForm({ ...form, instanceName: event.target.value })
              }
            />
          </div>
          <p className="status-message">
            <strong>Merk:</strong> Produkt- og installasjonsnavnet brukes i
            autentiseringsapper. En navneendring vises ved nye 2FA-oppsett;
            eksisterende koder fortsetter å virke.
          </p>
          <div className="field">
            <label htmlFor="brand-theme">Tema</label>
            <select
              id="brand-theme"
              value={form.theme}
              onChange={(event) =>
                setForm({
                  ...form,
                  theme: event.target.value as Branding["theme"],
                })
              }
            >
              <option value="light">Lyst</option>
              <option value="dark">Mørkt</option>
              <option value="system">Følg operativsystemet</option>
            </select>
          </div>
          <div className="color-fields">
            <div className="field">
              <label htmlFor="brand-primary">Hovedfarge</label>
              <input
                id="brand-primary"
                type="color"
                value={form.primaryColor}
                onChange={(event) =>
                  setForm({ ...form, primaryColor: event.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="brand-accent">Aksentfarge</label>
              <input
                id="brand-accent"
                type="color"
                value={form.accentColor}
                onChange={(event) =>
                  setForm({ ...form, accentColor: event.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="brand-topbar">Toppbar</label>
              <input
                id="brand-topbar"
                type="color"
                value={form.topBarColor}
                onChange={(event) =>
                  setForm({ ...form, topBarColor: event.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="brand-topbar-text">Tekst i toppbar</label>
              <input
                id="brand-topbar-text"
                type="color"
                value={form.topBarTextColor}
                onChange={(event) =>
                  setForm({ ...form, topBarTextColor: event.target.value })
                }
              />
            </div>
          </div>
          <button className="primary-button" disabled={busy}>
            Lagre utseende
          </button>
        </form>
        <div className="branding-side">
          <section className="panel stacked-form">
            <h2>Logo</h2>
            <div className="brand-preview" style={{background:form.topBarColor,color:form.topBarTextColor,"--brand":form.primaryColor} as React.CSSProperties}>
            <span
              className={
                form.hasLogo ? "product-mark custom-logo" : "product-mark"
              }
            >
              {form.hasLogo ? (
                <img
                  alt="Gjeldende logo"
                  src={`/api/branding/logo?v=${Date.now()}`}
                />
              ) : (
                form.productName.slice(0, 1)
              )}
            </span>
            <strong>{form.productName}</strong>
            </div>
            <label className="secondary-button file-button">
              Velg logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={upload}
              />
            </label>
            {form.hasLogo && (
              <button
                className="link-button danger"
                type="button"
                disabled={busy}
                onClick={removeLogo}
              >
                Fjern logo
              </button>
            )}
            <p className="muted modal-note">
              PNG, JPEG eller WebP. Maksimalt 2 MB. Logoen vises også før
              innlogging.
            </p>
          </section>
          <section className="panel stacked-form">
            <h2>Egne CSS-overstyringer</h2>
            <p className="muted modal-note">Reglene legges etter Fylkrens standardtema og gjelder på alle sider, også før innlogging.</p>
            <div className="field">
              <label htmlFor="brand-custom-css">CSS</label>
              <textarea
                id="brand-custom-css"
                className="custom-css-editor"
                rows={12}
                maxLength={20_000}
                spellCheck={false}
                placeholder={".panel {\n  border-radius: 8px;\n}"}
                value={form.customCss}
                onChange={(event) => setForm({ ...form, customCss: event.target.value })}
              />
            </div>
            <p className="muted modal-note">Maksimalt 20 000 tegn. Eksterne ressurser via <code>url()</code> og <code>@import</code> er blokkert.</p>
            <button className="primary-button" type="button" disabled={busy} onClick={() => void persist()}>
              Lagre CSS-overstyringer
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
