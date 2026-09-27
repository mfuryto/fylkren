import type { Session } from "../work/WorkContextModels";

const platformNavigation = [
  "Plattform",
  "Sites",
  "Identitet",
  "Klassifisering",
  "API",
  "Federering",
  "Lisens",
  "E-post",
  "Utseende",
  "Revisjon",
];
const siteAdministrationNavigation = ["Organisasjon", "Personell"];
const siteManagerNavigation = [
  ...siteAdministrationNavigation,
  "Arbeidsflyter",
  "Maler",
  "Varslinger",
  "Revisjon",
];

export function buildNavigation(session: Session, activeItem: string) {
  const operationalAdministrationNavigation =
    session.administersSite || session.canApproveWork
      ? siteAdministrationNavigation
      : [];
  const effectiveItem = session.mustChangePassword
    ? "Profil"
    : session.isPlatformManager &&
        activeItem !== "Profil" &&
        !platformNavigation.includes(activeItem)
      ? "Plattform"
      : session.canExecute &&
          !session.hasOperationalRole &&
          activeItem !== "Profil" &&
          activeItem !== "Utførelse" &&
          !siteManagerNavigation.includes(activeItem)
        ? "Utførelse"
        : session.managesSites &&
            !session.hasOperationalRole &&
            !session.canExecute &&
            activeItem !== "Profil" &&
            !siteManagerNavigation.includes(activeItem)
          ? "Organisasjon"
          : activeItem;
  const primaryNavigation = session.isPlatformManager
    ? []
    : [
        ...(session.hasOperationalRole ? ["Oversikt", "Oppgaver"] : []),
        ...(session.isTopLevelLeader ? ["Belastning"] : []),
        ...(session.canPlan || session.canApproveWork ? ["Planlegging"] : []),
        ...(session.canExecute ? ["Utførelse"] : []),
        ...(session.hasOperationalRole ? ["Rapporter"] : []),
      ];
  const administrationNavigation = session.isPlatformManager
    ? platformNavigation
    : session.managesSites
      ? siteManagerNavigation
      : operationalAdministrationNavigation;
  return {
    effectiveItem,
    administrationNavigation,
    navigationItems: session.mustChangePassword
      ? []
      : [...primaryNavigation, ...administrationNavigation],
  };
}
