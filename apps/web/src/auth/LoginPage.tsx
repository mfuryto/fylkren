import { useState } from "react";
import type React from "react";
import type { Branding, LoginConfiguration } from "../app/models";
import { bootstrapPlatformManager, completePasswordReset, signIn, signInWithPasskey } from "../api/authClient";
import type { Session } from "../work/WorkContextModels";

export function LoginPage({
  onSignedIn,
  branding,
  configuration,
}: {
  onSignedIn: (session: Session) => void;
  branding: Branding;
  configuration: LoginConfiguration;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [setup, setSetup] = useState({ displayName: "", email: "", username: "", password: "", confirmPassword: "" });
  const [setupError, setSetupError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [reset, setReset] = useState({ code: "", password: "", confirmPassword: "" });
  const [resetMessage, setResetMessage] = useState("");
  const [credentialProvider, setCredentialProvider] = useState(
    configuration.authentication.localEnabled
      ? "local"
      : configuration.authentication.activeDirectoryConfigurationEnabled
        ? "ad"
        : "ldap",
  );
  const credentialProviders = [
    ...(configuration.authentication.localEnabled ? [{ value: "local", label: "Lokal konto" }] : []),
    ...(configuration.authentication.activeDirectoryConfigurationEnabled ? [{ value: "ad", label: "Active Directory" }] : []),
    ...(configuration.authentication.ldapConfigurationEnabled ? [{ value: "ldap", label: "LDAP" }] : []),
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(false);
    try {
      const result = await signIn(credentialProvider, username, password, challengeToken, twoFactorCode);
      if (result.challengeToken) {
        setChallengeToken(result.challengeToken);
        setSubmitting(false);
        return;
      }
      if (result.session) onSignedIn(result.session);
    } catch {
      setError(true);
    }
    setSubmitting(false);
  }
  async function passkeyLogin() {
    setSubmitting(true);
    setError(false);
    try {
      onSignedIn(await signInWithPasskey(username));
    } catch {
      setError(true);
    }
    setSubmitting(false);
  }

  async function completeSetup(event: React.FormEvent) {
    event.preventDefault();
    if (setup.password !== setup.confirmPassword) { setSetupError("Passordene er ikke like."); return; }
    setSubmitting(true); setSetupError("");
    try {
      onSignedIn(await bootstrapPlatformManager({ displayName: setup.displayName, email: setup.email, username: setup.username, password: setup.password }));
    } catch (problem) {
      setSetupError(problem instanceof Error ? problem.message : "Førstegangsoppsettet kunne ikke fullføres.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPasswordReset(event: React.FormEvent) {
    event.preventDefault();
    if (reset.password !== reset.confirmPassword) { setResetMessage("Passordene er ikke like."); return; }
    setSubmitting(true); setResetMessage("");
    try {
      await completePasswordReset(reset.code, reset.password);
      setReset({ code: "", password: "", confirmPassword: "" });
      setResetOpen(false);
      setResetMessage("Passordet er lagret. Du kan nå logge inn.");
    } catch (problem) {
      setResetMessage(problem instanceof Error ? problem.message : "Passordet kunne ikke lagres.");
    } finally {
      setSubmitting(false);
    }
  }

  if (configuration.setupRequired) return (
    <div className="product-shell">
      <header className="title-bar">
        <span className={branding.hasLogo ? "product-mark custom-logo" : "product-mark"} aria-hidden="true">{branding.hasLogo ? <img alt="" src="/api/branding/logo" /> : branding.productName.slice(0, 1)}</span>
        <strong>{branding.productName}</strong>
      </header>
      <main className="login-page">
        <section className="panel login-panel">
          <h1>Førstegangsoppsett</h1>
          <p className="muted">Opprett installasjonens første Platform Manager. Veiviseren lukkes permanent når kontoen er opprettet.</p>
          <form className="login-form" onSubmit={completeSetup}>
            <div className="field"><label htmlFor="setup-display-name">Navn</label><input id="setup-display-name" required minLength={2} maxLength={200} autoComplete="name" value={setup.displayName} onChange={(event) => setSetup({ ...setup, displayName: event.target.value })} /></div>
            <div className="field"><label htmlFor="setup-email">E-postadresse</label><input id="setup-email" required type="email" maxLength={320} autoComplete="email" value={setup.email} onChange={(event) => setSetup({ ...setup, email: event.target.value })} /></div>
            <div className="field"><label htmlFor="setup-username">Brukernavn</label><input id="setup-username" required minLength={3} maxLength={100} autoComplete="username" value={setup.username} onChange={(event) => setSetup({ ...setup, username: event.target.value })} /></div>
            <div className="field"><label htmlFor="setup-password">Passord</label><input id="setup-password" required type="password" minLength={14} maxLength={128} autoComplete="new-password" value={setup.password} onChange={(event) => setSetup({ ...setup, password: event.target.value })} /></div>
            <div className="field"><label htmlFor="setup-confirm-password">Gjenta passord</label><input id="setup-confirm-password" required type="password" minLength={14} maxLength={128} autoComplete="new-password" value={setup.confirmPassword} onChange={(event) => setSetup({ ...setup, confirmPassword: event.target.value })} /></div>
            {setupError && <p className="error-message" role="alert">{setupError}</p>}
            <button className="primary-button" disabled={submitting}>{submitting ? "Oppretter …" : "Opprett Platform Manager"}</button>
          </form>
        </section>
      </main>
    </div>
  );

  return (
    <div className="product-shell">
      <header className="title-bar">
        <span
          className={
            branding.hasLogo ? "product-mark custom-logo" : "product-mark"
          }
          aria-hidden="true"
        >
          {branding.hasLogo ? (
            <img alt="" src="/api/branding/logo" />
          ) : (
            branding.productName.slice(0, 1)
          )}
        </span>
        <strong>{branding.productName}</strong>
      </header>
      <main className="login-page">
        <section className="panel login-panel">
          <h1>Logg inn</h1>
          <p className="muted">Velg en tilgjengelig innloggingsmetode.</p>
          {credentialProviders.length > 0 ? (
            <form className="login-form" onSubmit={submit}>
              {!challengeToken ? (
                <>
                  {credentialProviders.length > 1 && (
                    <div className="field">
                      <label htmlFor="credential-provider">Innloggingskilde</label>
                      <select
                        id="credential-provider"
                        value={credentialProvider}
                        onChange={(event) => setCredentialProvider(event.target.value)}
                      >
                        {credentialProviders.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}
                      </select>
                    </div>
                  )}
                  {credentialProviders.length === 1 && credentialProvider !== "local" && <p className="muted">Innlogging med {credentialProviders[0].label}</p>}
                  <div className="field">
                    <label htmlFor="username">{credentialProvider === "local" ? "Brukernavn eller e-postadresse" : "Katalogbrukernavn"}</label>
                    <input
                      id="username"
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="password">Passord</label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <p>
                    Skriv inn sekssifret kode fra autentiseringsappen, eller en
                    ubrukt gjenopprettingskode.
                  </p>
                  <div className="field">
                    <label htmlFor="two-factor-code">Sikkerhetskode</label>
                    <input
                      id="two-factor-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      autoFocus
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                    />
                  </div>
                </>
              )}
              {error && (
                <p className="error-message" role="alert">
                  {challengeToken
                    ? "Ugyldig eller utløpt sikkerhetskode."
                    : "Ugyldig brukernavn eller passord."}
                </p>
              )}
              <button
                className="primary-button"
                disabled={submitting}
                type="submit"
              >
                {submitting
                  ? "Logger inn …"
                  : challengeToken
                    ? "Bekreft og logg inn"
                    : "Logg inn"}
              </button>
              {!challengeToken && credentialProvider === "local" &&
                configuration.authentication.mfaEnabled !== false &&
                configuration.authentication.webAuthnEnabled && (
                  <button
                    className="secondary-button"
                    disabled={submitting || !username.trim()}
                    type="button"
                    onClick={passkeyLogin}
                  >
                    Logg inn med passkey eller sikkerhetsnøkkel
                  </button>
                )}
              {!challengeToken && credentialProvider === "local" && (
                <button className="link-button" type="button" onClick={() => { setResetOpen((value) => !value); setResetMessage(""); }}>
                  Bruk engangskode for passordbytte
                </button>
              )}
              {challengeToken && (
                <button
                  className="link-button"
                  type="button"
                  onClick={() => {
                    setChallengeToken("");
                    setTwoFactorCode("");
                    setError(false);
                  }}
                >
                  Tilbake
                </button>
              )}
            </form>
          ) : (
            <p className="status-message">
              Passordbasert innlogging er deaktivert for denne installasjonen.
              Bruk en av organisasjonens innloggingsmetoder nedenfor.
            </p>
          )}
          {resetOpen && configuration.authentication.localEnabled && (
            <form className="login-form" onSubmit={submitPasswordReset}>
              <h2>Velg nytt passord</h2>
              <p className="muted">Engangskoden utstedes av administrator, vises bare én gang og er gyldig i 30 minutter.</p>
              <div className="field"><label htmlFor="password-reset-code">Engangskode</label><input id="password-reset-code" required autoComplete="one-time-code" value={reset.code} onChange={(event) => setReset({ ...reset, code: event.target.value })} /></div>
              <div className="field"><label htmlFor="password-reset-new">Nytt passord</label><input id="password-reset-new" type="password" required minLength={14} maxLength={128} autoComplete="new-password" value={reset.password} onChange={(event) => setReset({ ...reset, password: event.target.value })} /></div>
              <div className="field"><label htmlFor="password-reset-confirm">Gjenta passord</label><input id="password-reset-confirm" type="password" required minLength={14} maxLength={128} autoComplete="new-password" value={reset.confirmPassword} onChange={(event) => setReset({ ...reset, confirmPassword: event.target.value })} /></div>
              <button className="primary-button" disabled={submitting}>{submitting ? "Lagrer …" : "Lagre nytt passord"}</button>
            </form>
          )}
          {resetMessage && <p className={resetOpen ? "error-message" : "status-message"} role="status">{resetMessage}</p>}
          {configuration.authentication.oidcConfigurationEnabled && <a className="primary-button external-login" href="/api/auth/oidc/login">Logg inn med organisasjonskonto (OIDC)</a>}
          {configuration.authentication.samlConfigurationEnabled && <a className="primary-button external-login" href="/api/auth/saml/login">Logg inn med organisasjonskonto (SAML)</a>}
        </section>
      </main>
    </div>
  );
}
