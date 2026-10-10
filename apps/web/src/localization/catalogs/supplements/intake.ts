export const intakeEn = {
  navIntakeSettings: "Intake",
  intakeSettingsIntro: "Manage source types and senders for manual registration. Externally received senders remain snapshots and are not added to this list.",
} as const;

export type IntakeMessageKey = keyof typeof intakeEn;
type IntakeMessages = Record<IntakeMessageKey, string>;

export const intakeTranslations: Record<string, IntakeMessages> = {
  "en-US": intakeEn,
  "en-GB": intakeEn,
  "nb-NO": { navIntakeSettings: "Mottak", intakeSettingsIntro: "Administrer kildetyper og avsendere som kan velges ved manuell registrering. Avsendere som mottas utenfra, bevares som øyeblikksbilder og legges ikke automatisk i listen." },
  "sv-SE": { navIntakeSettings: "Intag", intakeSettingsIntro: "Hantera källtyper och avsändare för manuell registrering. Externt mottagna avsändare bevaras som ögonblicksbilder och läggs inte till i listan." },
  "da-DK": { navIntakeSettings: "Modtagelse", intakeSettingsIntro: "Administrer kildetyper og afsendere til manuel registrering. Eksternt modtagne afsendere bevares som snapshots og føjes ikke til listen." },
  "fi-FI": { navIntakeSettings: "Vastaanotto", intakeSettingsIntro: "Hallitse manuaalisen rekisteröinnin lähdetyyppejä ja lähettäjiä. Ulkoa vastaanotetut lähettäjät säilyvät tilannekuvina eikä niitä lisätä luetteloon." },
  "de-DE": { navIntakeSettings: "Erfassung", intakeSettingsIntro: "Verwalten Sie Quelltypen und Absender für die manuelle Erfassung. Extern empfangene Absender bleiben Snapshots und werden nicht zur Liste hinzugefügt." },
  "fr-FR": { navIntakeSettings: "Saisie", intakeSettingsIntro: "Gérez les types de source et les expéditeurs pour la saisie manuelle. Les expéditeurs reçus de l'extérieur restent des instantanés et ne sont pas ajoutés à la liste." },
  "pl-PL": { navIntakeSettings: "Rejestracja", intakeSettingsIntro: "Zarządzaj typami źródeł i nadawcami używanymi przy rejestracji ręcznej. Dane nadawców odebrane z zewnątrz pozostają zapisami historycznymi i nie są dodawane do tej listy." },
  "es-ES": { navIntakeSettings: "Registro", intakeSettingsIntro: "Gestione los tipos de fuente y remitentes para el registro manual. Los remitentes recibidos externamente se conservan como copias históricas y no se añaden a la lista." },
  "it-IT": { navIntakeSettings: "Registrazione", intakeSettingsIntro: "Gestisci i tipi di origine e i mittenti per la registrazione manuale. I mittenti ricevuti esternamente restano snapshot e non vengono aggiunti all’elenco." },
  "uk-UA": { navIntakeSettings: "Реєстрація", intakeSettingsIntro: "Керуйте типами джерел і відправниками для ручної реєстрації. Отримані ззовні відправники зберігаються як snapshots і не додаються до списку." },
  "nl-NL": { navIntakeSettings: "Registratie", intakeSettingsIntro: "Beheer brontypen en afzenders voor handmatige registratie. Extern ontvangen afzenders blijven snapshots en worden niet aan de lijst toegevoegd." },
  "pt-PT": { navIntakeSettings: "Registo", intakeSettingsIntro: "Gira os tipos de origem e remetentes para registo manual. Os remetentes recebidos externamente permanecem snapshots e não são adicionados à lista." },
  "cs-CZ": { navIntakeSettings: "Registrace", intakeSettingsIntro: "Spravujte typy zdrojů a odesílatele pro ruční registraci. Externě přijatí odesílatelé zůstávají snapshots a do seznamu se nepřidávají." },
  "ro-RO": { navIntakeSettings: "Înregistrare", intakeSettingsIntro: "Gestionați tipurile de sursă și expeditorii pentru înregistrarea manuală. Expeditorii primiți extern rămân snapshots și nu sunt adăugați în listă." },
  "et-EE": { navIntakeSettings: "Registreerimine", intakeSettingsIntro: "Hallake käsitsi registreerimise allikatüüpe ja saatjaid. Väljast vastu võetud saatjad säilitatakse snapshots-kujul ega lisata loendisse." },
  "lv-LV": { navIntakeSettings: "Reģistrācija", intakeSettingsIntro: "Pārvaldiet avotu tipus un sūtītājus manuālai reģistrācijai. Ārēji saņemtie sūtītāji paliek snapshots un netiek pievienoti sarakstam." },
  "lt-LT": { navIntakeSettings: "Registravimas", intakeSettingsIntro: "Tvarkykite šaltinių tipus ir siuntėjus rankiniam registravimui. Iš išorės gauti siuntėjai lieka snapshots ir nėra įtraukiami į sąrašą." },
};
