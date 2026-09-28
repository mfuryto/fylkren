import { useEffect, useState } from "react";
import { apiGet, apiMutate } from "../api/client";
import { errorMessage } from "../api/errors";
import { Modal } from "../components/Modal";
import issuerMark from "../assets/thunold-olsen-licensing-mark.png";

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
  none: "Ingen signert lisens installert",
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

function licenseDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("nb-NO", { year: "numeric", month: "long", day: "numeric" }) : "Ubegrenset";
}

export function LicenseCertificate({ response }: { response: LicenseResponse | null }) {
  const status = response?.status;
  const enterprise = status?.edition === "enterprise";
  const state = status?.state ?? "loading";
  const rights = status?.entitlements ?? [];
  const verification = state === "valid"
    ? "Signatur og instansbinding verifisert"
    : state === "loading" ? "Kontrollerer lisensen …" : statusLabels[state] ?? state;

  return <section className={`license-certificate ${enterprise ? "license-certificate-enterprise" : "license-certificate-community"}`} aria-label="Lisenssertifikat">
    <div className="license-certificate-frame">
      <header className="license-certificate-issuer">
        <img src={issuerMark} alt="" />
        <div><strong>THUNOLD-OLSEN</strong><span>Licensing Authority</span></div>
        <span className={`license-certificate-state license-certificate-state-${state === "valid" ? "valid" : "inactive"}`}>{verification}</span>
      </header>
      <div className="license-certificate-title">
        <span>{enterprise ? "Digitalt lisenssertifikat" : "Lisensstatus"}</span>
        <h2>Fylkren {enterprise ? "Enterprise" : "Community"}</h2>
        <p>{enterprise ? "Denne installasjonen er lisensiert til" : "Community kan brukes uten kommersiell lisens"}</p>
        <strong>{status?.customer ?? (state === "loading" ? "Laster …" : "Denne installasjonen")}</strong>
      </div>
      <dl className="license-certificate-details">
        <div><dt>Status</dt><dd>{status ? statusLabels[status.state] ?? status.state : "Laster …"}</dd></div>
        <div><dt>Gyldig til</dt><dd>{enterprise ? licenseDate(status?.expiresAt ?? null) : "Ingen utløpsdato"}</dd></div>
        <div><dt>Lisens-ID</dt><dd><code>{status?.licenseId ?? "Ikke tildelt"}</code></dd></div>
        <div><dt>Instans-ID</dt><dd><code>{status?.instanceId ?? "Laster …"}</code></dd></div>
      </dl>
      <div className="license-certificate-rights">
        <span>Lisensierte rettigheter</span>
        {rights.length > 0
          ? <ul>{rights.map(value => <li key={value}>{entitlementLabels[value] ?? value}</li>)}</ul>
          : <p>Community-funksjoner uten Enterprise-tillegg.</p>}
      </div>
      <footer className="license-certificate-footer">
        <span aria-hidden="true">✦</span>
        <p><strong>Autentisitet</strong><small>{enterprise ? "Verifisert lokalt med THUNOLD-OLSENs offentlige signeringsnøkkel. Ingen nettilkobling kreves." : "Importer en signert Enterprise-lisens for å aktivere utvidede rettigheter."}</small></p>
        <span aria-hidden="true">✦</span>
      </footer>
    </div>
  </section>;
}

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
    <LicenseCertificate response={license} />
    <section className="panel stacked-form license-management-panel">
      <div><h2>Administrer lisensen</h2><p className="muted">Bestill, importer eller fjern lisensen for denne installasjonen.</p></div>
      <div className="field"><span className="field-label">Instans-ID for denne installasjonen</span><div className="license-instance-row"><code>{license?.status.instanceId ?? "Laster …"}</code><button className="secondary-button" type="button" disabled={!license?.status.instanceId} onClick={() => void copyInstanceId()}>Kopier instans-ID</button></div></div>
      <div className="field"><span className="field-label">Bestill eller forny Enterprise</span><p>Kopier instans-ID-en og oppgi den i bestillingen. Hver selvstendige Fylkren-installasjon trenger sin egen lisensfil. Serveren trenger ikke internett; bestillingen kan gjøres fra en annen enhet.</p><a className="secondary-button" href={licensePortal} target="_blank" rel="noopener noreferrer">Åpne lisensportalen ↗</a></div>
      <div className="field"><label htmlFor="enterprise-license-file">Importer signert lisensfil</label><input id="enterprise-license-file" type="file" accept=".json,application/json" disabled={busy} onChange={event => { void importFile(event.target.files?.[0]); event.target.value = ""; }} /></div>
      {license?.status.state !== "none" && <div><button className="secondary-button danger" type="button" disabled={busy} onClick={() => setConfirmRemoval(true)}>Fjern lisens</button></div>}
    </section>
    {confirmRemoval && <Modal title="Fjern Enterprise-lisens" onClose={() => setConfirmRemoval(false)}><p>Dette stanser nye Enterprise-handlinger og webhook-utsending. Eksisterende oppgaver, rapporter, identitetskoblinger og historikk slettes ikke.</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setConfirmRemoval(false)}>Avbryt</button><button className="primary-button danger" type="button" disabled={busy} onClick={() => void remove()}>Fjern lisens</button></div></Modal>}
  </div>;
}
