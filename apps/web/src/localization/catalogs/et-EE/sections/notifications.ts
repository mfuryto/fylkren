import type { MessageKey } from "../../en-US";

export const notificationsEtEE = {
  notificationSitesLoadFailed: "Saadaolevaid veebilehti ei saa laadida.",
  notificationSettingsLoadFailed: "Märguannete seadistusi ei saa laadida.",
  notificationSettingsSaveFailed: "Märguannete seadistusi ei õnnestunud salvestada.",
  notificationSettingsSaved: "Märguannete seadistused salvestati.",
  notifications: "Teatised",
  notificationsIntro: "Valige, milliseid e-posti teateid veebisait kasutab.",
  notificationScopeHelp: "Teatised järgivad ligipääsu ja töötaset. Saidi nimi lisatakse SMTP saatja nimele.",
  saveNotificationSettings: "Märguannete seadistuste salvestamine",
  notifyNewWork: "Uus töö",
  notifyNewWorkHelp: "Teavitage, kui tase saab uue töö.",
  notifyWorkChanges: "Tööalased muudatused",
  notifyWorkChangesHelp: "Juhtkonna teavitamine, kui töö tase muutub.",
  notifyDecisionRequired: "Vajalik tegevus",
  notifyDecisionRequiredHelp: "Teatage juhile üks tase üle, kui otsus on vajalik.",
  notifyChildCompleted: "Lapsetöö või lõpparuanne lõpetatud",
  notifyChildCompletedHelp: "Teatage, kui alluv tase tagastab oma töö.",
  notifyPlanningCompleted: "Planeerimine lõpetatud",
  notifyPlanningCompletedHelp: "Teatage, kui planeering esitatakse heakskiitmiseks.",
  notifyExecutionCompleted: "Täitmine lõpetatud",
  notifyExecutionCompletedHelp: "Teatage, kui täitmine on läbivaatamiseks esitatud.",
} satisfies Partial<Record<MessageKey, string>>;
