import { apiFormMutate, apiMutate } from "../api/client";
import type { Branding } from "../app/models";

export const saveBranding = (branding: Branding) => apiMutate("/api/platform/branding", "PUT", branding, "Utseendet kunne ikke lagres.");
export const uploadBrandingLogo = (logo: File) => { const data = new FormData(); data.append("logo", logo); return apiFormMutate("/api/platform/branding/logo", "PUT", data, "Logoen kunne ikke lagres."); };
export const deleteBrandingLogo = () => apiMutate("/api/platform/branding/logo", "DELETE", undefined, "Logoen kunne ikke fjernes.");
