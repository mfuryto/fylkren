import type { MessageKey } from "../../en-US";

export const notificationsDaDK = {
  notificationSitesLoadFailed: "De tilgængelige sites kunne ikke indlæses.",
  notificationSettingsLoadFailed: "Indstillingerne for underretninger kunne ikke indlæses.",
  notificationSettingsSaveFailed: "Indstillingerne for underretninger kunne ikke gemmes.",
  notificationSettingsSaved: "Indstillingerne for underretningen blev gemt.",
  notifications: "Meddelelser",
  notificationsIntro: "Vælg hvilke e-mail-meddelelser der bruges af webstedet.",
  notificationScopeHelp: "Anmeldelser følger adgangs- og arbejdsniveau. Webstedets navn tilføjes SMTP afsenderens navn.",
  saveNotificationSettings: "Gem notifikationsindstillinger",
  notifyNewWork: "Nyt arbejde",
  notifyNewWorkHelp: "Underret, når niveauet modtager nyt arbejde.",
  notifyWorkChanges: "Ændringer i arbejdet",
  notifyWorkChangesHelp: "Advisér ledelsen, når arbejdet på niveauet ændres.",
  notifyDecisionRequired: "Nødvendige foranstaltninger",
  notifyDecisionRequiredHelp: "Giv lederen besked på et niveau over, når der kræves en beslutning.",
  notifyChildCompleted: "Børnearbejde eller endelig rapport afsluttet",
  notifyChildCompletedHelp: "Underret når et underordnet niveau returnerer sit arbejde.",
  notifyPlanningCompleted: "Planlægning afsluttet",
  notifyPlanningCompletedHelp: "Underret, når planlægningen forelægges til godkendelse.",
  notifyExecutionCompleted: "Fuldført udførelse",
  notifyExecutionCompletedHelp: "Underret når henrettelsen er indsendt til revision.",
} satisfies Partial<Record<MessageKey, string>>;
