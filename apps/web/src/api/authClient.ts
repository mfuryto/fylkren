import { apiGet, apiRequest, clearApiGetCache, getAntiforgeryToken } from "./client";
import type { Session } from "../work/WorkContextModels";
import { translateActive as t } from "../localization";

export type PasskeySummary = { id: string; name: string; createdAt: string };
export type SignInResult = { challengeToken?: string; session?: Session };

function webAuthnOptions(value: any) {
  const decode = (input: string) => Uint8Array.from(
    atob(input.replace(/-/g, "+").replace(/_/g, "/")),
    character => character.charCodeAt(0),
  );
  return {
    ...value,
    challenge: decode(value.challenge),
    user: value.user ? { ...value.user, id: decode(value.user.id) } : undefined,
    excludeCredentials: value.excludeCredentials?.map((credential: any) => ({ ...credential, id: decode(credential.id) })),
    allowCredentials: value.allowCredentials?.map((credential: any) => ({ ...credential, id: decode(credential.id) })),
  };
}

function webAuthnCredential(value: PublicKeyCredential) {
  if (typeof (value as any).toJSON === "function") return (value as any).toJSON();
  const encode = (data: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const response = value.response as any;
  return {
    id: value.id,
    rawId: encode(value.rawId),
    type: value.type,
    response: {
      clientDataJSON: encode(response.clientDataJSON),
      attestationObject: response.attestationObject ? encode(response.attestationObject) : undefined,
      authenticatorData: response.authenticatorData ? encode(response.authenticatorData) : undefined,
      signature: response.signature ? encode(response.signature) : undefined,
      userHandle: response.userHandle ? encode(response.userHandle) : null,
    },
    clientExtensionResults: value.getClientExtensionResults(),
  };
}

async function session() {
  return apiGet<Session>("/api/session", t("sessionLoadFailed"));
}

async function postJson(path: string, body: object, fallback: string, csrf?: string) {
  return apiRequest(path, fallback, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(csrf ? { "X-Fylkren-CSRF": csrf } : {}) },
    body: JSON.stringify(body),
  });
}

export async function signIn(provider: string, username: string, password: string, challengeToken: string, code: string): Promise<SignInResult> {
  const isDirectory = provider === "ad" || provider === "ldap";
  const response = await postJson(
    challengeToken ? "/api/session/2fa" : isDirectory ? "/api/session/directory" : "/api/session",
    challengeToken ? { challengeToken, code } : isDirectory ? { provider, username, password } : { username, password },
    "Innloggingen mislyktes.",
  );
  if (response.status === 202) return { challengeToken: ((await response.json()) as { challengeToken: string }).challengeToken };
  clearApiGetCache();
  return { session: await session() };
}

export async function bootstrapPlatformManager(value: { displayName: string; email: string; username: string; password: string }) {
  await postJson("/api/bootstrap/platform-manager", value, t("setupFailed"));
  clearApiGetCache();
  return session();
}

export async function completePasswordReset(resetCode: string, newPassword: string) {
  await postJson("/api/password-reset/complete", { resetCode, newPassword }, t("passwordUpdateFailed"));
}

export async function listPasskeys() {
  return apiGet<PasskeySummary[]>("/api/webauthn/credentials", t("passkeysLoadFailed"));
}

export async function registerPasskey(name: string, currentPassword: string) {
  const csrf = await getAntiforgeryToken();
  const start = await postJson("/api/webauthn/register/options", { name, currentPassword }, t("passkeyRegistrationStartFailed"), csrf);
  const data = await start.json();
  const credential = await navigator.credentials.create({ publicKey: webAuthnOptions(data.options) }) as PublicKeyCredential | null;
  if (!credential) throw new Error(t("noPasskeySelected"));
  await postJson("/api/webauthn/register/complete", { token: data.token, credential: webAuthnCredential(credential) }, t("passkeyVerificationFailed"), csrf);
}

export async function removePasskey(id: string, currentPassword: string) {
  const csrf = await getAntiforgeryToken();
  await apiRequest(`/api/webauthn/credentials/${id}`, t("passkeyRemovalFailed"), {
    method: "DELETE",
    headers: { "X-Fylkren-CSRF": csrf, "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword }),
  });
  clearApiGetCache();
}

export async function signInWithPasskey(username: string) {
  const start = await postJson("/api/webauthn/login/options", { name: username }, t("passkeySignInStartFailed"));
  const data = await start.json();
  const credential = await navigator.credentials.get({ publicKey: webAuthnOptions(data.options) }) as PublicKeyCredential | null;
  if (!credential) throw new Error(t("noPasskeySelected"));
  await postJson("/api/webauthn/login/complete", { token: data.token, credential: webAuthnCredential(credential) }, "Passkey-innloggingen mislyktes.");
  clearApiGetCache();
  return session();
}

export async function signOut() {
  const csrf = await getAntiforgeryToken();
  await apiRequest("/api/session", t("signOutFailed"), {
    method: "DELETE",
    headers: { "X-Fylkren-CSRF": csrf },
  });
  clearApiGetCache();
}
