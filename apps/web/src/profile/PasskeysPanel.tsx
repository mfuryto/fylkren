import { useEffect, useState } from "react";
import {
  listPasskeys,
  registerPasskey,
  removePasskey,
  type PasskeySummary,
} from "../api/authClient";
import { useTranslation } from "../localization/LocalizationProvider";
import { ListSortControl, sortList, type ListSort } from "../components/ListSortControl";

export function PasskeysPanel() {
  const t = useTranslation();
  const [keys, setKeys] = useState<PasskeySummary[]>([]);
  const [name, setName] = useState(() => t("defaultPasskeyName"));
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState("");
  const [sort, setSort] = useState<ListSort>("newest");

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
          : t("passkeyRegisterFailed"),
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
          : t("passkeyRemoveFailed"),
      );
    }
  }

  return (
    <section className="panel stacked-form two-factor-panel">
      <div className="section-heading"><h2>{t("passkeys")}</h2><ListSortControl id="passkey-sort" value={sort} onChange={setSort} options={["newest", "oldest", "name-asc", "name-desc"]}/></div>
      <p>{t("passkeysIntro")}</p>
      {error && <p className="error-message">{error}</p>}
      <div className="field">
        <label htmlFor="passkey-name">{t("passkeyName")}</label>
        <input
          id="passkey-name"
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="passkey-current-password">{t("currentPassword")}</label>
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
        {t("addPasskey")}
      </button>
      {sortList(keys, sort, { name: key => key.name, createdAt: key => key.createdAt }).map((key) => (
        <div className="type-row" key={key.id}>
          <span>
            <strong>{key.name}</strong>
            <small className="muted">
              {t("passkeyCreated", { date: new Date(key.createdAt).toLocaleDateString() })}
            </small>
          </span>
          <button
            className="link-button danger"
            type="button"
            disabled={currentPassword.length === 0}
            onClick={() => remove(key.id)}
          >
            {t("remove")}
          </button>
        </div>
      ))}
    </section>
  );
}
