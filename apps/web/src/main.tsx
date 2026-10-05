import { StrictMode, Suspense, useEffect, useRef, useState } from "react";
import { LoginPage } from "./auth/LoginPage";
import { createRoot } from "react-dom/client";
import { ProductShell } from "@fylkren/ui";
import { apiGet } from "./api/client";
import { signOut as endSession } from "./api/authClient";
import type { Session } from "./work/WorkContextModels";
import type { Branding, LoginConfiguration, PublicConfiguration } from "./app/models";
import { currentAppLocation, navigateToLocation, type AppPage } from "./navigation/permalinks";
import { navigationCountLabel, useNavigationCounts } from "./app/useNavigationCounts";
import { buildNavigation } from "./app/navigationPolicy";
import { AppContent, preloadOperationalPages } from "./app/AppContent";
import { getDescendantWorkload, getOverviewWorkItems, getTaskContext } from "./tasks/taskApi";
import { applyBrandingFavicon } from "./branding/favicon";
import { LocalizationProvider } from "./localization/LocalizationProvider";
import { regionalDisplayLocale, translate } from "./localization";

function warmAuthenticatedExperience(session: Session, location = currentAppLocation()) {
  if (!session.authenticated) return;
  preloadOperationalPages();
  if (!session.personId || location.page !== "Overview") return;
  void getTaskContext(session.personId).then((context) => {
    const site = context.sites.find((value) => value.hasOperationalAccess);
    if (!site) return;
    const requests: Promise<unknown>[] = [getOverviewWorkItems(site.siteId, session.personId)];
    if (site.hasTopLevelAccess)
      requests.push(getDescendantWorkload(site.siteId, "", session.personId));
    void Promise.allSettled(requests);
  }).catch(() => undefined);
}

function App() {
  const [appLocation, setAppLocation] = useState(currentAppLocation);
  const activeItem = appLocation.page;
  const setActiveItem = (page: AppPage) => setAppLocation(current => ({ ...current, page }));
  const navigationHistory = useRef<AppPage[]>(["Overview"]);
  const [navigationIndex, setNavigationIndex] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const navigationCounts = useNavigationCounts(session, activeItem);
  const [branding, setBranding] = useState<Branding>({
    productName: "Fylkren",
    instanceName: "Local installation",
    theme: "light",
    primaryColor: "#315c53",
    accentColor: "#174d43",
    topBarColor: "#202020",
    topBarTextColor: "#ffffff",
    customCss: "",
    hasLogo: false,
  });
  const [brandingReady, setBrandingReady] = useState(false);
  const [configuration, setConfiguration] =
    useState<PublicConfiguration | null>(null);
  const [configurationError, setConfigurationError] = useState(false);
  const [loginConfiguration, setLoginConfiguration] = useState<LoginConfiguration | null>(null);

  useEffect(() => {
    if (!window.location.hash) navigateToLocation({ page: "Overview" }, true);
    const locationChanged = () => setAppLocation(currentAppLocation());
    window.addEventListener("hashchange", locationChanged);
    apiGet<Branding>("/api/branding", "Branding could not be loaded.")
      .then((value) => {
        setBranding(value);
        setBrandingReady(true);
        document.title = value.productName;
      })
      .catch(() => setBrandingReady(true));
    apiGet<LoginConfiguration>("/api/configuration/public", "Sign-in options could not be loaded.")
      .then((value) => {
        setLoginConfiguration(value);
        document.documentElement.lang = value.defaultLanguage;
      })
      .catch(() =>
        setLoginConfiguration({
          setupRequired: false,
          defaultLanguage: "en-US",
          timeZone: "UTC",
          clockFormat: "24-hour",
          measurementSystem: "metric",
          authentication: {
            localEnabled: true,
            mfaEnabled: true,
            mfaRequired: true,
            oidcConfigurationEnabled: false,
            samlConfigurationEnabled: false,
            activeDirectoryConfigurationEnabled: false,
            ldapConfigurationEnabled: false,
            webAuthnEnabled: false,
          },
        }),
      );
    apiGet<Session>("/api/session", "The session could not be loaded.")
      .then((value) => {
        warmAuthenticatedExperience(value);
        setSession(value);
        if (value.authenticated)
          void apiGet<PublicConfiguration>("/api/configuration", "Configuration could not be loaded.")
            .then(setConfiguration)
            .catch(() => setConfigurationError(true));
      })
      .catch(() =>
        setSession({ authenticated: false, isPlatformManager: false }),
      );
    return () => window.removeEventListener("hashchange", locationChanged);
  }, []);

  useEffect(() => {
    if (!brandingReady) return;
    return applyBrandingFavicon(branding);
  }, [branding, brandingReady]);

  useEffect(() => {
    const refresh = window.setInterval(() => {
      if (session?.authenticated)
        void apiGet<PublicConfiguration>("/api/configuration", translate(baseLanguage, "licenseRefreshFailed"))
          .then(setConfiguration)
          .catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(refresh);
  }, [session?.authenticated]);

  const activeRegionalSettings = configuration ?? loginConfiguration;
  const displayTimeZone = activeRegionalSettings?.timeZone ?? "UTC";
  const baseLanguage = activeRegionalSettings?.defaultLanguage ?? "en-US";
  const displayLanguage = regionalDisplayLocale(baseLanguage, activeRegionalSettings?.clockFormat ?? "24-hour");

  useEffect(() => {
    document.documentElement.lang = baseLanguage;
  }, [baseLanguage]);

  if (session === null || loginConfiguration === null)
    return <LocalizationProvider language={displayLanguage}><div className="login-page">{translate(baseLanguage, "loading")}</div></LocalizationProvider>;
  const brandedStyle = {
    "--brand": branding.primaryColor,
    "--accent": branding.accentColor,
    "--topbar-bg": branding.topBarColor,
    "--topbar-text": branding.topBarTextColor,
  } as React.CSSProperties;
  const themeClass =
    branding.theme === "dark"
      ? "theme-dark"
      : branding.theme === "system"
        ? "theme-system"
        : "";
  if (!session.authenticated)
    return (
      <LocalizationProvider language={displayLanguage}><div className={themeClass} style={brandedStyle}>
        {branding.customCss && <style id="customer-css-overrides">{branding.customCss}</style>}
        <LoginPage
          onSignedIn={(nextSession) => {
            void apiGet<PublicConfiguration>("/api/configuration", translate(baseLanguage, "configurationLoadFailed"))
              .then(setConfiguration)
              .catch(() => setConfigurationError(true));
            warmAuthenticatedExperience(nextSession);
            setSession(nextSession);
            if (nextSession.mustChangePassword || nextSession.mfaRequired) resetNavigation("Profile");
            else {
              const requested = currentAppLocation();
              navigationHistory.current = [requested.page];
              setNavigationIndex(0);
              setAppLocation(requested);
            }
          }}
          branding={branding}
          configuration={loginConfiguration}
        />
      </div></LocalizationProvider>
    );

  async function signOut() {
    await endSession();
    resetNavigation("Overview");
    setConfiguration(null);
    setConfigurationError(false);
    setSession({ authenticated: false, isPlatformManager: false });
  }

  function resetNavigation(item: AppPage) {
    navigationHistory.current = [item];
    setNavigationIndex(0);
    setActiveItem(item);
    navigateToLocation({ page: item }, true);
  }

  if (configuration === null)
    return <LocalizationProvider language={displayLanguage}><div className="login-page">{configurationError
      ? <div><p>{translate(baseLanguage, "configurationLoadFailed")}</p><button type="button" onClick={() => {
          setConfigurationError(false);
          void apiGet<PublicConfiguration>("/api/configuration", translate(baseLanguage, "configurationLoadFailed"))
            .then(setConfiguration).catch(() => setConfigurationError(true));
        }}>{translate(baseLanguage, "tryAgain")}</button></div>
      : translate(baseLanguage, "loadingConfiguration")}</div></LocalizationProvider>;

  function navigateTo(item: AppPage) {
    if (item === activeItem && !appLocation.siteId && !appLocation.itemId && !appLocation.runId && !appLocation.reportId) return;
    const nextHistory = navigationHistory.current.slice(0, navigationIndex + 1);
    nextHistory.push(item);
    navigationHistory.current = nextHistory;
    setNavigationIndex(nextHistory.length - 1);
    setActiveItem(item);
    navigateToLocation({ page: item });
  }

  function navigateInHistory(offset: -1 | 1) {
    const nextIndex = navigationIndex + offset;
    const target = navigationHistory.current[nextIndex];
    if (target === undefined) return;
    setNavigationIndex(nextIndex);
    setActiveItem(target);
    navigateToLocation({ page: target }, true);
  }

  const { effectiveItem, administrationNavigation, navigationItems } =
    buildNavigation(session, activeItem);
  const navigationLabels: Record<AppPage, Parameters<typeof translate>[1]> = {
    Archives: "navArchives", Overview: "navOverview", Tasks: "navTasks", Workload: "navWorkload", Learning: "navLearning",
    Planning: "navPlanning", Execution: "navExecution", Reports: "navReports",
    Platform: "navPlatform", Sites: "navSites", Identity: "navIdentity", References: "navReferences",
    Classifications: "navClassification", API: "navApi", Federation: "navFederation",
    License: "navLicense", Email: "navEmail", Appearance: "navAppearance",
    Audit: "navAudit", Organization: "navOrganization", Personnel: "navPersonnel",
    Sources: "navIntakeSettings", Workflows: "navWorkflows", Templates: "navTemplates", Notifications: "navNotifications",
    Profile: "profile",
  };

  return (
    <LocalizationProvider language={displayLanguage}><div className={themeClass} style={brandedStyle}>
      {branding.customCss && <style id="customer-css-overrides">{branding.customCss}</style>}
      <ProductShell
        activeItem={effectiveItem}
        onNavigate={(item) => navigateTo(item as AppPage)}
        navigationItems={navigationItems}
        navigationDividerBefore={administrationNavigation[0]}
        navigationLabel={(item) => navigationCountLabel(translate(baseLanguage, navigationLabels[item as AppPage] ?? "navOverview"), item, navigationCounts)}
        labels={{
          demoReadOnly: translate(baseLanguage, "demoReadOnly"),
          visitedViews: translate(baseLanguage, "visitedViews"),
          previousView: translate(baseLanguage, "previousView"),
          nextView: translate(baseLanguage, "nextView"),
          openMainMenu: translate(baseLanguage, "openMainMenu"),
          openUserMenu: translate(baseLanguage, "openUserMenu"),
          userMenu: translate(baseLanguage, "userMenu"),
          profile: translate(baseLanguage, "profile"),
          signOut: translate(baseLanguage, "signOut"),
          closeMainMenu: translate(baseLanguage, "closeMainMenu"),
          mainNavigation: translate(baseLanguage, "mainNavigation"),
          menu: translate(baseLanguage, "navigationMenu"),
        }}
        userLabel={session.displayName ?? session.username ?? "FU"}
        profileImageUrl={
          session.hasProfileImage ? "/api/profile/image" : undefined
        }
        onProfile={() => navigateTo("Profile")}
        onSignOut={signOut}
        onPrevious={() => navigateInHistory(-1)}
        onNext={() => navigateInHistory(1)}
        canPrevious={navigationIndex > 0}
        canNext={navigationIndex < navigationHistory.current.length - 1}
        productName={branding.productName}
        logoUrl={branding.hasLogo ? "/api/branding/logo" : undefined}
        version={configuration.version}
        edition={configuration.edition}
      >
        <Suspense fallback={<div className="page"><p className="status-message">{translate(baseLanguage, "loadingPage")}</p></div>}>
        <AppContent
          effectiveItem={effectiveItem}
          session={session}
          configuration={configuration}
          branding={branding}
          location={appLocation}
          language={displayLanguage}
          timeZone={displayTimeZone}
          onNavigate={navigateTo}
          onSessionChanged={setSession}
          onSignOut={signOut}
          onBrandingChanged={(value) => {
            setBranding(value);
            document.title = value.productName;
          }}
          onConfigurationChanged={(value) => {
            setConfiguration(value);
            setLoginConfiguration((current) => current ? {
              ...current,
              defaultLanguage: value.defaultLanguage,
              timeZone: value.timeZone,
              clockFormat: value.clockFormat,
              measurementSystem: value.measurementSystem,
            } : current);
          }}
        />
        </Suspense>
      </ProductShell>
    </div></LocalizationProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
