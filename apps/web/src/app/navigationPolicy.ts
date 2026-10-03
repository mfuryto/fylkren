import type { Session } from "../work/WorkContextModels";
import type { AppPage } from "../navigation/permalinks";

const platformNavigation: AppPage[] = [
  "Platform",
  "Sites",
  "Identity",
  "References",
  "Classifications",
  "API",
  "Federation",
  "License",
  "Email",
  "Appearance",
  "Audit",
];
const siteAdministrationNavigation: AppPage[] = ["Organization", "Personnel"];
const siteManagerNavigation: AppPage[] = [
  ...siteAdministrationNavigation,
  "References",
  "Sources",
  "Workflows",
  "Templates",
  "Notifications",
  "Audit",
];

export function buildNavigation(session: Session, activeItem: AppPage) {
  const operationalAdministrationNavigation =
    session.administersSite || session.canApproveWork
      ? siteAdministrationNavigation
      : [];
  const effectiveItem = session.mustChangePassword
    ? "Profile"
    : session.isPlatformManager
      ? activeItem === "Profile" || platformNavigation.includes(activeItem) || activeItem === "Archives" && session.hasArchiveAccess
        ? activeItem
        : "Platform"
      : session.canExecute &&
          !session.hasOperationalRole &&
          activeItem !== "Profile" &&
          activeItem !== "Execution" &&
          activeItem !== "Learning" &&
          !(activeItem === "Archives" && session.hasArchiveAccess) &&
          !siteManagerNavigation.includes(activeItem)
        ? "Execution"
        : session.managesSites &&
            !session.hasOperationalRole &&
            !session.canExecute &&
            activeItem !== "Profile" &&
            !(activeItem === "Archives" && session.hasArchiveAccess) &&
            !siteManagerNavigation.includes(activeItem)
          ? "Organization"
          : session.hasArchiveAccess && !session.hasOperationalRole && !session.canExecute && !session.managesSites && activeItem === "Overview" ? "Archives" : activeItem;
  const primaryNavigation = session.isPlatformManager
    ? []
    : [
        ...(session.hasOperationalRole ? ["Overview", "Tasks"] as AppPage[] : []),
        ...(session.canPlan || session.canApproveWork ? ["Planning"] as AppPage[] : []),
        ...(session.canExecute ? ["Execution"] as AppPage[] : []),
        ...(session.hasOperationalRole ? ["Reports"] as AppPage[] : []),
        ...(session.isTopLevelLeader ? ["Workload"] as AppPage[] : []),
        ...(session.hasOperationalRole || session.canExecute ? ["Learning"] as AppPage[] : []),
        ...(session.hasArchiveAccess ? ["Archives"] as AppPage[] : []),
      ];
  const administrationNavigation = session.isPlatformManager
    ? [...platformNavigation, ...(session.hasArchiveAccess ? ["Archives"] as AppPage[] : [])]
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
