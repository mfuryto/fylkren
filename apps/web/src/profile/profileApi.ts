import { apiFormMutate, apiGet, apiMutate } from "../api/client";
import { translateActive } from "../localization";
import type { Session } from "../work/WorkContextModels";

export type TotpSetup = { secret: string; setupToken: string; provisioningUri: string };

export const loadSession = () => apiGet<Session>("/api/session", translateActive("sessionRefreshFailed"));
export const saveProfile = (displayName: string, email: string, currentPassword: string) => apiMutate("/api/profile", "PUT", { displayName, email, currentPassword }, translateActive("profileSaveApiFailed"));
export const changeProfilePassword = (currentPassword: string, newPassword: string) => apiMutate("/api/profile/password", "PUT", { currentPassword, newPassword }, translateActive("passwordChangeApiFailed"));
export const uploadProfileImage = (image: File) => { const form = new FormData(); form.append("image", image); return apiFormMutate("/api/profile/image", "PUT", form, translateActive("profileImageSaveApiFailed")); };
export const deleteProfileImage = () => apiMutate("/api/profile/image", "DELETE", undefined, translateActive("profileImageDeleteApiFailed"));
export const beginTotpSetup = (currentPassword: string) => apiMutate<TotpSetup>("/api/profile/2fa/setup", "POST", { currentPassword }, translateActive("totpSetupApiFailed"));
export const confirmTotpSetup = (setupToken: string, code: string) => apiMutate<{ recoveryCodes: string[] }>("/api/profile/2fa/confirm", "POST", { setupToken, code }, translateActive("totpConfirmApiFailed"));
export const disableTotp = (password: string) => apiMutate("/api/profile/2fa", "DELETE", { password }, translateActive("totpDisableApiFailed"));
