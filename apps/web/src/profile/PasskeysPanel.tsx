import { useEffect, useState } from "react";
import {
  listPasskeys,
  registerPasskey,
  removePasskey,
  type PasskeySummary,
} from "../api/authClient";

export function PasskeysPanel() {
  const [keys, setKeys] = useState<PasskeySummary[]>([]);
  const [name, setName] = useState("Min passkey");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setKeys(await listPasskeys());
  }

  useEffect(() => {
    void load();
  }, []);

  async function register() {
    setError("");
    try {
      await registerPasskey(name, currentPassword);
      setCurrentPassword("");
      await load();
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Passkey eller sikkerhetsnøkkel kunne ikke registreres. Kontroller HTTPS og domeneinnstillingene.",
      );
    }
  }

  async function remove(id: string) {
    try {
      await removePasskey(id, currentPassword);
      setCurrentPassword("");
      await load();
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Passkey eller sikkerhetsnøkkel kunne ikke fjernes.",
      );
    }
  }

  return (
    <section className="panel stacked-form two-factor-panel">
      <h2>Passkeys og sikkerhetsnøkler</h2>
      <p>WebAuthn krever HTTPS, bortsett fra lokal utvikling på localhost.</p>
      {error && <p className="error-message">{error}</p>}
      <div className="field">
        <label htmlFor="passkey-name">Navn på nøkkelen</label>
        <input
          id="passkey-name"
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="passkey-current-password">Gjeldende passord</label>
        <input
          id="passkey-current-password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </div>
      <button
        className="secondary-button"
        type="button"
        disabled={name.trim().length < 2 || currentPassword.length === 0 || !window.isSecureContext}
        onClick={register}
      >
        Legg til passkey eller sikkerhetsnøkkel
      </button>
      {keys.map((key) => (
        <div className="type-row" key={key.id}>
          <span>
            <strong>{key.name}</strong>
            <small className="muted">
              Opprettet {new Date(key.createdAt).toLocaleDateString()}
            </small>
          </span>
          <button
            className="link-button danger"
            type="button"
            disabled={currentPassword.length === 0}
            onClick={() => remove(key.id)}
          >
            Fjern
          </button>
        </div>
      ))}
    </section>
  );
}
