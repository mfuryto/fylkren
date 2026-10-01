import type { MessageKey } from "../../en-US";

export const notificationsLvLV = {
  notificationSitesLoadFailed: "Pieejamās vietnes neizdevās ielādēt.",
  notificationSettingsLoadFailed: "Neizdevās ielādēt paziņojumu iestatījumus.",
  notificationSettingsSaveFailed: "Neizdevās saglabāt paziņojumu iestatījumus.",
  notificationSettingsSaved: "Paziņojuma iestatījumi tika saglabāti.",
  notifications: "Paziņojumi",
  notificationsIntro: "Izvēlieties, kurus e-pasta paziņojumus vietne izmanto.",
  notificationScopeHelp: "Paziņojumi seko piekļuves un darba līmenim. Vietnes nosaukums tiek pievienots SMTP sūtītāja vārdam.",
  saveNotificationSettings: "Saglabāt paziņojumu iestatījumus",
  notifyNewWork: "Jauns darbs",
  notifyNewWorkHelp: "Ziņojiet, kad līmenis saņem jaunu darbu.",
  notifyWorkChanges: "Darba izmaiņas",
  notifyWorkChangesHelp: "Ziņojiet vadībai, kad mainās darbs līmenī.",
  notifyDecisionRequired: "Vajadzīgā darbība",
  notifyDecisionRequiredHelp: "Ziņo vadītājam par vienu līmeni augstāk, kad lēmums ir nepieciešams.",
  notifyChildCompleted: "Darbs ar bērniem vai nobeiguma ziņojums pabeigts",
  notifyChildCompletedHelp: "Paziņot, kad pakārtots līmenis atgriež savu darbu.",
  notifyPlanningCompleted: "Plānošana pabeigta",
  notifyPlanningCompletedHelp: "Ziņo, kad plānojums ir iesniegts apstiprināšanai.",
  notifyExecutionCompleted: "Izpilde pabeigta",
  notifyExecutionCompletedHelp: "Ziņojiet, kad izpilde ir iesniegta pārskatīšanai.",
} satisfies Partial<Record<MessageKey, string>>;
