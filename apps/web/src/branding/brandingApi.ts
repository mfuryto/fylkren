import { apiFormMutate, apiMutate } from "../api/client";
import type { Branding, RegionalSettings } from "../app/models";

export const saveBranding = (branding: Branding) => apiMutate("/api/platform/branding", "PUT", branding, "Appearance could not be saved.");
export const uploadBrandingLogo = (logo: File) => { const data = new FormData(); data.append("logo", logo); return apiFormMutate("/api/platform/branding/logo", "PUT", data, "Logo could not be saved."); };
export const deleteBrandingLogo = () => apiMutate("/api/platform/branding/logo", "DELETE", undefined, "Logo could not be removed.");
export const saveRegionalSettings = (settings: RegionalSettings) =>
  apiMutate<RegionalSettings>("/api/platform/regional-settings", "PUT", settings, "Regional settings could not be saved.");
