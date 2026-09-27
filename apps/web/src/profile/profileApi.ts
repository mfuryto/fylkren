import { apiFormMutate, apiGet, apiMutate } from "../api/client";
import type { Session } from "../work/WorkContextModels";

export type TotpSetup = { secret: string; setupToken: string; provisioningUri: string };

export const loadSession = () => apiGet<Session>("/api/session", "Økten kunne ikke oppdateres.");
export const saveProfile = (displayName: string, email: string, currentPassword: string) => apiMutate("/api/profile", "PUT", { displayName, email, currentPassword }, "Profilen kunne ikke oppdateres.");
export const changeProfilePassword = (currentPassword: string, newPassword: string) => apiMutate("/api/profile/password", "PUT", { currentPassword, newPassword }, "Passordet kunne ikke endres.");
export const uploadProfileImage = (image: File) => { const form = new FormData(); form.append("image", image); return apiFormMutate("/api/profile/image", "PUT", form, "Profilbildet kunne ikke lagres."); };
export const deleteProfileImage = () => apiMutate("/api/profile/image", "DELETE", undefined, "Profilbildet kunne ikke fjernes.");
export const beginTotpSetup = (currentPassword: string) => apiMutate<TotpSetup>("/api/profile/2fa/setup", "POST", { currentPassword }, "Tofaktoroppsettet kunne ikke startes.");
export const confirmTotpSetup = (setupToken: string, code: string) => apiMutate<{ recoveryCodes: string[] }>("/api/profile/2fa/confirm", "POST", { setupToken, code }, "Koden kunne ikke bekreftes.");
export const disableTotp = (password: string) => apiMutate("/api/profile/2fa", "DELETE", { password }, "Tofaktor kunne ikke deaktiveres.");
