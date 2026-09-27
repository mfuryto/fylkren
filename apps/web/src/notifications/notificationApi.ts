import { apiGet, apiMutate } from "../api/client";

export type NotificationSettings = { newWorkItems: boolean; workItemChanges: boolean; decisionsRequired: boolean; childWorkCompleted: boolean; planningCompleted: boolean; executionCompleted: boolean };
export type NotificationSite = { siteId: string; name: string };
export type PersonalNotificationSite = NotificationSite & NotificationSettings & { available: Record<keyof NotificationSettings, boolean> };

export const loadNotificationSites = () => apiGet<NotificationSite[]>("/api/site-notifications/sites", "Tilgjengelige sites kunne ikke lastes.");
export const loadSiteNotificationSettings = (siteId: string) => apiGet<NotificationSettings>(`/api/site-notifications/sites/${siteId}`, "Varslingsvalgene kunne ikke lastes.");
export const saveSiteNotificationSettings = (siteId: string, settings: NotificationSettings) => apiMutate(`/api/site-notifications/sites/${siteId}`, "PUT", settings, "Varslingsvalgene kunne ikke lagres.");
export const loadPersonalNotificationSettings = () => apiGet<PersonalNotificationSite[]>("/api/site-notifications/personal", "Varslingsvalgene kunne ikke lastes.");
export const savePersonalNotificationSettings = (siteId: string, settings: NotificationSettings) => apiMutate(`/api/site-notifications/personal/${siteId}`, "PUT", settings, "Varslingsvalgene kunne ikke lagres.");
