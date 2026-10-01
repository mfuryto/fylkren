import type { MessageKey } from "../../en-US";

export const notificationsFiFI = {
  notificationSitesLoadFailed: "Saatavilla olevia sivustoja ei voitu ladata.",
  notificationSettingsLoadFailed: "Ilmoitusasetuksia ei voitu ladata.",
  notificationSettingsSaveFailed: "Ilmoitusasetuksia ei voitu tallentaa.",
  notificationSettingsSaved: "Ilmoitusasetukset tallennettiin.",
  notifications: "Ilmoitukset",
  notificationsIntro: "Valitse, mitä sähköposti-ilmoituksia sivusto käyttää.",
  notificationScopeHelp: "Ilmoitukset seuraavat pääsyä ja työn tasoa. Sivuston nimi lisätään SMTP lähettäjän nimeen.",
  saveNotificationSettings: "Tallenna ilmoitusasetukset",
  notifyNewWork: "Uusi työ",
  notifyNewWorkHelp: "Ilmoita, kun taso saa uutta työtä.",
  notifyWorkChanges: "Työn muutokset",
  notifyWorkChangesHelp: "Ilmoita johdolle, kun työtaso muuttuu.",
  notifyDecisionRequired: "Tarvittavat toimet",
  notifyDecisionRequiredHelp: "Ilmoita johtajalle yksi taso, kun päätös on tarpeen.",
  notifyChildCompleted: "Lapsityö tai loppuraportti valmistunut",
  notifyChildCompletedHelp: "Ilmoita, kun alisteinen taso palauttaa työnsä.",
  notifyPlanningCompleted: "Suunnittelu suoritettu",
  notifyPlanningCompletedHelp: "Ilmoita, kun suunnittelu on toimitettu hyväksyttäväksi.",
  notifyExecutionCompleted: "Toteutus suoritettu",
  notifyExecutionCompletedHelp: "Ilmoita, kun teloitus toimitetaan uudelleen arvioitavaksi.",
} satisfies Partial<Record<MessageKey, string>>;
