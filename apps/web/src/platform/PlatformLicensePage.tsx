import { useEffect, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { errorMessage } from "../api/errors";
import { Modal } from "../components/Modal";

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
const statusLabels: Record<string, string> = {
  none: "Ingen lisens installert",
  valid: "Gyldig",
  expired: "Utløpt",
  invalid: "Ugyldig",
  untrusted: "Offentlig verifikasjonsnøkkel mangler",
  "not-yet-valid": "Ikke gyldig ennå",
};
const entitlementLabels: Record<string, string> = {
  "machine-api": "Administrasjons- og rapport-API",
  webhooks: "Webhooks",
  "external-identity": "Ekstern identitet (AD/LDAP, OIDC og SAML)",
  "instance-federation": "Instansfederering og oppdragsrouting",
};

export function PlatformLicensePage({ onChanged }: { onChanged: () => Promise<void> }) {
  const [license, setLicense] = useState<LicenseResponse | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const load = () => apiGet<LicenseResponse>("/api/platform/license", "Lisensstatus kunne ikke lastes.").then(setLicense);
  useEffect(() => { void load().catch(error => setMessage(errorMessage(error, "Lisensstatus kunne ikke lastes."))); }, []);

  async function copyInstanceId() {
    if (!license?.status.instanceId) return;
    try {
      await navigator.clipboard.writeText(license.status.instanceId);
      setMessage("Instans-ID er kopiert. Bruk den ved bestilling av lisens til denne installasjonen.");
    } catch {
      setMessage("Kunne ikke kopiere automatisk. Marker og kopier instans-ID-en manuelt.");
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      if (file.size > 32_000) throw new Error("Lisensfilen er for stor.");
      const parsed: unknown = JSON.parse(await file.text());
      if (typeof parsed !== "object" || parsed === null || !("payload" in parsed) || !("signature" in parsed) ||
        typeof parsed.payload !== "string" || typeof parsed.signature !== "string")
        throw new Error("Lisensfilen må inneholde payload og signature.");
      await apiMutate("/api/platform/license", "POST", { payload: parsed.payload, signature: parsed.signature }, "Lisensen kunne ikke importeres.");
      await load(); await onChanged();
      setMessage("Enterprise-lisensen er aktivert uten ny installasjon.");
    } catch (error) { setMessage(errorMessage(error, "Lisensen kunne ikke importeres.")); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true); setMessage("");
    try {
      await apiMutate("/api/platform/license", "DELETE", undefined, "Lisensen kunne ikke fjernes.");
      await load(); await onChanged(); setConfirmRemoval(false);
      setMessage("Enterprise-rettighetene er slått av. Data og historikk er bevart.");
    } catch (error) { setMessage(errorMessage(error, "Lisensen kunne ikke fjernes.")); }
    finally { setBusy(false); }
  }

  return <div className="page platform-admin-page">
    <header className="page-header"><div><h1>Lisens</h1><p className="muted">Én installasjon, ett datasett og samme programvare for Community og Enterprise.</p></div></header>
    {message && <p className="status-message" role="status">{message}</p>}
    <section className="panel stacked-form">
      <h2>{license?.status.edition === "enterprise" ? "Enterprise" : "Community"}</h2>
      <div className="field"><span className="field-label">Instans-ID for denne installasjonen</span><code>{license?.status.instanceId ?? "Laster …"}</code><button className="secondary-button" type="button" disabled={!license?.status.instanceId} onClick={() => void copyInstanceId()}>Kopier instans-ID</button></div>
      <p>Status: {license ? (statusLabels[license.status.state] ?? license.status.state) : "Laster …"}{license?.status.expiresAt ? ` · Utløper ${new Date(license.status.expiresAt).toLocaleString("nb-NO")}` : ""}</p>
      {license?.status.customer && <p>Kunde: {license.status.customer}</p>}
      {license?.status.licenseId && <p>Lisens-ID: <code>{license.status.licenseId}</code></p>}
      {license?.status.entitlements.length ? <p>Aktive rettigheter: {license.status.entitlements.map(value => entitlementLabels[value] ?? value).join(", ")}</p> : <p>Ingen Enterprise-rettigheter er aktive. Community-funksjonene er tilgjengelige uten lisens.</p>}
      <div className="field"><span className="field-label">Bestill eller forny Enterprise</span><p>Kopier instans-ID-en og oppgi den i bestillingen. Hver selvstendige Fylkren-installasjon trenger sin egen lisensfil. Serveren trenger ikke internett; bestillingen kan gjøres fra en annen enhet.</p><a className="secondary-button" href={licensePortal} target="_blank" rel="noopener noreferrer">Åpne lisensportalen ↗</a></div>
      <div className="field"><label htmlFor="enterprise-license-file">Importer signert lisensfil</label><input id="enterprise-license-file" type="file" accept=".json,application/json" disabled={busy} onChange={event => { void importFile(event.target.files?.[0]); event.target.value = ""; }} /></div>
      {license?.status.state !== "none" && <div><button className="secondary-button danger" type="button" disabled={busy} onClick={() => setConfirmRemoval(true)}>Fjern lisens</button></div>}
    </section>
    {confirmRemoval && <Modal title="Fjern Enterprise-lisens" onClose={() => setConfirmRemoval(false)}><p>Dette stanser nye Enterprise-handlinger og webhook-utsending. Eksisterende oppgaver, rapporter, identitetskoblinger og historikk slettes ikke.</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setConfirmRemoval(false)}>Avbryt</button><button className="primary-button danger" type="button" disabled={busy} onClick={() => void remove()}>Fjern lisens</button></div></Modal>}
  </div>;
}
