import type { MessageKey } from "../../en-US";

export const notificationsDaDK = {
  notificationSitesLoadFailed: "De tilgængelige sites kunne ikke indlæses.",
  notificationSettingsLoadFailed: "Notifikationsindstillingerne kunne ikke indlæses.",
  notificationSettingsSaveFailed: "Notifikationsindstillingerne kunne ikke gemmes.",
  notificationSettingsSaved: "Notifikationsindstillingerne blev gemt.",
  notifications: "Notifikationer",
  notificationsIntro: "Vælg, hvilke e-mailnotifikationer der bruges af denne Site.",
  notificationScopeHelp: "Varslinger følger adgang og arbejdsniveau. Site-navnet føjes til SMTP-afsenderens navn.",
  saveNotificationSettings: "Gem notifikationsindstillinger",
  notifyNewWork: "Ny opgave",
  notifyNewWorkHelp: "Send en notifikation, når niveauet modtager en ny opgave.",
  notifyWorkChanges: "Opgaveændringer",
  notifyWorkChangesHelp: "Send en notifikation til ledelsen, når en opgave på niveauet ændres.",
  notifyDecisionRequired: "Beslutning påkrævet",
  notifyDecisionRequiredHelp: "Giv lederen på niveauet ovenover besked, når en beslutning er påkrævet.",
  notifyChildCompleted: "Underordnet levering eller slutrapport færdig",
  notifyChildCompletedHelp: "Send en notifikation, når et underordnet niveau afleverer sit arbejde.",
  notifyPlanningCompleted: "Planlægning afsluttet",
  notifyPlanningCompletedHelp: "Underret, når planlægningen forelægges til godkendelse.",
  notifyExecutionCompleted: "Udførelse afsluttet",
  notifyExecutionCompletedHelp: "Send en notifikation, når udførelsen indsendes til gennemgang.",
} satisfies Partial<Record<MessageKey, string>>;
