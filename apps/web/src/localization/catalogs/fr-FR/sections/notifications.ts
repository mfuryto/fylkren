import type { MessageKey } from "../../en-US";

export const notificationsFrFR = {
  notificationSitesLoadFailed: "Les sites disponibles ne pouvaient pas être chargés.",
  notificationSettingsLoadFailed: "Les paramètres de notification ne pouvaient pas être chargés.",
  notificationSettingsSaveFailed: "Les paramètres de notification ne peuvent pas être enregistrés.",
  notificationSettingsSaved: "Les paramètres de notification ont été enregistrés.",
  notifications: "Notifications",
  notificationsIntro: "Choisissez les notifications par courriel utilisées par le site.",
  notificationScopeHelp: "Les notifications suivent le niveau d'accès et de travail. Le nom du site est ajouté au nom de l'expéditeur SMTP.",
  saveNotificationSettings: "Enregistrer les paramètres de notification",
  notifyNewWork: "Nouveau travail",
  notifyNewWorkHelp: "Prévenez lorsque le niveau reçoit de nouveaux travaux.",
  notifyWorkChanges: "Changements dans le travail",
  notifyWorkChangesHelp: "Aviser la direction lorsque le travail au niveau change.",
  notifyDecisionRequired: "Mesures à prendre",
  notifyDecisionRequiredHelp: "Aviser le gestionnaire d'un niveau au-dessus lorsqu'une décision est nécessaire.",
  notifyChildCompleted: "Travail des enfants ou rapport final terminé",
  notifyChildCompletedHelp: "Notifier lorsque le niveau subordonné renvoie son travail.",
  notifyPlanningCompleted: "Planification achevée",
  notifyPlanningCompletedHelp: "Avisez-le lorsque la planification est soumise à l'approbation.",
  notifyExecutionCompleted: "Exécution achevée",
  notifyExecutionCompletedHelp: "Notifier lorsque l’exécution est soumise à vérification.",
} satisfies Partial<Record<MessageKey, string>>;
