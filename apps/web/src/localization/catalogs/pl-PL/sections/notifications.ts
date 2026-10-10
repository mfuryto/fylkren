import type { MessageKey } from "../../en-US";

export const notificationsPlPL = {
  notificationSitesLoadFailed: "Nie udało się wczytać dostępnych Sites.",
  notificationSettingsLoadFailed: "Ustawienia powiadomień nie mogły być wczytane.",
  notificationSettingsSaveFailed: "Ustawienia powiadomień nie mogły zostać zapisane.",
  notificationSettingsSaved: "Ustawienia powiadomień zostały zapisane.",
  notifications: "Powiadomienia",
  notificationsIntro: "Wybierz powiadomienia e-mail używane przez Site.",
  notificationScopeHelp: "Powiadomienia uwzględniają poziom dostępu i poziom operacyjny. Nazwa Site jest dodawana do nazwy nadawcy SMTP.",
  saveNotificationSettings: "Zapisz ustawienia powiadomień",
  notifyNewWork: "Nowe zadania",
  notifyNewWorkHelp: "Powiadamiaj, gdy poziom otrzyma nowe zadanie.",
  notifyWorkChanges: "Zmiany w zadaniach",
  notifyWorkChangesHelp: "Powiadamiaj kierownictwo o zmianach w zadaniach na tym poziomie.",
  notifyDecisionRequired: "Wymagane działania",
  notifyDecisionRequiredHelp: "Powiadamiaj kierownika poziomu nadrzędnego, gdy wymagana jest decyzja.",
  notifyChildCompleted: "Ukończono zadanie podrzędne lub raport końcowy",
  notifyChildCompletedHelp: "Powiadamiaj, gdy poziom podrzędny zwróci ukończone zadanie.",
  notifyPlanningCompleted: "Zakończono planowanie",
  notifyPlanningCompletedHelp: "Powiadom, gdy plan zostanie przekazany do zatwierdzenia.",
  notifyExecutionCompleted: "Wykonanie zakończone",
  notifyExecutionCompletedHelp: "Powiadom, gdy wykonanie zostanie przekazane do kontroli.",
} satisfies Partial<Record<MessageKey, string>>;
