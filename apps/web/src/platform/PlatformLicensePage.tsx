import { useEffect, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { errorMessage } from "../api/errors";
import { Modal } from "../components/Modal";
import issuerMark from "../assets/thunold-olsen-licensing-mark.png";
import { useLanguage, useTranslation } from "../localization/LocalizationProvider";
import type { MessageKey } from "../localization/en";

type LicenseStatus = {
  edition: "community" | "enterprise";
  state: string;
  instanceId: string;
  licenseId: string | null;
  customer: string | null;
  expiresAt: string | null;
  entitlements: string[];
};
type LicenseResponse = { status: LicenseStatus; trustedIssuerConfigured: boolean };
const licensePortal = "https://license.thunold-olsen.no/";
const statusLabelKeys: Record<string, MessageKey> = {
  none: "licenseNone", valid: "licenseValid", expired: "licenseExpired",
  invalid: "licenseInvalid", untrusted: "licenseUntrusted", "not-yet-valid": "licenseNotYetValid",
};
const entitlementLabelKeys: Record<string, MessageKey> = {
  "machine-api": "entitlementMachineApi", webhooks: "entitlementWebhooks",
  "external-identity": "entitlementExternalIdentity", "instance-federation": "entitlementFederation",
};

function licenseDate(value: string | null, language: string, unlimited: string) {
  return value ? new Date(value).toLocaleDateString(language, { year: "numeric", month: "long", day: "numeric" }) : unlimited;
}

export function LicenseCertificate({ response }: { response: LicenseResponse | null }) {
  const t = useTranslation();
  const language = useLanguage();
  const status = response?.status;
  const enterprise = status?.edition === "enterprise";
  const state = status?.state ?? "loading";
  const rights = status?.entitlements ?? [];
  const verification = state === "valid"
    ? t("licenseSignatureVerified")
    : state === "loading" ? t("checkingLicense") : statusLabelKeys[state] ? t(statusLabelKeys[state]) : state;

  return <section className={`license-certificate ${enterprise ? "license-certificate-enterprise" : "license-certificate-community"}`} aria-label={t("licenseCertificate")}>
    <div className="license-certificate-frame">
      <header className="license-certificate-issuer">
        <img src={issuerMark} alt="" />
        <div><strong>THUNOLD-OLSEN</strong><span>Licensing Authority</span></div>
        <span className={`license-certificate-state license-certificate-state-${state === "valid" ? "valid" : "inactive"}`}>{verification}</span>
      </header>
      <div className="license-certificate-title">
        <span>{enterprise ? t("digitalLicenseCertificate") : t("licenseStatus")}</span>
        <h2>Fylkren {enterprise ? "Enterprise" : "Community"}</h2>
        <p>{enterprise ? t("licensedTo") : t("communityWithoutLicense")}</p>
        <strong>{status?.customer ?? (state === "loading" ? t("loading") : t("thisInstallation"))}</strong>
      </div>
      <dl className="license-certificate-details">
        <div><dt>Status</dt><dd>{status ? statusLabelKeys[status.state] ? t(statusLabelKeys[status.state]) : status.state : t("loading")}</dd></div>
        <div><dt>{t("validUntil")}</dt><dd>{enterprise ? licenseDate(status?.expiresAt ?? null, language, t("unlimited")) : t("noExpiryDate")}</dd></div>
        <div><dt>{t("licenseId")}</dt><dd><code>{status?.licenseId ?? t("notAssigned")}</code></dd></div>
        <div><dt>{t("instanceId")}</dt><dd><code>{status?.instanceId ?? t("loading")}</code></dd></div>
      </dl>
      <div className="license-certificate-rights">
        <span>{t("licensedEntitlements")}</span>
        {rights.length > 0
          ? <ul>{rights.map(value => <li key={value}>{entitlementLabelKeys[value] ? t(entitlementLabelKeys[value]) : value}</li>)}</ul>
          : <p>{t("communityWithoutAddons")}</p>}
      </div>
      <footer className="license-certificate-footer">
        <span aria-hidden="true">✦</span>
        <p><strong>{t("authenticity")}</strong><small>{enterprise ? t("authenticityEnterprise") : t("authenticityCommunity")}</small></p>
        <span aria-hidden="true">✦</span>
      </footer>
    </div>
  </section>;
}

export function PlatformLicensePage({ onChanged }: { onChanged: () => Promise<void> }) {
  const t = useTranslation();
  const [license, setLicense] = useState<LicenseResponse | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const load = () => apiGet<LicenseResponse>("/api/platform/license", t("licenseLoadFailed")).then(setLicense);
  useEffect(() => { void load().catch(error => setMessage(errorMessage(error, t("licenseLoadFailed")))); }, []);

  async function copyInstanceId() {
    if (!license?.status.instanceId) return;
    try {
      await navigator.clipboard.writeText(license.status.instanceId);
      setMessage(t("instanceIdCopied"));
    } catch {
      setMessage(t("copyFailedManual"));
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      if (file.size > 32_000) throw new Error(t("licenseFileTooLarge"));
      const parsed: unknown = JSON.parse(await file.text());
      if (typeof parsed !== "object" || parsed === null || !("payload" in parsed) || !("signature" in parsed) ||
        typeof parsed.payload !== "string" || typeof parsed.signature !== "string")
        throw new Error(t("licenseFileShapeInvalid"));
      await apiMutate("/api/platform/license", "POST", { payload: parsed.payload, signature: parsed.signature }, t("licenseImportFailed"));
      await load(); await onChanged();
      setMessage(t("enterpriseActivated"));
    } catch (error) { setMessage(errorMessage(error, t("licenseImportFailed"))); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true); setMessage("");
    try {
      await apiMutate("/api/platform/license", "DELETE", undefined, t("licenseRemovalFailed"));
      await load(); await onChanged(); setConfirmRemoval(false);
      setMessage(t("enterpriseDisabled"));
    } catch (error) { setMessage(errorMessage(error, t("licenseRemovalFailed"))); }
    finally { setBusy(false); }
  }

  return <div className="page platform-admin-page">
    <header className="page-header"><div><h1>{t("navLicense")}</h1><p className="muted">{t("licensePageIntro")}</p></div></header>
    {message && <p className="status-message" role="status">{message}</p>}
    <LicenseCertificate response={license} />
    <section className="panel stacked-form license-management-panel">
      <div><h2>{t("manageLicense")}</h2><p className="muted">{t("manageLicenseIntro")}</p></div>
      <div className="field"><span className="field-label">{t("installationInstanceId")}</span><div className="license-instance-row"><code>{license?.status.instanceId ?? t("loading")}</code><button className="secondary-button" type="button" disabled={!license?.status.instanceId} onClick={() => void copyInstanceId()}>{t("copyInstanceId")}</button></div></div>
      <div className="field"><span className="field-label">{t("orderOrRenewEnterprise")}</span><p>{t("orderLicenseHelp")}</p><a className="secondary-button" href={licensePortal} target="_blank" rel="noopener noreferrer">{t("openLicensePortal")}</a></div>
      <div className="field"><label htmlFor="enterprise-license-file">{t("importSignedLicense")}</label><input id="enterprise-license-file" type="file" accept=".json,application/json" disabled={busy} onChange={event => { void importFile(event.target.files?.[0]); event.target.value = ""; }} /></div>
      {license?.status.state !== "none" && <div><button className="secondary-button danger" type="button" disabled={busy} onClick={() => setConfirmRemoval(true)}>{t("removeLicense")}</button></div>}
    </section>
    {confirmRemoval && <Modal title={t("removeEnterpriseLicense")} onClose={() => setConfirmRemoval(false)}><p>{t("removeLicenseWarning")}</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setConfirmRemoval(false)}>{t("cancel")}</button><button className="primary-button danger" type="button" disabled={busy} onClick={() => void remove()}>{t("removeLicense")}</button></div></Modal>}
  </div>;
}
