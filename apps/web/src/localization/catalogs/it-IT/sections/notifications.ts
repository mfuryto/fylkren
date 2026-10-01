import type { MessageKey } from "../../en-US";

export const notificationsItIT = {
  notificationSitesLoadFailed: "I siti disponibili non potrebbero essere caricati.",
  notificationSettingsLoadFailed: "Le impostazioni di notifica non potrebbero essere caricate.",
  notificationSettingsSaveFailed: "Le impostazioni di notifica non potrebbero essere salvate.",
  notificationSettingsSaved: "Le impostazioni di notifica sono state salvate.",
  notifications: "Notifiche",
  notificationsIntro: "Scegliere quali notifiche e-mail sono utilizzate dal sito.",
  notificationScopeHelp: "Le notifiche seguono l'accesso e il livello di lavoro. Il nome del sito viene aggiunto al nome del mittente SMTP.",
  saveNotificationSettings: "Salvare le impostazioni di notifica",
  notifyNewWork: "Nuovo lavoro",
  notifyNewWorkHelp: "Informare quando il livello riceve un nuovo lavoro.",
  notifyWorkChanges: "Cambiamenti di lavoro",
  notifyWorkChangesHelp: "Informare la gestione quando il lavoro a livello cambia.",
  notifyDecisionRequired: "Azioni necessarie",
  notifyDecisionRequiredHelp: "Informare il manager un livello superiore quando è richiesta una decisione.",
  notifyChildCompleted: "Lavoro per bambini o relazione finale completata",
  notifyChildCompletedHelp: "Informare quando un livello subordinato restituisce il suo lavoro.",
  notifyPlanningCompleted: "Pianificazione completata",
  notifyPlanningCompletedHelp: "Informare quando la pianificazione è presentata per l'approvazione.",
  notifyExecutionCompleted: "Esecuzione completata",
  notifyExecutionCompletedHelp: "Informare quando l'esecuzione è presentata per la revisione.",
} satisfies Partial<Record<MessageKey, string>>;
