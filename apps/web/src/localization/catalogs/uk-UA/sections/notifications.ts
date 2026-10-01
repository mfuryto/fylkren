import type { MessageKey } from "../../en-US";

export const notificationsUkUA = {
  notificationSitesLoadFailed: "Доступні сайти не можуть бути завантажені.",
  notificationSettingsLoadFailed: "Параметри повідомлення не можуть бути завантажені.",
  notificationSettingsSaveFailed: "Параметри повідомлення не можуть бути збережені.",
  notificationSettingsSaved: "Вбережено налаштування повідомлень.",
  notifications: "Повідомлення",
  notificationsIntro: "Виберіть, які повідомлення електронної пошти використовуються на сайті.",
  notificationScopeHelp: "Повідомлення про використання та рівень роботи. Назва сайту додана до імені відправника SMTP.",
  saveNotificationSettings: "Зберегти налаштування повідомлень",
  notifyNewWork: "Нові роботи",
  notifyNewWorkHelp: "Повідомляти, коли рівень отримує нову роботу.",
  notifyWorkChanges: "Зміни роботи",
  notifyWorkChangesHelp: "Повідомляти управління при зміні рівня.",
  notifyDecisionRequired: "Дія обов'язкова",
  notifyDecisionRequiredHelp: "Повідомте менеджера одного рівня, перш ніж потрібно рішення.",
  notifyChildCompleted: "Робота дитини або фінальний звіт",
  notifyChildCompletedHelp: "Повідомляти, коли рівень підлеглості повертається її роботу.",
  notifyPlanningCompleted: "Планування завершено",
  notifyPlanningCompletedHelp: "Повідомляти про те, як планувати подано затвердження.",
  notifyExecutionCompleted: "Виконання",
  notifyExecutionCompletedHelp: "Повідомляти, коли виконання подано для розгляду.",
} satisfies Partial<Record<MessageKey, string>>;
