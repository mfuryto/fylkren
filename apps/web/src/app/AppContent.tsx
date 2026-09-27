import { lazy } from "react";
import { apiGet } from "../api/client";
import type { Branding, PublicConfiguration } from "./models";
import type { AppLocation } from "../navigation/permalinks";
import type { Session } from "../work/WorkContextModels";

const loadWorkOverview = () => import("../overview/OverviewPages");
const loadTasksPage = () => import("../tasks/TasksPage");
const loadPlanningPage = () => import("../workflows/PlanningPage");
const loadExecutionPage = () => import("../workflows/ExecutionPage");
const loadReportsPage = () => import("../reports/ReportsPage");

const WorkOverview = lazy(() => loadWorkOverview().then((module) => ({ default: module.WorkOverview })));
const WorkloadHistoryPage = lazy(() => import("../overview/WorkloadHistoryPage").then((module) => ({ default: module.WorkloadHistoryPage })));
const ReportsPage = lazy(() => loadReportsPage().then((module) => ({ default: module.ReportsPage })));
const TemplatesPage = lazy(() => import("../templates/TemplatesPage").then((module) => ({ default: module.TemplatesPage })));
const TasksPage = lazy(() => loadTasksPage().then((module) => ({ default: module.TasksPage })));
const ExecutionPage = lazy(() => loadExecutionPage().then((module) => ({ default: module.ExecutionPage })));
const PlanningPage = lazy(() => loadPlanningPage().then((module) => ({ default: module.PlanningPage })));
const WorkflowsPage = lazy(() => import("../workflows/WorkflowsPage").then((module) => ({ default: module.WorkflowsPage })));
const PlatformPage = lazy(() => import("../platform/PlatformOperationsPage").then((module) => ({ default: module.PlatformPage })));
const SmtpPage = lazy(() => import("../platform/SmtpPage").then((module) => ({ default: module.SmtpPage })));
const PlatformApiPage = lazy(() => import("../platform/PlatformApiPage").then((module) => ({ default: module.PlatformApiPage })));
const FederationPage = lazy(() => import("../platform/FederationPage").then((module) => ({ default: module.FederationPage })));
const PlatformLicensePage = lazy(() => import("../platform/PlatformLicensePage").then((module) => ({ default: module.PlatformLicensePage })));
const PlatformAuditPage = lazy(() => import("../platform/PlatformAuditPage").then((module) => ({ default: module.PlatformAuditPage })));
const PlatformClassificationsPage = lazy(() => import("../platform/PlatformClassificationsPage").then((module) => ({ default: module.PlatformClassificationsPage })));
const BrandingPage = lazy(() => import("../branding/BrandingPage").then((module) => ({ default: module.BrandingPage })));
const IdentityProvidersPage = lazy(() => import("../identity/IdentityProvidersPage").then((module) => ({ default: module.IdentityProvidersPage })));
const NotificationSettingsPage = lazy(() => import("../notifications/NotificationSettingsPage").then((module) => ({ default: module.NotificationSettingsPage })));
const SiteAuditPage = lazy(() => import("../audit/SiteAuditPage").then((module) => ({ default: module.SiteAuditPage })));
const SitesPage = lazy(() => import("../sites/SitesPage").then((module) => ({ default: module.SitesPage })));
const OrganizationPage = lazy(() => import("../organization/OrganizationPage").then((module) => ({ default: module.OrganizationPage })));
const PersonnelPage = lazy(() => import("../personnel/PersonnelPage").then((module) => ({ default: module.PersonnelPage })));
const ProfilePage = lazy(() => import("../profile/ProfilePage").then((module) => ({ default: module.ProfilePage })));

export function preloadOperationalPages() {
  void Promise.allSettled([
    loadWorkOverview(),
    loadTasksPage(),
    loadPlanningPage(),
    loadExecutionPage(),
    loadReportsPage(),
  ]);
}

export function AppContent({
  effectiveItem,
  session,
  configuration,
  branding,
  location,
  language,
  timeZone,
  onNavigate,
  onSessionChanged,
  onSignOut,
  onBrandingChanged,
  onConfigurationChanged,
}: {
  effectiveItem: string;
  session: Session;
  configuration: PublicConfiguration;
  branding: Branding;
  location: AppLocation;
  language: string;
  timeZone: string;
  onNavigate: (item: string) => void;
  onSessionChanged: (session: Session) => void;
  onSignOut: () => void;
  onBrandingChanged: (branding: Branding) => void;
  onConfigurationChanged: (configuration: PublicConfiguration) => void;
}) {
  const classificationMarkings = configuration.classificationEnabled
    ? configuration.classificationMarkings
    : [];

  if (effectiveItem === "Profil")
    return <ProfilePage session={session} configuration={configuration} onSessionChanged={onSessionChanged} onSignOut={onSignOut} />;
  if (effectiveItem === "Plattform" && session.isPlatformManager) return <PlatformPage />;
  if (effectiveItem === "Planlegging")
    return <PlanningPage session={session} language={language} timeZone={timeZone} classificationMarkings={classificationMarkings} permalink={location} />;
  if (effectiveItem === "Utførelse") return <ExecutionPage session={session} language={language} classificationMarkings={classificationMarkings} permalink={location} />;
  if (effectiveItem === "Rapporter")
    return <ReportsPage language={language} timeZone={timeZone} classificationMarkings={classificationMarkings} permalink={location} />;
  if (effectiveItem === "Belastning") return <WorkloadHistoryPage personId={session.personId} language={language} timeZone={timeZone} />;
  if (effectiveItem === "Arbeidsflyter" && session.managesSites) return <WorkflowsPage />;
  if (effectiveItem === "Maler" && session.managesSites) return <TemplatesPage />;
  if (effectiveItem === "Identitet" && session.isPlatformManager)
    return <IdentityProvidersPage language={language} timeZone={timeZone} canManageExternalIdentity={configuration.entitlements.includes("external-identity")} />;
  if (effectiveItem === "API" && session.isPlatformManager)
    return <PlatformApiPage language={language} timeZone={timeZone} entitlements={configuration.entitlements} />;
  if (effectiveItem === "Federering" && session.isPlatformManager)
    return <FederationPage canManage={configuration.entitlements.includes("instance-federation")} />;
  if (effectiveItem === "Lisens" && session.isPlatformManager)
    return <PlatformLicensePage onChanged={async () => onConfigurationChanged(await apiGet<PublicConfiguration>("/api/configuration", "Lisensstatus kunne ikke oppdateres."))} />;
  if (effectiveItem === "Klassifisering" && session.isPlatformManager)
    return (
      <PlatformClassificationsPage
        onChanged={async () =>
          onConfigurationChanged(
            await apiGet<PublicConfiguration>(
              "/api/configuration",
              "Konfigurasjonen kunne ikke oppdateres.",
            ),
          )
        }
      />
    );
  if (effectiveItem === "E-post" && session.isPlatformManager) return <SmtpPage />;
  if (effectiveItem === "Utseende" && session.isPlatformManager)
    return <BrandingPage branding={branding} onChanged={onBrandingChanged} />;
  if (effectiveItem === "Revisjon" && session.isPlatformManager)
    return <PlatformAuditPage language={language} timeZone={timeZone} />;
  if (effectiveItem === "Oppgaver")
    return <TasksPage personId={session.personId} language={language} timeZone={timeZone} classificationMarkings={classificationMarkings} permalink={location} />;
  if (effectiveItem === "Sites" && session.isPlatformManager)
    return <SitesPage configuration={configuration} />;
  if (effectiveItem === "Organisasjon") return <OrganizationPage session={session} />;
  if (effectiveItem === "Personell") return <PersonnelPage session={session} configuration={configuration} />;
  if (effectiveItem === "Varslinger" && session.managesSites) return <NotificationSettingsPage />;
  if (effectiveItem === "Revisjon" && session.managesSites)
    return <SiteAuditPage language={language} timeZone={timeZone} />;
  return <WorkOverview onNavigate={onNavigate} language={language} timeZone={timeZone} personId={session.personId} />;
}
