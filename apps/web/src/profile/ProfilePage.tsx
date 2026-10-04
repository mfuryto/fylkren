import { useEffect, useState } from "react";
import type React from "react";
import { userInitials } from "@fylkren/ui";
import QRCode from "qrcode";
import type { PublicConfiguration } from "../app/models";
import { beginTotpSetup, changeProfilePassword, confirmTotpSetup, deleteProfileImage, disableTotp as disableTotpAuthentication, loadSession, saveProfile as persistProfile, uploadProfileImage, type TotpSetup } from "./profileApi";
import type { Session } from "../work/WorkContextModels";
import { PasskeysPanel } from "./PasskeysPanel";
import { PersonalNotificationsPanel } from "./PersonalNotificationsPanel";
import { useTranslation } from "../localization/LocalizationProvider";

export function ProfilePage({
  session,
  configuration,
  onSessionChanged,
  onSignOut,
}: {
  session: Session;
  configuration: PublicConfiguration;
  onSessionChanged: (session: Session) => void;
  onSignOut: () => void;
}) {
  const t = useTranslation();
  const [displayName, setDisplayName] = useState(session.displayName ?? "");
  const [email, setEmail] = useState(session.email ?? "");
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmation: "",
  });
  const [imageVersion, setImageVersion] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [totpSetup, setTotpSetup] = useState<TotpSetup | null>(null);
  const [totpQrCode, setTotpQrCode] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [totpSetupPassword, setTotpSetupPassword] = useState("");

  async function refreshSession() {
    onSessionChanged(await loadSession());
  }
  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await persistProfile(displayName, email, profilePassword);
      setProfilePassword("");
      await refreshSession();
      setMessage(t("profileUpdated"));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("profileUpdateFailed"));
    }
    setBusy(false);
  }
  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (passwords.newPassword !== passwords.confirmation) {
      setError(t("newPasswordsMismatch"));
      return;
    }
    setBusy(true);
    try {
      await changeProfilePassword(passwords.currentPassword, passwords.newPassword);
      setPasswords({ currentPassword: "", newPassword: "", confirmation: "" });
      await refreshSession();
      setMessage(t("passwordChanged"));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("passwordChangeFailed"));
    }
    setBusy(false);
  }
  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    if (!image) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await uploadProfileImage(image);
      setImageVersion(Date.now());
      await refreshSession();
      setMessage(t("profileImageUpdated"));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("profileImageSaveFailed"));
    }
    setBusy(false);
    event.target.value = "";
  }
  async function deleteImage() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await deleteProfileImage();
      await refreshSession();
      setMessage(t("profileImageRemoved"));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("profileImageRemoveFailed"));
    }
    setBusy(false);
  }
  async function beginTotp() {
    setBusy(true);
    setError("");
    try {
      const setup = await beginTotpSetup(totpSetupPassword);
      setTotpSetupPassword("");
      setTotpSetup(setup);
      setTotpQrCode(
        await QRCode.toDataURL(setup.provisioningUri, {
          width: 240,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      );
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("twoFactorSetupFailed"));
    }
    setBusy(false);
  }
  async function confirmTotp(event: React.FormEvent) {
    event.preventDefault();
    if (!totpSetup) return;
    setBusy(true);
    setError("");
    try {
      const result = await confirmTotpSetup(totpSetup.setupToken, totpCode);
      setRecoveryCodes(result.recoveryCodes);
      setTotpSetup(null);
      setTotpCode("");
      await refreshSession();
      setMessage(t("twoFactorEnabled"));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("twoFactorCodeFailed"));
    }
    setBusy(false);
  }
  async function disableTotp(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await disableTotpAuthentication(disablePassword);
      setDisablePassword("");
      await refreshSession();
      setMessage(t("twoFactorDisabled"));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("twoFactorDisableFailed"));
    }
    setBusy(false);
  }

  return (
    <div className="page profile-page">
      <header className="page-header">
        <div>
          <h1>{t("myProfile")}</h1>
          <p className="muted">{t("profileIntro")}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onSignOut}>
          {t("signOut")}
        </button>
      </header>
      {session.mustChangePassword && (
        <div className="password-required" role="alert">
          <strong>{t("passwordChangeRequired")}</strong>
          <span>{t("temporaryPasswordNotice")}</span>
        </div>
      )}
      {session.isDirectoryManaged && (
        <div className="status-message">
          <strong>{t("directoryManagedProfile")}</strong> {t("directoryManagedProfileHelp")}
        </div>
      )}
      {error && (
        <p className="status-message error-message" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="status-message status-active" role="status">
          {message}
        </p>
      )}
      <div className="profile-layout">
        <section className="panel profile-card">
          <div className="profile-image-large">
            {session.hasProfileImage ? (
              <img
                alt={t("profileImageAlt", { name: session.displayName ?? session.username ?? "" })}
                src={`/api/profile/image?v=${imageVersion}`}
              />
            ) : (
              userInitials(session.displayName ?? session.username ?? "FU")
            )}
          </div>
          <div>
            <strong>{session.displayName}</strong>
            <p className="muted">{session.username}</p>
          </div>
          <label className="secondary-button file-button">
            {t("chooseImage")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy || session.mustChangePassword}
              onChange={uploadImage}
            />
          </label>
          {session.hasProfileImage && (
            <button
              className="link-button danger"
              type="button"
              disabled={busy || session.mustChangePassword}
              onClick={deleteImage}
            >
              {t("removeImage")}
            </button>
          )}
          <p className="muted modal-note">
            {t("imageRequirements")}
          </p>
        </section>
        <div className="profile-forms">
          <form className="panel stacked-form" onSubmit={saveProfile}>
            <h2>{t("profileInformation")}</h2>
            <div className="field">
              <label htmlFor="profile-display-name">{t("name")}</label>
              <input
                id="profile-display-name"
                required
                minLength={2}
                maxLength={200}
                disabled={
                  session.mustChangePassword || session.isDirectoryManaged
                }
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="profile-email">{t("emailAddress")}</label>
              <input
                id="profile-email"
                type="email"
                required
                disabled={session.mustChangePassword || session.isDirectoryManaged}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="profile-username">{t("username")}</label>
              <input
                id="profile-username"
                disabled
                value={session.username ?? ""}
              />
            </div>
            {!session.isDirectoryManaged && email.trim().toLocaleLowerCase() !== (session.email ?? "").trim().toLocaleLowerCase() && (
              <div className="field">
                <label htmlFor="profile-current-password">{t("currentPasswordForEmail")}</label>
                <input
                  id="profile-current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  value={profilePassword}
                  onChange={(event) => setProfilePassword(event.target.value)}
                />
              </div>
            )}
            <p className="muted modal-note">
              {session.isDirectoryManaged
                ? t("directoryProfileSync")
                : t("usernameAdminManaged")}
            </p>
            {!session.isDirectoryManaged && (
              <button
                className="primary-button"
                disabled={busy || session.mustChangePassword}
              >
                {t("saveProfile")}
              </button>
            )}
          </form>
          {!session.isDirectoryManaged && (
            <form className="panel stacked-form" onSubmit={changePassword}>
              <h2>{t("changePassword")}</h2>
              <div className="field">
                <label htmlFor="current-password">{t("currentPassword")}</label>
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={passwords.currentPassword}
                  onChange={(event) =>
                    setPasswords({
                      ...passwords,
                      currentPassword: event.target.value,
                    })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="new-password">{t("newPassword")}</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={14}
                  maxLength={128}
                  value={passwords.newPassword}
                  onChange={(event) =>
                    setPasswords({
                      ...passwords,
                      newPassword: event.target.value,
                    })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="confirm-password">{t("repeatNewPassword")}</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={14}
                  maxLength={128}
                  value={passwords.confirmation}
                  onChange={(event) =>
                    setPasswords({
                      ...passwords,
                      confirmation: event.target.value,
                    })
                  }
                />
              </div>
              <p className="muted modal-note">
                {t("passwordRequirements")}
              </p>
              <button className="primary-button" disabled={busy}>
                {t("changePassword")}
              </button>
            </form>
          )}
        </div>
      </div>
      <PersonalNotificationsPanel disabled={busy||Boolean(session.mustChangePassword)}/>
      <div className="profile-authentication-grid">
      {!session.isDirectoryManaged && configuration.authentication.mfaEnabled !== false && (
        <section className="panel stacked-form two-factor-panel">
          <h2>{t("twoFactorAuthentication")}</h2>
          {session.twoFactorEnabled ? (
            <>
              <p>{t("authenticatorActive")}</p>
              <form className="stacked-form" onSubmit={disableTotp}>
                <div className="field">
                  <label htmlFor="disable-2fa-password">
                    {t("passwordToDisable")}
                  </label>
                  <input
                    id="disable-2fa-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                  />
                </div>
                <button className="danger-button" disabled={busy}>
                  {t("disableTwoFactor")}
                </button>
              </form>
            </>
          ) : totpSetup ? (
            <form className="stacked-form" onSubmit={confirmTotp}>
              <p>{t("scanQrCode")}</p>
              {totpQrCode && (
                <img
                  className="totp-qr-code"
                  src={totpQrCode}
                  alt={t("qrCodeAlt")}
                />
              )}
              <details>
                <summary>{t("manualKeyHelp")}</summary>
                <code className="totp-secret">{totpSetup.secret}</code>
                <code className="totp-uri">{totpSetup.provisioningUri}</code>
              </details>
              <div className="field">
                <label htmlFor="confirm-totp">{t("sixDigitCode")}</label>
                <input
                  id="confirm-totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                />
              </div>
              <button className="primary-button" disabled={busy}>
                {t("confirmAndEnable")}
              </button>
            </form>
          ) : (
            <>
              <p>{t("totpIntro")}</p>
              <div className="field">
                <label htmlFor="setup-2fa-password">{t("currentPassword")}</label>
                <input
                  id="setup-2fa-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  value={totpSetupPassword}
                  onChange={(event) => setTotpSetupPassword(event.target.value)}
                />
              </div>
              <button
                className="secondary-button"
                type="button"
                disabled={busy || session.mustChangePassword || totpSetupPassword.length === 0}
                onClick={beginTotp}
              >
                {t("setupAuthenticator")}
              </button>
            </>
          )}
          {recoveryCodes.length > 0 && (
            <div className="recovery-codes" role="status">
              <strong>{t("recoveryCodesTitle")}</strong>
              <p>{t("recoveryCodesHelp")}</p>
              <code>{recoveryCodes.join("\n")}</code>
            </div>
          )}
        </section>
      )}
      {!session.isDirectoryManaged && configuration.authentication.mfaEnabled !== false && configuration.authentication.webAuthnEnabled && <PasskeysPanel />}
      </div>
    </div>
  );
}
