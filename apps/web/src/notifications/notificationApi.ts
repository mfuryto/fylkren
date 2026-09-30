import { apiGet, apiMutate } from "../api/client";
import { translateActive } from "../localization";

export type NotificationSettings = { newWorkItems: boolean; workItemChanges: boolean; decisionsRequired: boolean; childWorkCompleted: boolean; planningCompleted: boolean; executionCompleted: boolean };
export type NotificationSite = { siteId: string; name: string };
export type PersonalNotificationSite = NotificationSite & NotificationSettings & { available: Record<keyof NotificationSettings, boolean> };

export const loadNotificationSites = () => apiGet<NotificationSite[]>("/api/site-notifications/sites", translateActive("notificationSitesLoadFailed"));
export const loadSiteNotificationSettings = (siteId: string) => apiGet<NotificationSettings>(`/api/site-notifications/sites/${siteId}`, translateActive("notificationSettingsLoadFailed"));
export const saveSiteNotificationSettings = (siteId: string, settings: NotificationSettings) => apiMutate(`/api/site-notifications/sites/${siteId}`, "PUT", settings, translateActive("notificationSettingsSaveFailed"));
export const loadPersonalNotificationSettings = () => apiGet<PersonalNotificationSite[]>("/api/site-notifications/personal", translateActive("notificationSettingsLoadFailed"));
export const savePersonalNotificationSettings = (siteId: string, settings: NotificationSettings) => apiMutate(`/api/site-notifications/personal/${siteId}`, "PUT", settings, translateActive("notificationSettingsSaveFailed"));
