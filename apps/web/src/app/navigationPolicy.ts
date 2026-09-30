import type { Session } from "../work/WorkContextModels";
import type { AppPage } from "../navigation/permalinks";

const platformNavigation: AppPage[] = [
  "Platform",
  "Sites",
  "Identity",
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
    : session.isPlatformManager &&
        activeItem !== "Profile" &&
        !platformNavigation.includes(activeItem)
      ? "Platform"
      : session.canExecute &&
          !session.hasOperationalRole &&
          activeItem !== "Profile" &&
          activeItem !== "Execution" &&
          !siteManagerNavigation.includes(activeItem)
        ? "Execution"
        : session.managesSites &&
            !session.hasOperationalRole &&
            !session.canExecute &&
            activeItem !== "Profile" &&
            !siteManagerNavigation.includes(activeItem)
          ? "Organization"
          : activeItem;
  const primaryNavigation = session.isPlatformManager
    ? []
    : [
        ...(session.hasOperationalRole ? ["Overview", "Tasks"] as AppPage[] : []),
        ...(session.isTopLevelLeader ? ["Workload"] as AppPage[] : []),
        ...(session.canPlan || session.canApproveWork ? ["Planning"] as AppPage[] : []),
        ...(session.canExecute ? ["Execution"] as AppPage[] : []),
        ...(session.hasOperationalRole ? ["Reports"] as AppPage[] : []),
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
