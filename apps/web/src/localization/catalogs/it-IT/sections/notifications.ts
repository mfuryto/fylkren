import type { MessageKey } from "../../en-US";

export const notificationsItIT = {
  notificationSitesLoadFailed: "I Sites disponibili non possono essere caricati.",
  notificationSettingsLoadFailed: "Le impostazioni di notifica non possono essere caricate.",
  notificationSettingsSaveFailed: "Le impostazioni di notifica non possono essere salvate.",
  notificationSettingsSaved: "Le impostazioni di notifica sono state salvate.",
  notifications: "Notifiche",
  notificationsIntro: "Scegliere quali notifiche e-mail sono utilizzate dal Site.",
  notificationScopeHelp: "Le notifiche seguono l'accesso e il livello operativo. Il nome del Site viene aggiunto al nome del mittente SMTP.",
  saveNotificationSettings: "Salvare le impostazioni di notifica",
  notifyNewWork: "Nuovo lavoro",
  notifyNewWorkHelp: "Informare quando il livello riceve un nuovo lavoro.",
  notifyWorkChanges: "Cambiamenti di lavoro",
  notifyWorkChangesHelp: "Informare la gestione quando il lavoro a livello cambia.",
  notifyDecisionRequired: "Azioni necessarie",
  notifyDecisionRequiredHelp: "Informare il responsabile un livello superiore quando è richiesta una decisione.",
  notifyChildCompleted: "Attività subordinata o rapporto finale completato",
  notifyChildCompletedHelp: "Informare quando un livello subordinato restituisce il suo lavoro.",
  notifyPlanningCompleted: "Pianificazione completata",
  notifyPlanningCompletedHelp: "Informare quando la pianificazione è presentata per l'approvazione.",
  notifyExecutionCompleted: "Esecuzione completata",
  notifyExecutionCompletedHelp: "Informare quando l'esecuzione è presentata per la revisione.",} satisfies Partial<Record<MessageKey, string>>;
