import type { MessageKey } from "../../en-US";

export const notificationsPlPL = {
  notificationSitesLoadFailed: "Dostępne strony nie mogły być załadowane.",
  notificationSettingsLoadFailed: "Ustawienia powiadomień nie mogły być wczytane.",
  notificationSettingsSaveFailed: "Ustawienia powiadomień nie mogły zostać zapisane.",
  notificationSettingsSaved: "Ustawienia powiadomień zostały zapisane.",
  notifications: "Powiadomienia",
  notificationsIntro: "Wybierz, które powiadomienia e-mail są używane przez stronę.",
  notificationScopeHelp: "Powiadomienia są zgodne z poziomem dostępu i pracy. Nazwa strony jest dodawana do nazwy nadawcy SMTP.",
  saveNotificationSettings: "Zapisz ustawienia powiadomień",
  notifyNewWork: "Nowa praca",
  notifyNewWorkHelp: "Informuj, kiedy poziom otrzymuje nowe prace.",
  notifyWorkChanges: "Zmiany w pracy",
  notifyWorkChangesHelp: "Informuj kierownictwo, gdy praca na poziomie zmian.",
  notifyDecisionRequired: "Wymagane działania",
  notifyDecisionRequiredHelp: "Powiadomienie kierownika o jednym poziomie powyżej, gdy wymagana jest decyzja.",
  notifyChildCompleted: "Praca nad dzieckiem lub sprawozdanie końcowe zakończone",
  notifyChildCompletedHelp: "Informuj, kiedy poziom podrzędny zwróci swoją pracę.",
  notifyPlanningCompleted: "Zakończono planowanie",
  notifyPlanningCompletedHelp: "Powiadom, gdy plan zostanie przekazany do zatwierdzenia.",
  notifyExecutionCompleted: "Wykonanie zakończone",
  notifyExecutionCompletedHelp: "Powiadom, gdy wykonanie zostanie przekazane do kontroli.",
} satisfies Partial<Record<MessageKey, string>>;
