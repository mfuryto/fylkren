import { useEffect, useState } from "react";
import type React from "react";
import { userInitials } from "@fylkren/ui";
import QRCode from "qrcode";
import type { PublicConfiguration } from "../app/models";
import { beginTotpSetup, changeProfilePassword, confirmTotpSetup, deleteProfileImage, disableTotp as disableTotpAuthentication, loadSession, saveProfile as persistProfile, uploadProfileImage, type TotpSetup } from "./profileApi";
import type { Session } from "../work/WorkContextModels";
import { PasskeysPanel } from "./PasskeysPanel";
import { PersonalNotificationsPanel } from "./PersonalNotificationsPanel";

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
      setMessage("Profilen er oppdatert.");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Profilen kunne ikke oppdateres.");
    }
    setBusy(false);
  }
  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (passwords.newPassword !== passwords.confirmation) {
      setError("De nye passordene er ikke like.");
      return;
    }
    setBusy(true);
    try {
      await changeProfilePassword(passwords.currentPassword, passwords.newPassword);
      setPasswords({ currentPassword: "", newPassword: "", confirmation: "" });
      await refreshSession();
      setMessage("Passordet er endret.");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Passordet kunne ikke endres.");
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
      setMessage("Profilbildet er oppdatert.");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Bildet kunne ikke lagres. Bruk JPEG, PNG eller WebP på maksimalt 2 MB.");
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
      setMessage("Profilbildet er fjernet.");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Profilbildet kunne ikke fjernes.");
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
      setError(problem instanceof Error ? problem.message : "Tofaktoroppsettet kunne ikke startes.");
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
      setMessage(
        "Tofaktorautentisering er aktivert. Lagre gjenopprettingskodene nå.",
      );
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Koden kunne ikke bekreftes.");
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
      setMessage("Tofaktorautentisering er deaktivert.");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Tofaktor kunne ikke deaktiveres.");
    }
    setBusy(false);
  }

  return (
    <div className="page profile-page">
      <header className="page-header">
        <div>
          <h1>Min profil</h1>
          <p className="muted">Kontoinformasjon, profilbilde og passord.</p>
        </div>
        <button className="secondary-button" type="button" onClick={onSignOut}>
          Logg ut
        </button>
      </header>
      {session.mustChangePassword && (
        <div className="password-required" role="alert">
          <strong>Du må velge et nytt passord før du fortsetter.</strong>
          <span>
            Startpassordet er midlertidig og kan ikke brukes videre i systemet.
          </span>
        </div>
      )}
      {session.isDirectoryManaged && (
        <div className="status-message">
          <strong>Katalogstyrt profil.</strong> Navn og innloggingsinformasjon
          forvaltes i AD eller LDAP. Du kan fortsatt endre profilbildet her.
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
                alt={`Profilbilde for ${session.displayName ?? session.username}`}
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
            Velg bilde
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
              Fjern bilde
            </button>
          )}
          <p className="muted modal-note">
            JPEG, PNG eller WebP. Maksimalt 2 MB.
          </p>
        </section>
        <div className="profile-forms">
          <form className="panel stacked-form" onSubmit={saveProfile}>
            <h2>Profilinformasjon</h2>
            <div className="field">
              <label htmlFor="profile-display-name">Navn</label>
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
              <label htmlFor="profile-email">E-postadresse</label>
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
              <label htmlFor="profile-username">Brukernavn</label>
              <input
                id="profile-username"
                disabled
                value={session.username ?? ""}
              />
            </div>
            {!session.isDirectoryManaged && email.trim().toLocaleLowerCase() !== (session.email ?? "").trim().toLocaleLowerCase() && (
              <div className="field">
                <label htmlFor="profile-current-password">Gjeldende passord for å endre e-post</label>
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
                ? "Navn og brukernavn synkroniseres fra katalogtjenesten."
                : "Brukernavn endres av en administrator."}
            </p>
            {!session.isDirectoryManaged && (
              <button
                className="primary-button"
                disabled={busy || session.mustChangePassword}
              >
                Lagre profil
              </button>
            )}
          </form>
          {!session.isDirectoryManaged && (
            <form className="panel stacked-form" onSubmit={changePassword}>
              <h2>Endre passord</h2>
              <div className="field">
                <label htmlFor="current-password">Gjeldende passord</label>
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
                <label htmlFor="new-password">Nytt passord</label>
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
                <label htmlFor="confirm-password">Gjenta nytt passord</label>
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
                Passordet må være minst 14 tegn og forskjellig fra
                startpassordet.
              </p>
              <button className="primary-button" disabled={busy}>
                Endre passord
              </button>
            </form>
          )}
        </div>
      </div>
      <PersonalNotificationsPanel disabled={busy||Boolean(session.mustChangePassword)}/>
      <div className="profile-authentication-grid">
      {!session.isDirectoryManaged && configuration.authentication.mfaEnabled !== false && (
        <section className="panel stacked-form two-factor-panel">
          <h2>Tofaktorautentisering</h2>
          {session.twoFactorEnabled ? (
            <>
              <p>Autentiseringsapp er aktivert for kontoen.</p>
              <form className="stacked-form" onSubmit={disableTotp}>
                <div className="field">
                  <label htmlFor="disable-2fa-password">
                    Passord for å deaktivere
                  </label>
                  <input
                    id="disable-2fa-password"
                    type="password"
                    required
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                  />
                </div>
                <button className="danger-button" disabled={busy}>
                  Deaktiver tofaktor
                </button>
              </form>
            </>
          ) : totpSetup ? (
            <form className="stacked-form" onSubmit={confirmTotp}>
              <p>Skann QR-koden med autentiseringsappen.</p>
              {totpQrCode && (
                <img
                  className="totp-qr-code"
                  src={totpQrCode}
                  alt="QR-kode for oppsett av autentiseringsapp"
                />
              )}
              <details>
                <summary>Kan du ikke skanne? Vis manuell nøkkel</summary>
                <code className="totp-secret">{totpSetup.secret}</code>
                <code className="totp-uri">{totpSetup.provisioningUri}</code>
              </details>
              <div className="field">
                <label htmlFor="confirm-totp">Sekssifret kode</label>
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
                Bekreft og aktiver
              </button>
            </form>
          ) : (
            <>
              <p>
                Bruk en TOTP-kompatibel autentiseringsapp som ekstra kontroll
                ved lokal innlogging.
              </p>
              <div className="field">
                <label htmlFor="setup-2fa-password">Gjeldende passord</label>
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
                Sett opp autentiseringsapp
              </button>
            </>
          )}
          {recoveryCodes.length > 0 && (
            <div className="recovery-codes" role="status">
              <strong>Gjenopprettingskoder – vises bare nå</strong>
              <p>Lagre dem sikkert. Hver kode kan brukes én gang.</p>
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
