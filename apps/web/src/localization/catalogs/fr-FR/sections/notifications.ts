import type { MessageKey } from "../../en-US";

export const notificationsFrFR = {
  notificationSitesLoadFailed: "Les Sites disponibles n’ont pas pu être chargés.",
  notificationSettingsLoadFailed: "Les paramètres de notification n’ont pas pu être chargés.",
  notificationSettingsSaveFailed: "Les paramètres de notification ne peuvent pas être enregistrés.",
  notificationSettingsSaved: "Les paramètres de notification ont été enregistrés.",
  notifications: "Notifications",
  notificationsIntro: "Choisissez les notifications par courriel utilisées par le Site.",
  notificationScopeHelp: "Les notifications respectent le niveau d'accès et le niveau opérationnel. Le nom du Site est ajouté au nom de l'expéditeur SMTP.",
  saveNotificationSettings: "Enregistrer les paramètres de notification",
  notifyNewWork: "Nouvelle tâche",
  notifyNewWorkHelp: "Notifier le destinataire lorsque ce niveau reçoit une nouvelle tâche.",
  notifyWorkChanges: "Modification d'une tâche",
  notifyWorkChangesHelp: "Notifier la direction lorsqu'une tâche de ce niveau est modifiée.",
  notifyDecisionRequired: "Mesures à prendre",
  notifyDecisionRequiredHelp: "Aviser le responsable d'un niveau au-dessus lorsqu'une décision est nécessaire.",
  notifyChildCompleted: "Tâche subordonnée ou rapport final terminé",
  notifyChildCompletedHelp: "Notifier lorsque le niveau subordonné renvoie son résultat.",
  notifyPlanningCompleted: "Planification achevée",
  notifyPlanningCompletedHelp: "Avisez-le lorsque la planification est soumise à l'approbation.",
  notifyExecutionCompleted: "Exécution achevée",
  notifyExecutionCompletedHelp: "Notifier lorsque l’exécution est soumise à vérification.",
} satisfies Partial<Record<MessageKey, string>>;
