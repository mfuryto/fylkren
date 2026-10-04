import { useState } from "react";
import type React from "react";
import type { Branding, LoginConfiguration } from "../app/models";
import { bootstrapPlatformManager, completePasswordReset, signIn, signInWithPasskey } from "../api/authClient";
import { useTranslation } from "../localization/LocalizationProvider";
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
  const t = useTranslation();
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
    ...(configuration.authentication.localEnabled ? [{ value: "local", label: t("localAccount") }] : []),
    ...(configuration.authentication.activeDirectoryConfigurationEnabled ? [{ value: "ad", label: "Active Directory" }] : []),
    ...(configuration.authentication.ldapConfigurationEnabled ? [{ value: "ldap", label: "LDAP" }] : []),
  ];
  const breakGlassLogin = new URLSearchParams(window.location.search).get("local") === "1";
  const automaticSso = configuration.authentication.ssoAutoRedirectProvider;

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
    if (setup.password !== setup.confirmPassword) { setSetupError(t("passwordsDoNotMatch")); return; }
    setSubmitting(true); setSetupError("");
    try {
      onSignedIn(await bootstrapPlatformManager({ displayName: setup.displayName, email: setup.email, username: setup.username, password: setup.password }));
    } catch (problem) {
      setSetupError(problem instanceof Error ? problem.message : t("setupFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPasswordReset(event: React.FormEvent) {
    event.preventDefault();
    if (reset.password !== reset.confirmPassword) { setResetMessage(t("passwordsDoNotMatch")); return; }
    setSubmitting(true); setResetMessage("");
    try {
      await completePasswordReset(reset.code, reset.password);
      setReset({ code: "", password: "", confirmPassword: "" });
      setResetOpen(false);
      setResetMessage(t("passwordSaved"));
    } catch (problem) {
      setResetMessage(problem instanceof Error ? problem.message : t("passwordSaveFailed"));
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
          <h1>{t("firstRunSetup")}</h1>
          <p className="muted">{t("firstRunIntro")}</p>
          <form className="login-form" onSubmit={completeSetup}>
            <div className="field"><label htmlFor="setup-display-name">{t("name")}</label><input id="setup-display-name" required minLength={2} maxLength={200} autoComplete="name" value={setup.displayName} onChange={(event) => setSetup({ ...setup, displayName: event.target.value })} /></div>
            <div className="field"><label htmlFor="setup-email">{t("emailAddress")}</label><input id="setup-email" required type="email" maxLength={320} autoComplete="email" value={setup.email} onChange={(event) => setSetup({ ...setup, email: event.target.value })} /></div>
            <div className="field"><label htmlFor="setup-username">{t("username")}</label><input id="setup-username" required minLength={3} maxLength={100} autoComplete="username" value={setup.username} onChange={(event) => setSetup({ ...setup, username: event.target.value })} /></div>
            <div className="field"><label htmlFor="setup-password">{t("password")}</label><input id="setup-password" required type="password" minLength={14} maxLength={128} autoComplete="new-password" value={setup.password} onChange={(event) => setSetup({ ...setup, password: event.target.value })} /></div>
            <div className="field"><label htmlFor="setup-confirm-password">{t("repeatPassword")}</label><input id="setup-confirm-password" required type="password" minLength={14} maxLength={128} autoComplete="new-password" value={setup.confirmPassword} onChange={(event) => setSetup({ ...setup, confirmPassword: event.target.value })} /></div>
            {setupError && <p className="error-message" role="alert">{setupError}</p>}
            <button className="primary-button" disabled={submitting}>{submitting ? t("creating") : t("createPlatformManager")}</button>
          </form>
        </section>
      </main>
    </div>
  );

  if(automaticSso&&!breakGlassLogin)return <div className="product-shell"><main className="login-page"><section className="panel login-panel"><h1>{t("singleSignOn")}</h1><p className="muted">{t("signInIntro")}</p><button className="primary-button" type="button" onClick={()=>window.location.assign(`/api/auth/${automaticSso}/login`)}>{t("singleSignOn")}</button></section></main></div>;

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
          <h1>{t("signIn")}</h1>
          <p className="muted">{t("signInIntro")}</p>
          {credentialProviders.length > 0 ? (
            <form className="login-form" onSubmit={submit}>
              {!challengeToken ? (
                <>
                  {credentialProviders.length > 1 && (
                    <div className="field">
                      <label htmlFor="credential-provider">{t("signInSource")}</label>
                      <select
                        id="credential-provider"
                        value={credentialProvider}
                        onChange={(event) => setCredentialProvider(event.target.value)}
                      >
                        {credentialProviders.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}
                      </select>
                    </div>
                  )}
                  {credentialProviders.length === 1 && credentialProvider !== "local" && <p className="muted">{t("signInWithProvider", { provider: credentialProviders[0].label })}</p>}
                  <div className="field">
                    <label htmlFor="username">{credentialProvider === "local" ? t("usernameOrEmail") : t("directoryUsername")}</label>
                    <input
                      id="username"
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="password">{t("password")}</label>
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
                  <p>{t("securityCodeHelp")}</p>
                  <div className="field">
                    <label htmlFor="two-factor-code">{t("securityCode")}</label>
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
                    ? t("invalidSecurityCode")
                    : t("invalidCredentials")}
                </p>
              )}
              <button
                className="primary-button"
                disabled={submitting}
                type="submit"
              >
                {submitting
                  ? t("signingIn")
                  : challengeToken
                    ? t("confirmAndSignIn")
                    : t("signIn")}
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
                    {t("passkeySignIn")}
                  </button>
                )}
              {!challengeToken && credentialProvider === "local" && (
                <button className="link-button" type="button" onClick={() => { setResetOpen((value) => !value); setResetMessage(""); }}>
                  {t("usePasswordResetCode")}
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
                  {t("back")}
                </button>
              )}
            </form>
          ) : (
            <p className="status-message">{t("passwordSignInDisabled")}</p>
          )}
          {resetOpen && configuration.authentication.localEnabled && (
            <form className="login-form" onSubmit={submitPasswordReset}>
              <h2>{t("chooseNewPassword")}</h2>
              <p className="muted">{t("passwordResetCodeHelp")}</p>
              <div className="field"><label htmlFor="password-reset-code">{t("oneTimeCode")}</label><input id="password-reset-code" required autoComplete="one-time-code" value={reset.code} onChange={(event) => setReset({ ...reset, code: event.target.value })} /></div>
              <div className="field"><label htmlFor="password-reset-new">{t("newPassword")}</label><input id="password-reset-new" type="password" required minLength={14} maxLength={128} autoComplete="new-password" value={reset.password} onChange={(event) => setReset({ ...reset, password: event.target.value })} /></div>
              <div className="field"><label htmlFor="password-reset-confirm">{t("repeatPassword")}</label><input id="password-reset-confirm" type="password" required minLength={14} maxLength={128} autoComplete="new-password" value={reset.confirmPassword} onChange={(event) => setReset({ ...reset, confirmPassword: event.target.value })} /></div>
              <button className="primary-button" disabled={submitting}>{submitting ? t("saving") : t("saveNewPassword")}</button>
            </form>
          )}
          {resetMessage && <p className={resetOpen ? "error-message" : "status-message"} role="status">{resetMessage}</p>}
          {configuration.authentication.oidcConfigurationEnabled && <a className="primary-button external-login" href="/api/auth/oidc/login">{t("oidcSignIn")}</a>}
          {configuration.authentication.samlConfigurationEnabled && <a className="primary-button external-login" href="/api/auth/saml/login">{t("samlSignIn")}</a>}
        </section>
      </main>
    </div>
  );
}
