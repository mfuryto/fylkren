import { StrictMode, Suspense, useEffect, useRef, useState } from "react";
import { LoginPage } from "./auth/LoginPage";
import { createRoot } from "react-dom/client";
import { ProductShell } from "@fylkren/ui";
import { apiGet } from "./api/client";
import { signOut as endSession } from "./api/authClient";
import type { Session } from "./work/WorkContextModels";
import type { Branding, LoginConfiguration, PublicConfiguration } from "./app/models";
import { currentAppLocation, navigateToLocation } from "./navigation/permalinks";
import { buildNavigation } from "./app/navigationPolicy";
import { AppContent, preloadOperationalPages } from "./app/AppContent";
import { getDescendantWorkload, getOverviewWorkItems, getTaskContext } from "./tasks/taskApi";
import { applyBrandingFavicon } from "./branding/favicon";

let displayLanguage = "nb-NO";
let displayTimeZone = "Europe/Oslo";

function warmAuthenticatedExperience(session: Session, location = currentAppLocation()) {
  if (!session.authenticated) return;
  preloadOperationalPages();
  if (!session.personId || location.page !== "Oversikt") return;
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
  const setActiveItem = (page: string) => setAppLocation(current => ({ ...current, page }));
  const navigationHistory = useRef<string[]>(["Oversikt"]);
  const [navigationIndex, setNavigationIndex] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [branding, setBranding] = useState<Branding>({
    productName: "Fylkren",
    instanceName: "Lokal installasjon",
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
    if (!window.location.hash) navigateToLocation({ page: "Oversikt" }, true);
    const locationChanged = () => setAppLocation(currentAppLocation());
    window.addEventListener("hashchange", locationChanged);
    apiGet<Branding>("/api/branding", "Profileringen kunne ikke lastes.")
      .then((value) => {
        setBranding(value);
        setBrandingReady(true);
        document.title = value.productName;
      })
      .catch(() => setBrandingReady(true));
    apiGet<LoginConfiguration>("/api/configuration/public", "Innloggingsvalgene kunne ikke lastes.")
      .then((value) => {
        displayLanguage = value.defaultLanguage;
        displayTimeZone = value.timeZone;
        setLoginConfiguration(value);
        document.documentElement.lang = value.defaultLanguage;
      })
      .catch(() =>
        setLoginConfiguration({
          setupRequired: false,
          defaultLanguage: "nb-NO",
          timeZone: "Europe/Oslo",
          authentication: {
            localEnabled: true,
            mfaEnabled: true,
            oidcConfigurationEnabled: false,
            samlConfigurationEnabled: false,
            activeDirectoryConfigurationEnabled: false,
            ldapConfigurationEnabled: false,
            webAuthnEnabled: false,
          },
        }),
      );
    apiGet<Session>("/api/session", "Økten kunne ikke lastes.")
      .then((value) => {
        warmAuthenticatedExperience(value);
        setSession(value);
        if (value.authenticated)
          void apiGet<PublicConfiguration>("/api/configuration", "Konfigurasjonen kunne ikke lastes.")
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
        void apiGet<PublicConfiguration>("/api/configuration", "Lisensstatus kunne ikke oppdateres.")
          .then(setConfiguration)
          .catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(refresh);
  }, [session?.authenticated]);

  if (session === null || loginConfiguration === null)
    return <div className="login-page">Laster …</div>;
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
      <div className={themeClass} style={brandedStyle}>
        {branding.customCss && <style id="customer-css-overrides">{branding.customCss}</style>}
        <LoginPage
          onSignedIn={(nextSession) => {
            void apiGet<PublicConfiguration>("/api/configuration", "Konfigurasjonen kunne ikke lastes.")
              .then(setConfiguration)
              .catch(() => setConfigurationError(true));
            warmAuthenticatedExperience(nextSession);
            setSession(nextSession);
            if (nextSession.mustChangePassword) resetNavigation("Profil");
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
      </div>
    );

  async function signOut() {
    await endSession();
    resetNavigation("Oversikt");
    setConfiguration(null);
    setConfigurationError(false);
    setSession({ authenticated: false, isPlatformManager: false });
  }

  function resetNavigation(item: string) {
    navigationHistory.current = [item];
    setNavigationIndex(0);
    setActiveItem(item);
    navigateToLocation({ page: item }, true);
  }

  if (configuration === null)
    return <div className="login-page">{configurationError
      ? <div><p>Konfigurasjonen kunne ikke lastes.</p><button type="button" onClick={() => {
          setConfigurationError(false);
          void apiGet<PublicConfiguration>("/api/configuration", "Konfigurasjonen kunne ikke lastes.")
            .then(setConfiguration).catch(() => setConfigurationError(true));
        }}>Prøv igjen</button></div>
      : "Laster konfigurasjon …"}</div>;

  function navigateTo(item: string) {
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

  return (
    <div className={themeClass} style={brandedStyle}>
      {branding.customCss && <style id="customer-css-overrides">{branding.customCss}</style>}
      <ProductShell
        activeItem={effectiveItem}
        onNavigate={navigateTo}
        navigationItems={navigationItems}
        navigationDividerBefore={administrationNavigation[0]}
        userLabel={session.displayName ?? session.username ?? "FU"}
        profileImageUrl={
          session.hasProfileImage ? "/api/profile/image" : undefined
        }
        onProfile={() => navigateTo("Profil")}
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
        <Suspense fallback={<div className="page"><p className="status-message">Laster side …</p></div>}>
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
          onConfigurationChanged={setConfiguration}
        />
        </Suspense>
      </ProductShell>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
